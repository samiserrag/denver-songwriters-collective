import assert from "node:assert/strict";
import test from "node:test";
import {
  STATE_BLOCKED,
  STATE_CLAIMED,
  STATE_HUMAN_REVIEW,
  STATE_RETRY_WAIT,
  STATE_RUNNING
} from "../lib/orchestratorState.mjs";
import { ingestAdapterResult } from "../lib/orchestratorAdapterIngest.mjs";
import { createOrchestratorStateSnapshot } from "../lib/orchestratorStateManifest.mjs";

const NOW = "2026-05-04T02:20:00.000Z";

function snapshot({ issueNumber = 42, state = STATE_RUNNING, attempt = 1, ...overrides } = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber,
    state,
    title: "Adapter ingest negative issue",
    branchName: `symphony/issue-${issueNumber}-adapter-negative`,
    worktreePath: `.symphony/worktrees/issue-${issueNumber}-adapter-negative`,
    logPath: `.symphony/logs/issue-${issueNumber}.jsonl`,
    manifestPath: ".symphony/state/manifests/run.json",
    attempt,
    reason: "adapter_started",
    ...overrides
  });
}

function adapterResult(overrides = {}) {
  return {
    ok: true,
    reason: "turn_completed",
    terminal_status: "success",
    terminal_reason: "turn_completed",
    thread_id: "thread-negative",
    turn_id: "turn-negative",
    session_id: "thread-negative-turn-negative",
    turn_count: 1,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: NOW,
    token_usage: {
      input_tokens: 11,
      output_tokens: 7,
      total_tokens: 18
    },
    rate_limits: {
      requests_remaining: 91
    },
    adapter_state_snapshot: {
      ok: true,
      terminal_status: "success",
      terminal_reason: "turn_completed",
      thread_id: "thread-negative",
      turn_id: "turn-negative",
      session_id: "thread-negative-turn-negative",
      turn_count: 1,
      last_protocol_event: "turn/completed",
      last_protocol_event_at: NOW,
      token_usage: {
        input_tokens: 11,
        output_tokens: 7,
        total_tokens: 18
      },
      rate_limits: {
        requests_remaining: 91
      },
      adapter_events_count: 2,
      protocol_events_count: 3
    },
    ...overrides
  };
}

function assertFailClosed(result, pattern, reason = "adapter_ingest_failed") {
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
  assert.match(result.error, pattern);
  assert.equal(result.event, null);
  assert.equal(result.transition, null);
  assert.equal(result.next_snapshot, null);
  assert.equal(result.adapter_state_snapshot, null);
  assert.equal(result.accounting, null);
  assert.deepEqual(result.actions, ["stop_adapter_ingestion", "require_manual_review"]);
  assert.deepEqual(result.durableWrites, ["adapter_ingest_manifest_error"]);
}

test("fails closed when terminal_status is missing", () => {
  const input = adapterResult({
    terminal_status: undefined,
    adapter_state_snapshot: {
      terminal_reason: "turn_completed",
      ok: true
    }
  });

  const result = ingestAdapterResult(snapshot(), input, { now: NOW });

  assertFailClosed(result, /adapter terminal_status is required/);
});

test("fails closed when terminal_reason and raw reason are missing", () => {
  const input = adapterResult({
    reason: undefined,
    terminal_reason: undefined,
    adapter_state_snapshot: {
      terminal_status: "success",
      ok: true
    }
  });

  const result = ingestAdapterResult(snapshot(), input, { now: NOW });

  assertFailClosed(result, /adapter terminal_reason is required/);
});

for (const input of [
  {
    name: "success status with failure reason",
    terminal_status: "success",
    terminal_reason: "turn_failed",
    error: /unknown adapter terminal taxonomy: success\/turn_failed/
  },
  {
    name: "failure status with success reason",
    terminal_status: "failure",
    terminal_reason: "turn_completed",
    error: /unknown adapter terminal taxonomy: failure\/turn_completed/
  },
  {
    name: "unknown terminal status",
    terminal_status: "interrupted",
    terminal_reason: "turn_completed",
    error: /unknown adapter terminal taxonomy: interrupted\/turn_completed/
  }
]) {
  test(`fails closed on terminal taxonomy mismatch: ${input.name}`, () => {
    const result = ingestAdapterResult(
      snapshot(),
      adapterResult({
        ok: false,
        reason: input.terminal_reason,
        terminal_status: input.terminal_status,
        terminal_reason: input.terminal_reason,
        adapter_state_snapshot: {
          ok: false,
          terminal_status: input.terminal_status,
          terminal_reason: input.terminal_reason
        }
      }),
      { now: NOW }
    );

    assertFailClosed(result, input.error);
  });
}

test("fails closed when the selected issue is not running", () => {
  const result = ingestAdapterResult(snapshot({ state: STATE_CLAIMED }), adapterResult(), { now: NOW });

  assertFailClosed(
    result,
    /adapter result can only be ingested for running state: claimed/,
    "adapter_ingest_invalid_state"
  );
  assert.equal(result.issue_number, 42);
});

test("fails closed when explicit issueNumber is absent from the manifest", () => {
  const result = ingestAdapterResult(snapshot(), adapterResult(), { now: NOW, issueNumber: 77 });

  assertFailClosed(result, /issue 77 was not found in orchestrator state snapshot/);
});

test("fails closed when retryable failure has malformed retry attempt context", () => {
  const result = ingestAdapterResult(
    snapshot(),
    adapterResult({
      ok: false,
      reason: "read_timeout",
      terminal_status: "failure",
      terminal_reason: "read_timeout",
      adapter_state_snapshot: {
        ok: false,
        terminal_status: "failure",
        terminal_reason: "read_timeout"
      }
    }),
    { now: NOW, retryAttempt: 0 }
  );

  assertFailClosed(result, /retry attempt must be a positive integer/, "adapter_ingest_reducer_failed");
  assert.equal(result.issue_number, 42);
});

test("retry exhaustion from adapter ingestion blocks instead of scheduling another retry", () => {
  const result = ingestAdapterResult(
    snapshot({ attempt: 4 }),
    adapterResult({
      ok: false,
      reason: "read_timeout",
      terminal_status: "failure",
      terminal_reason: "read_timeout",
      adapter_state_snapshot: {
        ok: false,
        terminal_status: "failure",
        terminal_reason: "read_timeout",
        thread_id: "thread-retry-exhausted",
        turn_id: "turn-retry-exhausted"
      }
    }),
    { now: NOW, retryAttempt: 4, maxAttempts: 3 }
  );

  assert.equal(result.ok, true);
  assert.equal(result.transition.to, STATE_BLOCKED);
  assert.equal(result.reason, "retry_exhausted");
  assert.equal(result.next_snapshot.issues["42"].state, STATE_BLOCKED);
  assert.deepEqual(result.next_snapshot.retry_attempts, {});
});

test("missing turn_id is preserved as null and does not invent a session_id", () => {
  const result = ingestAdapterResult(
    snapshot(),
    adapterResult({
      thread_id: "thread-no-turn",
      turn_id: null,
      session_id: null,
      adapter_state_snapshot: {
        ok: true,
        terminal_status: "success",
        terminal_reason: "turn_completed",
        thread_id: "thread-no-turn",
        turn_id: null,
        session_id: null
      }
    }),
    { now: NOW }
  );

  assert.equal(result.ok, true);
  assert.equal(result.transition.to, STATE_HUMAN_REVIEW);
  assert.equal(result.accounting.thread_id, "thread-no-turn");
  assert.equal(result.accounting.turn_id, null);
  assert.equal(result.accounting.session_id, null);
  assert.equal(result.next_snapshot.last_outcome.turn_id, null);
  assert.equal(result.next_snapshot.last_outcome.session_id, null);
});
