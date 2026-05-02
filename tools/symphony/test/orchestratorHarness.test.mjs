import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  STATE_BLOCKED,
  STATE_CANCELLED,
  STATE_CLAIMED,
  STATE_HUMAN_REVIEW,
  STATE_RETRY_WAIT,
  STATE_RUNNING,
  STATE_STALE
} from "../lib/orchestratorState.mjs";
import { runOrchestratorHarness } from "../lib/orchestratorHarness.mjs";
import {
  createOrchestratorStateSnapshot,
  readOrchestratorStateManifest,
  writeOrchestratorStateManifest
} from "../lib/orchestratorStateManifest.mjs";
import { loadExpectedResult } from "./helpers/codexAppServerAdapterReplay.mjs";

const NOW = "2026-05-02T21:00:00.000Z";
const RETRY_DUE = "2026-05-02T21:00:10.000Z";
const RUNNING_LABEL = "symphony:running";

function runningSnapshot(overrides = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_RUNNING,
    title: "Harness issue",
    branchName: "symphony/issue-42-harness-issue",
    worktreePath: ".symphony/worktrees/issue-42-harness-issue",
    logPath: ".symphony/logs/issue-42.jsonl",
    manifestPath: ".symphony/state/manifests/harness.json",
    attempt: 1,
    reason: "adapter_started",
    workflow: {
      workflow_hash: "sha256:accepted",
      workflow_version: "v1"
    },
    ...overrides
  });
}

function observed(overrides = {}) {
  const { now = NOW, ...issueOverrides } = overrides;
  return {
    now,
    issues: {
      42: {
        eligible: true,
        labels: [RUNNING_LABEL],
        workpadState: "running",
        workpadUpdatedAt: "2026-05-02T20:58:00.000Z",
        workflow: {
          workflow_hash: "sha256:accepted",
          workflow_version: "v1"
        },
        workspace: {
          lockHeld: false,
          worktreeExists: true
        },
        ...issueOverrides
      }
    }
  };
}

async function adapterResultFromFixture(fixtureName, overrides = {}) {
  const expected = await loadExpectedResult(fixtureName);
  const adapterStateSnapshot = {
    pid: 12345,
    thread_id: expected.thread_id ?? null,
    turn_id: expected.turn_id ?? null,
    session_id: expected.session_id ?? null,
    turn_count: expected.turn_count ?? 0,
    last_protocol_event: expected.last_protocol_event ?? null,
    last_protocol_event_at: expected.last_protocol_event ? NOW : null,
    token_usage: expected.token_usage ?? null,
    rate_limits: expected.rate_limits ?? null,
    adapter_events_count: expected.adapter_events_count ?? 0,
    protocol_events_count: expected.protocol_events_count ?? 0,
    terminal_status: expected.terminal_status,
    terminal_reason: expected.terminal_reason,
    ok: expected.ok
  };
  return {
    ok: expected.ok,
    reason: expected.reason,
    terminal_status: expected.terminal_status,
    terminal_reason: expected.terminal_reason,
    thread_id: expected.thread_id ?? null,
    turn_id: expected.turn_id ?? null,
    session_id: expected.session_id ?? null,
    turn_count: expected.turn_count ?? 0,
    last_protocol_event: expected.last_protocol_event ?? null,
    last_protocol_event_at: expected.last_protocol_event ? NOW : null,
    token_usage: expected.token_usage ?? null,
    rate_limits: expected.rate_limits ?? null,
    adapter_state_snapshot: adapterStateSnapshot,
    now: NOW,
    ...overrides
  };
}

function issueState(result, issueNumber = 42) {
  return result.final_snapshot.issues[String(issueNumber)].state;
}

async function tempManifestPath() {
  const root = await mkdtemp(path.join(os.tmpdir(), "symphony-orchestrator-harness-"));
  return path.join(root, "state", "orchestrator-state.json");
}

test("fresh running issue plus adapter success produces a human_review snapshot", async () => {
  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot(),
    observedSequence: [observed()],
    adapterResults: [await adapterResultFromFixture("success-turn-completed.jsonl")]
  });

  assert.equal(result.ok, true);
  assert.equal(issueState(result), STATE_HUMAN_REVIEW);
  assert.equal(result.transcript.length, 1);
  assert.equal(result.transcript[0].reconciliation.decisions[0].reason, "running_issue_fresh_and_eligible");
  assert.equal(result.transcript[0].adapter_ingestion.transition.to, STATE_HUMAN_REVIEW);
  assert.equal(result.adapter_ingestion_decisions.length, 1);
  assert.deepEqual(result.final_snapshot.codex_rate_limits, { requests_remaining: 77 });
  assert.equal(result.final_snapshot.last_outcome.session_id, "fixture-thread-success-fixture-turn-success");
  assert.ok(result.actions.includes("transition_to_human_review"));
  assert.ok(result.durableWrites.includes("manifest_success"));
});

test("retryable adapter failure enters retry_wait, then retry due eligible reclaims", async () => {
  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot(),
    observedSequence: [
      observed(),
      observed({
        now: RETRY_DUE,
        labels: [],
        workpadState: "retry_wait"
      })
    ],
    adapterResults: [
      await adapterResultFromFixture("read-timeout.jsonl")
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(issueState(result), STATE_CLAIMED);
  assert.equal(result.adapter_ingestion_decisions[0].transition.to, STATE_RETRY_WAIT);
  assert.equal(result.adapter_ingestion_decisions[0].next_snapshot.retry_attempts["42"].due_at, RETRY_DUE);
  assert.equal(result.transcript[1].reconciliation.decisions[0].transition.to, STATE_CLAIMED);
  assert.deepEqual(result.final_snapshot.retry_attempts, {});
  assert.ok(result.durableWrites.includes("retry_entry"));
  assert.ok(result.durableWrites.includes("manifest_retry_fired"));
});

test("nonretryable adapter failure produces a blocked snapshot", async () => {
  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot(),
    observedSequence: [observed()],
    adapterResults: [await adapterResultFromFixture("turn-input-required.jsonl")]
  });

  assert.equal(result.ok, true);
  assert.equal(issueState(result), STATE_BLOCKED);
  assert.equal(result.adapter_ingestion_decisions[0].event.type, "adapter_terminal_nonretryable_failure");
  assert.equal(result.adapter_ingestion_decisions[0].adapter_terminal.raw_reason, "turn_input_required");
  assert.equal(result.final_snapshot.issues["42"].terminal_reason, "turn_failed");
  assert.ok(result.durableWrites.includes("manifest_terminal_failure"));
});

test("workflow drift cancels before adapter ingestion", async () => {
  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot(),
    observedSequence: [
      observed({
        workflow: {
          workflow_hash: "sha256:changed",
          workflow_version: "v1"
        }
      })
    ],
    adapterResults: [await adapterResultFromFixture("success-turn-completed.jsonl")]
  });

  assert.equal(result.ok, true);
  assert.equal(issueState(result), STATE_CANCELLED);
  assert.equal(result.adapter_ingestion_decisions.length, 0);
  assert.equal(result.transcript[0].adapter_ingestion_skipped.reason, "reconciliation_transition_prevented_adapter_ingest");
  assert.equal(result.transcript[0].reconciliation.decisions[0].reason, "workflow_policy_drift");
  assert.ok(result.durableWrites.includes("manifest_cancelled_by_reconciliation"));
});

test("stale running issue moves stale, then conservative recovery blocks", async () => {
  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot(),
    observedSequence: [
      observed({
        workpadUpdatedAt: "2026-05-02T16:00:00.000Z"
      }),
      observed({
        now: "2026-05-02T21:01:00.000Z",
        safeAutoRelease: true
      })
    ],
    options: {
      reconcileOptions: {
        staleThresholdMs: 4 * 60 * 60 * 1000
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.snapshots[1].issues["42"].state, STATE_STALE);
  assert.equal(issueState(result), STATE_BLOCKED);
  assert.equal(result.transcript[0].reconciliation.decisions[0].transition.to, STATE_STALE);
  assert.equal(result.transcript[1].reconciliation.decisions[0].transition.to, STATE_BLOCKED);
  assert.ok(result.durableWrites.includes("recovery_manifest_stale"));
  assert.ok(result.durableWrites.includes("recovery_manifest_blocked"));
});

test("manifest read and write path uses temp files only", async () => {
  const manifestPath = await tempManifestPath();
  await writeOrchestratorStateManifest(manifestPath, runningSnapshot());

  const result = await runOrchestratorHarness({
    manifestPath,
    observedSequence: [observed()],
    adapterResults: [await adapterResultFromFixture("success-turn-completed.jsonl")],
    options: {
      writeManifest: true
    }
  });

  const readBack = await readOrchestratorStateManifest(manifestPath);
  const raw = await readFile(manifestPath, "utf8");

  assert.equal(result.ok, true);
  assert.equal(readBack.issues["42"].state, STATE_HUMAN_REVIEW);
  assert.deepEqual(readBack, result.final_snapshot);
  assert.match(raw, /\n$/);
});

test("malformed manifest fails closed before reconciliation", async () => {
  const manifestPath = await tempManifestPath();
  await writeOrchestratorStateManifest(manifestPath, runningSnapshot());
  await writeFile(manifestPath, "{not-json", "utf8");

  const result = await runOrchestratorHarness({
    manifestPath,
    observedSequence: [observed()],
    adapterResults: [await adapterResultFromFixture("success-turn-completed.jsonl")]
  });

  assert.equal(result.ok, false);
  assert.equal(result.stage, "load_snapshot");
  assert.equal(result.reason, "orchestrator_harness_invalid_initial_snapshot");
  assert.match(result.error, /invalid orchestrator state manifest JSON/);
  assert.deepEqual(result.transcript, []);
  assert.equal(result.final_snapshot, null);
});

test("invalid harness input shape fails closed before side effects", async () => {
  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot(),
    observedSequence: {},
    adapterResults: []
  });

  assert.equal(result.ok, false);
  assert.equal(result.stage, "validate_inputs");
  assert.equal(result.reason, "orchestrator_harness_invalid_inputs");
  assert.match(result.error, /observedSequence must be an array/);
  assert.deepEqual(result.transcript, []);
});
