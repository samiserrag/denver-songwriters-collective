import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
  EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
  EVENT_ADAPTER_TERMINAL_SUCCESS,
  STATE_BLOCKED,
  STATE_HUMAN_REVIEW,
  STATE_RETRY_WAIT,
  STATE_RUNNING
} from "../lib/orchestratorState.mjs";
import { ingestAdapterResult } from "../lib/orchestratorAdapterIngest.mjs";
import { createOrchestratorStateSnapshot } from "../lib/orchestratorStateManifest.mjs";
import { loadExpectedResult } from "./helpers/codexAppServerAdapterReplay.mjs";

const NOW = "2026-05-02T20:30:00.000Z";

function runningSnapshot(overrides = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_RUNNING,
    title: "Adapter ingest issue",
    branchName: "symphony/issue-42-adapter-ingest",
    worktreePath: ".symphony/worktrees/issue-42-adapter-ingest",
    logPath: ".symphony/logs/issue-42.jsonl",
    manifestPath: ".symphony/state/manifests/run.json",
    attempt: 1,
    reason: "adapter_started",
    codexTotals: {
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
      seconds_running: 4
    },
    ...overrides
  });
}

async function adapterResultFromFixture(fixtureName, overrides = {}) {
  const expected = await loadExpectedResult(fixtureName);
  return adapterResultFromExpected(expected, overrides);
}

function adapterResultFromExpected(expected, overrides = {}) {
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
    protocol_events: Array.from({ length: expected.protocol_events_count ?? 0 }, (_, index) => ({ index })),
    adapter_events: Array.from({ length: expected.adapter_events_count ?? 0 }, (_, index) => ({ index })),
    adapter_state_snapshot: adapterStateSnapshot,
    ...overrides
  };
}

function assertNextIssueState(result, state) {
  const issue = result.next_snapshot.issues["42"];
  assert.equal(issue.state, state);
  assert.equal(issue.terminal_status, result.adapter_terminal.terminal_status);
  assert.equal(issue.terminal_reason, result.adapter_terminal.terminal_reason);
  assert.deepEqual(issue.adapter_state_snapshot, result.adapter_state_snapshot);
}

test("ingests successful turn_completed adapter result into human_review state", async () => {
  const adapterResult = await adapterResultFromFixture("success-turn-completed.jsonl");
  const result = ingestAdapterResult(runningSnapshot(), adapterResult, { now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.event.type, EVENT_ADAPTER_TERMINAL_SUCCESS);
  assert.equal(result.transition.from, STATE_RUNNING);
  assert.equal(result.transition.to, STATE_HUMAN_REVIEW);
  assert.equal(result.reason, "turn_completed");
  assertNextIssueState(result, STATE_HUMAN_REVIEW);
  assert.deepEqual(result.accounting.token_usage, {
    input_tokens: 21,
    output_tokens: 8,
    total_tokens: 29
  });
  assert.deepEqual(result.accounting.rate_limits, { requests_remaining: 77 });
  assert.deepEqual(result.next_snapshot.codex_rate_limits, { requests_remaining: 77 });
  assert.equal(result.next_snapshot.last_outcome.session_id, "fixture-thread-success-fixture-turn-success");
});

test("ingests read_timeout adapter result into retry_wait with retry metadata", async () => {
  const adapterResult = await adapterResultFromFixture("read-timeout.jsonl");
  const result = ingestAdapterResult(runningSnapshot(), adapterResult, { now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.event.type, EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE);
  assert.equal(result.transition.to, STATE_RETRY_WAIT);
  assert.equal(result.reason, "read_timeout");
  assert.deepEqual(result.transition.retry, {
    attempt: 1,
    maxAttempts: 3,
    delayMs: 10000,
    reason: "read_timeout"
  });
  assertNextIssueState(result, STATE_RETRY_WAIT);
  assert.equal(result.next_snapshot.retry_attempts["42"].reason, "read_timeout");
  assert.equal(result.next_snapshot.retry_attempts["42"].due_at, "2026-05-02T20:30:10.000Z");
});

test("ingests process_exit_before_completion as retryable per reducer taxonomy", async () => {
  const adapterResult = await adapterResultFromFixture("process-exit-before-completion.jsonl");
  const result = ingestAdapterResult(runningSnapshot(), adapterResult, { now: NOW });

  assert.equal(result.event.type, EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE);
  assert.equal(result.transition.to, STATE_RETRY_WAIT);
  assert.equal(result.reason, "process_exit_before_completion");
  assert.equal(result.next_snapshot.retry_attempts["42"].last_error, "process_exit_before_completion");
});

for (const fixtureName of [
  "turn-failed.jsonl",
  "turn-cancelled.jsonl",
  "turn-input-required.jsonl",
  "unsupported-tool-call.jsonl",
  "initialize-json-rpc-error.jsonl",
  "malformed-protocol-message.jsonl",
  "event-callback-error.jsonl"
]) {
  test(`ingests nonretryable ${fixtureName} adapter result into blocked state`, async () => {
    const adapterResult = await adapterResultFromFixture(fixtureName);
    const result = ingestAdapterResult(runningSnapshot(), adapterResult, { now: NOW });

    assert.equal(result.ok, true);
    assert.equal(result.event.type, EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE);
    assert.equal(result.transition.to, STATE_BLOCKED);
    assertNextIssueState(result, STATE_BLOCKED);
    assert.equal(result.adapter_terminal.raw_reason, adapterResult.reason);
    assert.deepEqual(result.next_snapshot.retry_attempts, {});
  });
}

test("ingests log_write_error fake adapter result into blocked state", () => {
  const result = ingestAdapterResult(
    runningSnapshot(),
    {
      ok: false,
      reason: "log_write_error",
      terminal_status: "failure",
      terminal_reason: "log_write_error",
      adapter_state_snapshot: {
        terminal_status: "failure",
        terminal_reason: "log_write_error",
        ok: false,
        thread_id: "thread-log",
        turn_id: "turn-log",
        session_id: "thread-log-turn-log",
        turn_count: 1,
        last_protocol_event: "turn/completed",
        last_protocol_event_at: NOW,
        token_usage: null,
        rate_limits: null,
        adapter_events_count: 2,
        protocol_events_count: 1
      }
    },
    { now: NOW }
  );

  assert.equal(result.ok, true);
  assert.equal(result.event.type, EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE);
  assert.equal(result.transition.to, STATE_BLOCKED);
  assert.equal(result.reason, "log_write_error");
  assert.equal(result.accounting.session_id, "thread-log-turn-log");
});

test("accepts an adapter_state_snapshot object directly", async () => {
  const adapterResult = await adapterResultFromFixture("success-turn-completed.jsonl");
  const result = ingestAdapterResult(runningSnapshot(), adapterResult.adapter_state_snapshot, { now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.transition.to, STATE_HUMAN_REVIEW);
  assert.equal(result.accounting.session_id, "fixture-thread-success-fixture-turn-success");
  assertNextIssueState(result, STATE_HUMAN_REVIEW);
});

test("fails closed on malformed adapter result", () => {
  const result = ingestAdapterResult(runningSnapshot(), null, { now: NOW });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "adapter_ingest_failed");
  assert.match(result.error, /adapter result must be an object/);
  assert.equal(result.transition, null);
  assert.equal(result.next_snapshot, null);
  assert.deepEqual(result.actions, ["stop_adapter_ingestion", "require_manual_review"]);
});

test("fails closed on invalid injected clock", async () => {
  const adapterResult = await adapterResultFromFixture("success-turn-completed.jsonl");
  const result = ingestAdapterResult(runningSnapshot(), adapterResult, { now: "not-a-date" });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "adapter_ingest_failed");
  assert.match(result.error, /now must be a valid timestamp/);
  assert.equal(result.transition, null);
  assert.equal(result.next_snapshot, null);
});

test("fails closed on unknown terminal taxonomy", () => {
  const result = ingestAdapterResult(
    runningSnapshot(),
    {
      ok: false,
      reason: "future_reason",
      terminal_status: "failure",
      terminal_reason: "future_reason",
      adapter_state_snapshot: {
        terminal_status: "failure",
        terminal_reason: "future_reason",
        ok: false
      }
    },
    { now: NOW }
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "adapter_ingest_failed");
  assert.match(result.error, /unknown adapter terminal taxonomy: failure\/future_reason/);
});

test("fails closed when snapshot has multiple issues and issueNumber is omitted", async () => {
  const adapterResult = await adapterResultFromFixture("success-turn-completed.jsonl");
  const snapshot = runningSnapshot();
  const second = runningSnapshot({
    issueNumber: 43,
    title: "Second issue"
  });
  const result = ingestAdapterResult({
    ...snapshot,
    issues: {
      ...snapshot.issues,
      "43": second.issues["43"]
    }
  }, adapterResult, { now: NOW });

  assert.equal(result.ok, false);
  assert.match(result.error, /issueNumber is required/);
});

test("uses explicit issueNumber when snapshot has multiple issues", async () => {
  const adapterResult = await adapterResultFromFixture("success-turn-completed.jsonl");
  const snapshot = runningSnapshot();
  const second = runningSnapshot({
    issueNumber: 43,
    title: "Second issue"
  });
  const result = ingestAdapterResult({
    ...snapshot,
    issues: {
      ...snapshot.issues,
      "43": second.issues["43"]
    }
  }, adapterResult, {
    now: NOW,
    issueNumber: 42
  });

  assert.equal(result.ok, true);
  assert.equal(result.next_snapshot.issues["42"].state, STATE_HUMAN_REVIEW);
  assert.equal(result.next_snapshot.issues["43"].state, STATE_RUNNING);
});
