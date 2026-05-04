import assert from "node:assert/strict";
import test from "node:test";
import {
  STATE_CLAIMED,
  STATE_RUNNING
} from "../lib/orchestratorState.mjs";
import {
  ORCHESTRATOR_STATE_MANIFEST_KIND,
  ORCHESTRATOR_STATE_MANIFEST_VERSION,
  createOrchestratorStateSnapshot,
  validateOrchestratorStateSnapshot
} from "../lib/orchestratorStateManifest.mjs";

const GENERATED_AT = "2026-05-03T18:15:00.000Z";

function runningSnapshot(overrides = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: GENERATED_AT,
    issueNumber: 42,
    state: STATE_RUNNING,
    title: "Boundary validation issue",
    branchName: "symphony/issue-42-boundary-validation",
    worktreePath: ".symphony/worktrees/issue-42-boundary-validation",
    logPath: ".symphony/logs/issue-42.jsonl",
    manifestPath: ".symphony/state/manifests/issue-42.json",
    attempt: 1,
    reason: "adapter_started",
    repo: {
      head: "head-sha",
      origin_main: "origin-main-sha",
      clean: true
    },
    lock: {
      held: true,
      run_id: "run-42"
    },
    ...overrides
  });
}

function retryWaitSnapshot() {
  return createOrchestratorStateSnapshot({
    generatedAt: GENERATED_AT,
    issueNumber: 42,
    state: "retry_wait",
    branchName: "symphony/issue-42-boundary-validation",
    worktreePath: ".symphony/worktrees/issue-42-boundary-validation",
    manifestPath: ".symphony/state/manifests/issue-42.json",
    reason: "read_timeout",
    retry: {
      attempt: 1,
      maxAttempts: 3,
      delayMs: 10000,
      dueAt: "2026-05-03T18:15:10.000Z",
      reason: "read_timeout",
      lastError: "read_timeout"
    }
  });
}

test("manifest identity fields fail closed when missing or unknown", () => {
  const snapshot = runningSnapshot();

  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      manifest_kind: undefined
    }),
    /invalid orchestrator state manifest kind: undefined/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      manifest_kind: "legacy_orchestrator_state"
    }),
    /invalid orchestrator state manifest kind: legacy_orchestrator_state/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      orchestrator_state_version: undefined
    }),
    /unknown orchestrator state manifest version: undefined/
  );
});

test("issue and retry maps must match their embedded issue numbers", () => {
  const snapshot = runningSnapshot();
  const retrySnapshot = retryWaitSnapshot();

  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      issues: {
        "43": {
          ...snapshot.issues["42"]
        }
      }
    }),
    /issues\.43\.issue_number must match its issue key/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...retrySnapshot,
      retry_attempts: {
        "43": {
          ...retrySnapshot.retry_attempts["42"]
        }
      }
    }),
    /retry_attempts\.43\.issue_number must match its issue key/
  );
});

test("state transition history rejects malformed boundary records", () => {
  const snapshot = runningSnapshot();
  const transition = {
    at: GENERATED_AT,
    from: STATE_CLAIMED,
    to: STATE_RUNNING,
    reason: "workspace_prepared",
    terminal: false,
    actions: ["mark_running"],
    durable_writes: ["manifest_running"]
  };

  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      state_transitions: {}
    }),
    /state_transitions must be an array/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      state_transitions: [{
        ...transition,
        at: "not-a-timestamp"
      }]
    }),
    /state_transitions\.0\.at must be a valid timestamp/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      state_transitions: [{
        ...transition,
        actions: "mark_running"
      }]
    }),
    /state_transitions\.0\.actions must be an array/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      state_transitions: [{
        ...transition,
        durable_writes: ["manifest_running", { write: "workpad" }]
      }]
    }),
    /state_transitions\.0\.durable_writes must contain only strings/
  );
});

test("codex totals reject malformed counters at the manifest boundary", () => {
  const snapshot = runningSnapshot();

  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      codex_totals: []
    }),
    /codex_totals must be an object/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      codex_totals: {
        input_tokens: 1,
        output_tokens: -1,
        total_tokens: 0,
        seconds_running: 0
      }
    }),
    /codex_totals\.output_tokens must be a non-negative number/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      codex_totals: {
        input_tokens: 1,
        output_tokens: 1,
        total_tokens: Number.NaN,
        seconds_running: 0
      }
    }),
    /codex_totals\.total_tokens must be a non-negative number/
  );
});

test("validation preserves generated_at and issue updated_at without clock drift", () => {
  const generatedAt = "2025-12-31T23:59:59.000Z";
  const snapshot = runningSnapshot({
    generatedAt
  });
  const validated = validateOrchestratorStateSnapshot({
    ...snapshot,
    generated_at: generatedAt,
    issues: {
      "42": {
        ...snapshot.issues["42"],
        updated_at: generatedAt
      }
    }
  });

  assert.equal(validated.generated_at, generatedAt);
  assert.equal(validated.issues["42"].updated_at, generatedAt);
  assert.equal(validated.manifest_kind, ORCHESTRATOR_STATE_MANIFEST_KIND);
  assert.equal(validated.orchestrator_state_version, ORCHESTRATOR_STATE_MANIFEST_VERSION);
});
