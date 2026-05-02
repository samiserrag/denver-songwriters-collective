import assert from "node:assert/strict";
import test from "node:test";
import {
  collectSnapshotAccounting,
  normalizeAdapterAccounting,
  normalizeIssueAccounting
} from "../lib/orchestratorAccounting.mjs";
import { STATE_RUNNING } from "../lib/orchestratorState.mjs";
import {
  createOrchestratorStateSnapshot,
  ORCHESTRATOR_STATE_MANIFEST_KIND,
  ORCHESTRATOR_STATE_MANIFEST_VERSION,
  validateOrchestratorStateSnapshot
} from "../lib/orchestratorStateManifest.mjs";
import { buildOrchestratorStatusSnapshot } from "../lib/orchestratorStatusSnapshot.mjs";

const NOW = "2026-05-02T22:00:00.000Z";
const RUN_STARTED = "2026-05-02T21:59:30.000Z";

test("token usage pass-through preserves unknown nested fields", () => {
  const tokenUsage = {
    input_tokens: 4,
    output_tokens: 5,
    total_tokens: 9,
    raw_total_token_usage: {
      prompt: 4,
      completion: 5,
      future_shape: {
        nested: true
      }
    }
  };

  const normalized = normalizeAdapterAccounting({ token_usage: tokenUsage });

  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.token_usage, tokenUsage);
});

test("rate limits pass-through preserves unknown nested fields", () => {
  const rateLimits = {
    requests_remaining: 12,
    token_bucket: {
      remaining: 1000,
      reset_seconds: 30,
      future_shape: ["kept"]
    }
  };

  const normalized = normalizeAdapterAccounting({ rate_limits: rateLimits });

  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.rate_limits, rateLimits);
});

test("session, thread, turn, and protocol metadata extract when present", () => {
  const normalized = normalizeAdapterAccounting({
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    turn_count: 3,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: "2026-05-02T21:59:55.000Z",
    terminal_status: "success",
    terminal_reason: "turn_completed"
  });

  assert.deepEqual(normalized.session, {
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    turn_count: 3,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: "2026-05-02T21:59:55.000Z",
    terminal_status: "success",
    terminal_reason: "turn_completed"
  });
});

test("adapter event counts prefer explicit counts and fall back to event arrays", () => {
  const explicit = normalizeAdapterAccounting({
    adapter_events_count: 2,
    protocol_events_count: 3,
    adapter_events: [{ event: "ignored" }],
    protocol_events: [{ method: "ignored" }]
  });
  const fallback = normalizeAdapterAccounting({
    adapter_events: [{ event: "one" }, { event: "two" }],
    protocol_events: [{ method: "one" }]
  });
  const malformedOptionalCount = normalizeAdapterAccounting({
    adapter_events_count: "not-a-number",
    adapter_events: [{ event: "one" }]
  });

  assert.deepEqual(explicit.event_counts, {
    adapter_events_count: 2,
    protocol_events_count: 3
  });
  assert.deepEqual(fallback.event_counts, {
    adapter_events_count: 2,
    protocol_events_count: 1
  });
  assert.deepEqual(malformedOptionalCount.event_counts, {
    adapter_events_count: 1,
    protocol_events_count: 0
  });
});

test("missing optional accounting fields produce stable null and empty output", () => {
  const normalized = normalizeAdapterAccounting({});

  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.session, {
    thread_id: null,
    turn_id: null,
    session_id: null,
    turn_count: null,
    last_protocol_event: null,
    last_protocol_event_at: null,
    terminal_status: null,
    terminal_reason: null
  });
  assert.equal(normalized.token_usage, null);
  assert.equal(normalized.rate_limits, null);
  assert.deepEqual(normalized.event_counts, {
    adapter_events_count: 0,
    protocol_events_count: 0
  });
});

test("malformed required inputs fail closed", () => {
  assert.equal(normalizeAdapterAccounting(null).ok, false);
  assert.match(normalizeAdapterAccounting(null).error, /adapter_state_snapshot must be an object/);

  const issueResult = normalizeIssueAccounting({ state: STATE_RUNNING });
  assert.equal(issueResult.ok, false);
  assert.match(issueResult.error, /positive issue_number/);

  const snapshotResult = collectSnapshotAccounting({ issues: [] });
  assert.equal(snapshotResult.ok, false);
  assert.match(snapshotResult.error, /issues must be an object/);
});

test("issue accounting preserves terminal metadata and adapter unknown fields", () => {
  const adapterStateSnapshot = {
    thread_id: "thread-1",
    turn_id: "turn-1",
    terminal_status: "failure",
    terminal_reason: "read_timeout",
    future_payload: {
      still_here: true
    }
  };

  const normalized = normalizeIssueAccounting({
    issue_number: 42,
    terminal_status: "success",
    terminal_reason: "turn_completed",
    adapter_state_snapshot: adapterStateSnapshot
  });

  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.session, {
    issue_number: 42,
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: null,
    turn_count: null,
    last_protocol_event: null,
    last_protocol_event_at: null,
    terminal_status: "success",
    terminal_reason: "turn_completed"
  });
  assert.deepEqual(normalized.adapter_state_snapshot.future_payload, {
    still_here: true
  });
});

test("snapshot accounting collects sessions, token usage, rate limits, and event counts", () => {
  const adapterStateSnapshot = {
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    turn_count: 1,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: "2026-05-02T21:59:55.000Z",
    terminal_status: "success",
    terminal_reason: "turn_completed",
    token_usage: {
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3
    },
    rate_limits: {
      requests_remaining: 99
    },
    adapter_events: [{ event: "session_started" }, { event: "turn_completed" }],
    protocol_events: [{ method: "turn/completed" }]
  };
  const snapshot = {
    codex_totals: {
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      seconds_running: 40
    },
    codex_rate_limits: {
      requests_remaining: 88
    },
    issues: {
      "7": {
        issue_number: 7,
        terminal_status: "success",
        terminal_reason: "turn_completed",
        adapter_state_snapshot: adapterStateSnapshot
      }
    }
  };

  const result = collectSnapshotAccounting(snapshot);

  assert.equal(result.ok, true);
  assert.deepEqual(result.accounting.manifest_codex_totals, snapshot.codex_totals);
  assert.deepEqual(result.accounting.manifest_rate_limits, snapshot.codex_rate_limits);
  assert.deepEqual(result.accounting.sessions[0], {
    issue_number: 7,
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    turn_count: 1,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: "2026-05-02T21:59:55.000Z",
    terminal_status: "success",
    terminal_reason: "turn_completed"
  });
  assert.deepEqual(result.accounting.token_usage_by_issue[0], {
    issue_number: 7,
    token_usage: adapterStateSnapshot.token_usage
  });
  assert.deepEqual(result.accounting.rate_limits_by_issue[0], {
    issue_number: 7,
    rate_limits: adapterStateSnapshot.rate_limits
  });
  assert.deepEqual(result.accounting.adapter_event_counts_by_issue[0], {
    issue_number: 7,
    adapter_events_count: 2,
    protocol_events_count: 1
  });
});

test("status snapshot reports the same accounting shape through the helper", () => {
  const adapterStateSnapshot = {
    owner: "codex",
    pid: 1234,
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    turn_count: 2,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: "2026-05-02T21:59:55.000Z",
    terminal_status: "success",
    terminal_reason: "turn_completed",
    token_usage: {
      input_tokens: 5,
      output_tokens: 7,
      total_tokens: 12,
      raw_total_token_usage: {
        prompt: 5,
        completion: 7
      }
    },
    rate_limits: {
      requests_remaining: 12,
      raw_window: {
        reset_seconds: 30
      }
    },
    adapter_events_count: 4,
    protocol_events_count: 9,
    future_payload: {
      keep: true
    }
  };
  const snapshot = combineSnapshots([
    issueSnapshot({
      issueNumber: 30,
      state: STATE_RUNNING,
      adapterStateSnapshot
    })
  ]);

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW });

  assert.equal(status.ok, true);
  assert.deepEqual(status.accounting.sessions[0], {
    issue_number: 30,
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    turn_count: 2,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: "2026-05-02T21:59:55.000Z",
    terminal_status: "success",
    terminal_reason: "turn_completed"
  });
  assert.deepEqual(status.accounting.token_usage_by_issue[0], {
    issue_number: 30,
    token_usage: adapterStateSnapshot.token_usage
  });
  assert.deepEqual(status.accounting.rate_limits_by_issue[0], {
    issue_number: 30,
    rate_limits: adapterStateSnapshot.rate_limits
  });
  assert.deepEqual(status.accounting.adapter_event_counts_by_issue[0], {
    issue_number: 30,
    adapter_events_count: 4,
    protocol_events_count: 9
  });
  assert.deepEqual(status.running[0].adapter_state_snapshot.future_payload, {
    keep: true
  });
});

function issueSnapshot({
  issueNumber,
  state,
  generatedAt = RUN_STARTED,
  title = `Issue ${issueNumber}`,
  attempt = 1,
  reason = "test_reason",
  terminalStatus,
  terminalReason,
  adapterStateSnapshot = null,
  retry = null
}) {
  return createOrchestratorStateSnapshot({
    generatedAt,
    issueNumber,
    state,
    title,
    branchName: `symphony/issue-${issueNumber}`,
    worktreePath: `.symphony/worktrees/issue-${issueNumber}`,
    logPath: `.symphony/logs/issue-${issueNumber}.jsonl`,
    manifestPath: `.symphony/state/manifests/issue-${issueNumber}.json`,
    attempt,
    reason,
    terminalStatus,
    terminalReason,
    adapterStateSnapshot,
    retry
  });
}

function combineSnapshots(partials, overrides = {}) {
  return validateOrchestratorStateSnapshot({
    manifest_kind: ORCHESTRATOR_STATE_MANIFEST_KIND,
    orchestrator_state_version: ORCHESTRATOR_STATE_MANIFEST_VERSION,
    generated_at: RUN_STARTED,
    repo: null,
    lock: null,
    issues: Object.assign({}, ...partials.map((snapshot) => snapshot.issues)),
    retry_attempts: Object.assign({}, ...partials.map((snapshot) => snapshot.retry_attempts)),
    state_transitions: partials.flatMap((snapshot) => snapshot.state_transitions || []),
    codex_totals: {
      input_tokens: 100,
      output_tokens: 40,
      total_tokens: 140,
      seconds_running: 12
    },
    codex_rate_limits: {
      requests_remaining: 90
    },
    last_outcome: null,
    ...overrides
  });
}
