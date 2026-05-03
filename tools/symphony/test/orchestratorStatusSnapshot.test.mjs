import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CAPABILITY_CATEGORIES,
  buildCapabilitySnapshot
} from "../lib/orchestratorCapabilitySnapshot.mjs";
import {
  STATE_BLOCKED,
  STATE_CANCELLED,
  STATE_CLAIMED,
  STATE_ELIGIBLE,
  STATE_HUMAN_REVIEW,
  STATE_RELEASED,
  STATE_RETRY_WAIT,
  STATE_RUNNING,
  STATE_STALE
} from "../lib/orchestratorState.mjs";
import {
  createOrchestratorStateSnapshot,
  ORCHESTRATOR_STATE_MANIFEST_KIND,
  ORCHESTRATOR_STATE_MANIFEST_VERSION,
  validateOrchestratorStateSnapshot
} from "../lib/orchestratorStateManifest.mjs";
import { buildOrchestratorStatusSnapshot } from "../lib/orchestratorStatusSnapshot.mjs";
import { decideToolPolicy } from "../lib/orchestratorToolPolicy.mjs";

const NOW = "2026-05-02T22:00:00.000Z";
const RUN_STARTED = "2026-05-02T21:59:30.000Z";

function emptySnapshot(overrides = {}) {
  return validateOrchestratorStateSnapshot({
    manifest_kind: ORCHESTRATOR_STATE_MANIFEST_KIND,
    orchestrator_state_version: ORCHESTRATOR_STATE_MANIFEST_VERSION,
    generated_at: RUN_STARTED,
    repo: {
      head: "head-sha",
      origin_main: "origin-sha",
      clean: true
    },
    lock: {
      held: false,
      path: ".symphony/state/runner.lock"
    },
    issues: {},
    retry_attempts: {},
    state_transitions: [],
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
  const base = emptySnapshot(overrides);
  return validateOrchestratorStateSnapshot({
    ...base,
    issues: Object.assign({}, ...partials.map((snapshot) => snapshot.issues)),
    retry_attempts: Object.assign({}, ...partials.map((snapshot) => snapshot.retry_attempts)),
    state_transitions: partials.flatMap((snapshot) => snapshot.state_transitions || []),
    last_outcome: overrides.last_outcome ?? base.last_outcome
  });
}

function adapterSnapshot(overrides = {}) {
  return {
    pid: 1234,
    owner: "codex",
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    turn_count: 2,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: "2026-05-02T21:59:55.000Z",
    terminal_status: "success",
    terminal_reason: "turn_completed",
    token_usage: {
      input_tokens: 21,
      output_tokens: 8,
      total_tokens: 29
    },
    rate_limits: {
      requests_remaining: 77
    },
    ...overrides
  };
}

function tool(overrides = {}) {
  return {
    tool_id: "repo-reader",
    display_name: "Repo Reader",
    provider: "filesystem",
    source: "codex_builtin",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    available: true,
    credential_state: "none",
    approved_actions: ["read_file"],
    denied_actions: ["write_file"],
    ...overrides
  };
}

function capabilitySnapshot() {
  const result = buildCapabilitySnapshot({
    catalog_version: "codex-tools-v1",
    source: "codex_tool_catalog",
    tools: [
      tool(),
      tool({
        tool_id: "github-mutation",
        display_name: "GitHub mutation",
        provider: "github",
        category: CAPABILITY_CATEGORIES.githubMutation,
        approved_actions: ["comment_issue"],
        denied_actions: []
      }),
      tool({
        tool_id: "revoked-gmail",
        display_name: "Gmail",
        provider: "gmail",
        category: CAPABILITY_CATEGORIES.credentialConnectorWrite,
        available: false,
        availability_reason: "tool_auth_revoked",
        credential_state: "revoked",
        approved_actions: ["send_email"],
        denied_actions: []
      })
    ]
  }, { now: RUN_STARTED });
  assert.equal(result.ok, true, JSON.stringify(result.errors ?? []));
  return result;
}

test("valid multi-issue snapshot produces expected status counts", () => {
  const snapshot = combineSnapshots([
    issueSnapshot({ issueNumber: 1, state: STATE_RUNNING }),
    issueSnapshot({ issueNumber: 2, state: STATE_RETRY_WAIT, retry: retryObject(1, "2026-05-02T22:00:10.000Z") }),
    issueSnapshot({ issueNumber: 3, state: STATE_BLOCKED }),
    issueSnapshot({ issueNumber: 4, state: STATE_HUMAN_REVIEW }),
    issueSnapshot({ issueNumber: 5, state: STATE_STALE }),
    issueSnapshot({ issueNumber: 6, state: STATE_CANCELLED }),
    issueSnapshot({ issueNumber: 7, state: STATE_RELEASED }),
    issueSnapshot({ issueNumber: 8, state: STATE_ELIGIBLE }),
    issueSnapshot({ issueNumber: 9, state: STATE_CLAIMED })
  ]);

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW });

  assert.equal(status.ok, true);
  assert.equal(status.counts.total, 9);
  assert.equal(status.counts_by_state[STATE_RUNNING], 1);
  assert.equal(status.counts_by_state[STATE_RETRY_WAIT], 1);
  assert.equal(status.counts_by_state[STATE_BLOCKED], 1);
  assert.equal(status.counts_by_state[STATE_HUMAN_REVIEW], 1);
  assert.equal(status.counts_by_state[STATE_STALE], 1);
  assert.equal(status.counts_by_state[STATE_CANCELLED], 1);
  assert.equal(status.counts_by_state[STATE_RELEASED], 1);
  assert.equal(status.counts_by_state[STATE_ELIGIBLE], 1);
  assert.equal(status.counts_by_state[STATE_CLAIMED], 1);
  assert.equal(status.running.length, 1);
  assert.equal(status.retrying.length, 1);
});

test("running issue includes runtime, session, thread metadata and seconds_running", () => {
  const adapterStateSnapshot = adapterSnapshot();
  const snapshot = combineSnapshots([
    issueSnapshot({
      issueNumber: 42,
      state: STATE_RUNNING,
      generatedAt: RUN_STARTED,
      terminalStatus: "success",
      terminalReason: "turn_completed",
      adapterStateSnapshot
    })
  ]);

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW, mode: "daemon" });
  const running = status.running[0];

  assert.equal(status.mode, "daemon");
  assert.equal(running.issue_number, 42);
  assert.equal(running.owner, "codex");
  assert.equal(running.pid, 1234);
  assert.equal(running.thread_id, "thread-1");
  assert.equal(running.turn_id, "turn-1");
  assert.equal(running.session_id, "thread-1-turn-1");
  assert.equal(running.turn_count, 2);
  assert.equal(running.terminal_status, "success");
  assert.equal(running.terminal_reason, "turn_completed");
  assert.equal(running.last_protocol_event_at, "2026-05-02T21:59:55.000Z");
  assert.equal(running.seconds_running, 30);
  assert.deepEqual(running.adapter_state_snapshot, adapterStateSnapshot);
});

test("retry_wait issues classify due vs not due using injected clock", () => {
  const snapshot = combineSnapshots([
    issueSnapshot({
      issueNumber: 10,
      state: STATE_RETRY_WAIT,
      retry: retryObject(2, "2026-05-02T21:59:59.000Z", "read_timeout")
    }),
    issueSnapshot({
      issueNumber: 11,
      state: STATE_RETRY_WAIT,
      retry: retryObject(1, "2026-05-02T22:00:30.000Z", "response_timeout")
    })
  ]);

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW });

  assert.deepEqual(status.retry_due.map((retry) => retry.issue_number), [10]);
  assert.deepEqual(status.retry_not_due.map((retry) => retry.issue_number), [11]);
  assert.equal(status.retrying[0].attempt, 2);
  assert.equal(status.retrying[0].max_attempts, 3);
  assert.equal(status.retrying[0].delay_ms, 20000);
  assert.equal(status.retrying[0].due_at, "2026-05-02T21:59:59.000Z");
  assert.equal(status.retrying[0].reason, "read_timeout");
  assert.equal(status.retrying[0].last_error, "read_timeout");
});

test("terminal, human review, blocked, stale, cancelled, and released states summarize correctly", () => {
  const snapshot = combineSnapshots([
    issueSnapshot({
      issueNumber: 20,
      state: STATE_BLOCKED,
      terminalStatus: "failure",
      terminalReason: "turn_failed"
    }),
    issueSnapshot({
      issueNumber: 21,
      state: STATE_HUMAN_REVIEW,
      terminalStatus: "success",
      terminalReason: "turn_completed"
    }),
    issueSnapshot({ issueNumber: 22, state: STATE_STALE, reason: "heartbeat_stale" }),
    issueSnapshot({ issueNumber: 23, state: STATE_CANCELLED, reason: "workflow_drift" }),
    issueSnapshot({ issueNumber: 24, state: STATE_RELEASED, reason: "cleanup_complete" })
  ]);

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW });

  assert.equal(status.blocked[0].terminal_status, "failure");
  assert.equal(status.blocked[0].terminal_reason, "turn_failed");
  assert.equal(status.human_review[0].terminal_status, "success");
  assert.equal(status.stale[0].reason, "heartbeat_stale");
  assert.equal(status.cancelled[0].reason, "workflow_drift");
  assert.equal(status.released[0].reason, "cleanup_complete");
});

test("token, rate, and session accounting preserves manifest and adapter fields", () => {
  const adapterStateSnapshot = adapterSnapshot({
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
    }
  });
  const snapshot = combineSnapshots([
    issueSnapshot({
      issueNumber: 30,
      state: STATE_RUNNING,
      adapterStateSnapshot
    })
  ]);

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW });

  assert.deepEqual(status.codex_totals, {
    input_tokens: 100,
    output_tokens: 40,
    total_tokens: 140,
    seconds_running: 12
  });
  assert.deepEqual(status.rate_limits, { requests_remaining: 90 });
  assert.deepEqual(status.accounting.manifest_codex_totals, status.codex_totals);
  assert.deepEqual(status.accounting.manifest_rate_limits, status.rate_limits);
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
});

test("unknown adapter snapshot fields pass through without reinterpretation", () => {
  const adapterStateSnapshot = adapterSnapshot({
    future_payload: {
      nested: true,
      value: 123
    }
  });
  const snapshot = combineSnapshots([
    issueSnapshot({
      issueNumber: 40,
      state: STATE_RUNNING,
      adapterStateSnapshot
    })
  ]);

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW });

  assert.deepEqual(status.running[0].adapter_state_snapshot.future_payload, {
    nested: true,
    value: 123
  });
});

test("status snapshot reports capability fingerprint and counts", () => {
  const capabilities = capabilitySnapshot();
  const snapshot = emptySnapshot({
    capability_snapshot: capabilities
  });

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW });

  assert.equal(status.ok, true);
  assert.deepEqual(status.tooling.capability_snapshot, {
    present: true,
    fingerprint: capabilities.fingerprint,
    catalog_version: "codex-tools-v1",
    generated_at: RUN_STARTED,
    unavailable_tool_count: 1,
    approval_required_tool_count: 2,
    counts_by_category: snapshot.capability_snapshot.counts_by_category,
    counts_by_risk: snapshot.capability_snapshot.counts_by_risk
  });
});

test("status snapshot reports recent blocked reasons and allowed categories", () => {
  const capabilities = capabilitySnapshot();
  const allowed = decideToolPolicy(capabilities, {
    tool_id: "repo-reader",
    action: "read_file",
    category: CAPABILITY_CATEGORIES.repoFileRead
  });
  const blocked = decideToolPolicy(capabilities, {
    tool_id: "github-mutation",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    context: {
      operation: "comment_issue",
      target_environment: "local"
    }
  });
  const snapshot = emptySnapshot({
    capability_snapshot: capabilities,
    tool_policy_decisions: [allowed, blocked]
  });

  const status = buildOrchestratorStatusSnapshot(snapshot, { now: NOW });

  assert.equal(status.tooling.tool_policy.decision_count, 2);
  assert.equal(status.tooling.tool_policy.allowed_count, 1);
  assert.equal(status.tooling.tool_policy.blocked_count, 1);
  assert.deepEqual(status.tooling.tool_policy.recent_blocked_reasons, [{
    tool_id: "github-mutation",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    reason: "tool_approval_required"
  }]);
  assert.deepEqual(status.tooling.tool_policy.recent_allowed_categories, [
    CAPABILITY_CATEGORIES.repoFileRead
  ]);
});

test("malformed snapshot fails closed", () => {
  const status = buildOrchestratorStatusSnapshot({
    manifest_kind: ORCHESTRATOR_STATE_MANIFEST_KIND,
    orchestrator_state_version: ORCHESTRATOR_STATE_MANIFEST_VERSION,
    generated_at: RUN_STARTED,
    issues: [],
    retry_attempts: {},
    state_transitions: [],
    codex_totals: {}
  }, { now: NOW });

  assert.equal(status.ok, false);
  assert.equal(status.reason, "orchestrator_status_snapshot_failed");
  assert.match(status.error, /issues must be an object/);
});

test("malformed tool evidence fails closed without throwing from status builder", () => {
  const snapshot = emptySnapshot();
  const status = buildOrchestratorStatusSnapshot({
    ...snapshot,
    tool_policy_decisions: [{
      tool_id: "repo-reader",
      action: "read_file",
      category: CAPABILITY_CATEGORIES.repoFileRead,
      allowed: "yes",
      reason: "tool_allowed"
    }]
  }, { now: NOW });

  assert.equal(status.ok, false);
  assert.equal(status.reason, "orchestrator_status_snapshot_failed");
  assert.match(status.error, /tool_policy_decisions\.0\.allowed must be a boolean/);
});

test("invalid injected clock fails closed", () => {
  const status = buildOrchestratorStatusSnapshot(emptySnapshot(), { now: "not-a-date" });

  assert.equal(status.ok, false);
  assert.equal(status.reason, "orchestrator_status_snapshot_failed");
  assert.match(status.error, /now must be a valid timestamp/);
});

test("empty no-work snapshot is valid and reports zero counts", () => {
  const status = buildOrchestratorStatusSnapshot(emptySnapshot(), { now: NOW });

  assert.equal(status.ok, true);
  assert.equal(status.counts.total, 0);
  assert.deepEqual(status.running, []);
  assert.deepEqual(status.retrying, []);
  assert.equal(status.counts_by_state[STATE_RUNNING], 0);
  assert.equal(status.counts_by_state[STATE_RETRY_WAIT], 0);
  assert.deepEqual(status.accounting.sessions, []);
  assert.equal(status.tooling.capability_snapshot.present, false);
  assert.equal(status.tooling.tool_policy.decision_count, 0);
});

test("tool evidence plumbing does not import runner, CLI, or execution modules", () => {
  for (const modulePath of [
    "../lib/orchestratorStateManifest.mjs",
    "../lib/orchestratorStatusSnapshot.mjs",
    "../lib/orchestratorToolEvidence.mjs"
  ]) {
    const source = readFileSync(new URL(modulePath, import.meta.url), "utf8");

    assert.doesNotMatch(source, /node:child_process|node:net|node:http|node:https/);
    assert.doesNotMatch(source, /runner\.mjs|cli\.mjs|github\.mjs|codexAdapter\.mjs|codexAppServerAdapter\.mjs/);
  }
});

function retryObject(attempt, dueAt, reason = "read_timeout") {
  return {
    attempt,
    maxAttempts: 3,
    delayMs: attempt * 10000,
    dueAt,
    reason,
    lastError: reason
  };
}
