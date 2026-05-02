import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAdapterTerminal,
  DEFAULT_MAX_ATTEMPTS,
  EVENT_ADAPTER_PROGRESS,
  EVENT_ADAPTER_STARTED,
  EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
  EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
  EVENT_ADAPTER_TERMINAL_SUCCESS,
  EVENT_CLAIM_ACCEPTED,
  EVENT_CLEANUP_COMPLETE,
  EVENT_ELIGIBILITY_DETECTED,
  EVENT_HUMAN_FIXED_BLOCKED_ISSUE,
  EVENT_RECONCILIATION_INELIGIBLE,
  EVENT_RETRY_DUE,
  EVENT_RETRY_EXHAUSTED,
  EVENT_STALE_DETECTED,
  EVENT_STALE_RECOVERY_BLOCKED,
  EVENT_WORKSPACE_PREPARED,
  isRetryableFailure,
  isTerminalFailure,
  ORCHESTRATOR_EVENTS,
  ORCHESTRATOR_STATES,
  reduceOrchestratorState,
  retryBackoffMs,
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

function transition(state, event, context = {}) {
  return reduceOrchestratorState(state, event, context);
}

function assertTransition(result, { from, to, reason, terminal = false }) {
  assert.equal(result.from, from);
  assert.equal(result.to, to);
  assert.equal(result.reason, reason);
  assert.equal(result.terminal, terminal);
  assert.ok(Array.isArray(result.actions));
  assert.ok(Array.isArray(result.durableWrites));
}

test("exports the orchestrator states and events required by the ADR", () => {
  assert.deepEqual(Object.values(ORCHESTRATOR_STATES), [
    STATE_ELIGIBLE,
    STATE_CLAIMED,
    STATE_RUNNING,
    STATE_RETRY_WAIT,
    STATE_BLOCKED,
    STATE_HUMAN_REVIEW,
    STATE_RELEASED,
    STATE_STALE,
    STATE_CANCELLED
  ]);

  assert.deepEqual(Object.values(ORCHESTRATOR_EVENTS), [
    EVENT_ELIGIBILITY_DETECTED,
    EVENT_CLAIM_ACCEPTED,
    EVENT_WORKSPACE_PREPARED,
    EVENT_ADAPTER_STARTED,
    EVENT_ADAPTER_PROGRESS,
    EVENT_ADAPTER_TERMINAL_SUCCESS,
    EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
    EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
    EVENT_RECONCILIATION_INELIGIBLE,
    EVENT_RETRY_DUE,
    EVENT_RETRY_EXHAUSTED,
    EVENT_STALE_DETECTED,
    EVENT_STALE_RECOVERY_BLOCKED,
    EVENT_HUMAN_FIXED_BLOCKED_ISSUE,
    EVENT_CLEANUP_COMPLETE
  ]);
});

test("released or eligible issue can be claimed when eligibility is detected", () => {
  for (const from of [STATE_RELEASED, STATE_ELIGIBLE]) {
    const result = transition(from, EVENT_ELIGIBILITY_DETECTED);

    assertTransition(result, {
      from,
      to: STATE_CLAIMED,
      reason: EVENT_ELIGIBILITY_DETECTED
    });
    assert.deepEqual(result.actions, ["reserve_claim", "validate_workspace_path"]);
    assert.deepEqual(result.durableWrites, ["manifest_planned_issue", "state_snapshot_claimed"]);
  }
});

test("claim acceptance records future label and workpad intents without side effects", () => {
  const result = transition(STATE_CLAIMED, EVENT_CLAIM_ACCEPTED);

  assertTransition(result, {
    from: STATE_CLAIMED,
    to: STATE_CLAIMED,
    reason: EVENT_CLAIM_ACCEPTED
  });
  assert.deepEqual(result.actions, [
    "apply_claim_label_transition",
    "write_claim_workpad",
    "create_log_path"
  ]);
  assert.deepEqual(result.durableWrites, ["github_labels", "workpad_claimed", "manifest_claim_event"]);
});

test("claimed issue moves to running after workspace preparation", () => {
  const result = transition(STATE_CLAIMED, EVENT_WORKSPACE_PREPARED);

  assertTransition(result, {
    from: STATE_CLAIMED,
    to: STATE_RUNNING,
    reason: EVENT_WORKSPACE_PREPARED
  });
  assert.deepEqual(result.actions, ["record_workspace_prepared", "prepare_adapter_launch"]);
  assert.deepEqual(result.durableWrites, [
    "manifest_attempt_phase",
    "workpad_running",
    "state_snapshot_running"
  ]);
});

test("running issue records adapter start and progress as non-terminal self transitions", () => {
  const started = transition(STATE_RUNNING, EVENT_ADAPTER_STARTED);
  assertTransition(started, {
    from: STATE_RUNNING,
    to: STATE_RUNNING,
    reason: EVENT_ADAPTER_STARTED
  });
  assert.deepEqual(started.durableWrites, ["jsonl_log", "state_snapshot_running", "manifest_phase"]);

  const progress = transition(STATE_RUNNING, EVENT_ADAPTER_PROGRESS);
  assertTransition(progress, {
    from: STATE_RUNNING,
    to: STATE_RUNNING,
    reason: EVENT_ADAPTER_PROGRESS
  });
  assert.deepEqual(progress.actions, ["update_last_event", "update_token_totals", "update_rate_limits"]);
});

test("running issue moves to human review only on successful terminal taxonomy", () => {
  const result = transition(STATE_RUNNING, EVENT_ADAPTER_TERMINAL_SUCCESS, {
    terminal_status: "success",
    terminal_reason: "turn_completed"
  });

  assertTransition(result, {
    from: STATE_RUNNING,
    to: STATE_HUMAN_REVIEW,
    reason: "turn_completed",
    terminal: true
  });
  assert.deepEqual(result.actions, ["stop_adapter", "clear_running_claim", "transition_to_human_review"]);
  assert.deepEqual(result.durableWrites, [
    "github_human_review_label",
    "workpad_human_review",
    "manifest_success"
  ]);
});

test("running success event fails closed when terminal taxonomy is not success", () => {
  const result = transition(STATE_RUNNING, EVENT_ADAPTER_TERMINAL_SUCCESS, {
    terminal_status: "failure",
    terminal_reason: "turn_failed"
  });

  assertTransition(result, {
    from: STATE_RUNNING,
    to: STATE_BLOCKED,
    reason: "terminal_success_without_success_taxonomy",
    terminal: true
  });
  assert.deepEqual(result.durableWrites, [
    "github_blocked_label",
    "workpad_blocked",
    "manifest_terminal_taxonomy_mismatch"
  ]);
});

test("running issue moves to retry wait on retryable adapter failure", () => {
  const result = transition(STATE_RUNNING, EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE, {
    reason: "read_timeout",
    retryAttempt: 2
  });

  assertTransition(result, {
    from: STATE_RUNNING,
    to: STATE_RETRY_WAIT,
    reason: "read_timeout"
  });
  assert.deepEqual(result.actions, ["stop_adapter", "schedule_retry"]);
  assert.deepEqual(result.durableWrites, ["retry_entry", "workpad_retry_wait", "manifest_retry_due_time"]);
  assert.deepEqual(result.retry, {
    attempt: 2,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    delayMs: 20000,
    reason: "read_timeout"
  });
});

test("retry wait can claim again only when retry due issue is still eligible", () => {
  const result = transition(STATE_RETRY_WAIT, EVENT_RETRY_DUE, {
    issueEligible: true
  });

  assertTransition(result, {
    from: STATE_RETRY_WAIT,
    to: STATE_CLAIMED,
    reason: EVENT_RETRY_DUE
  });
  assert.deepEqual(result.actions, ["move_retry_to_claimed", "refresh_issue_snapshot"]);
  assert.equal(result.retry, null);
});

test("retry due while ineligible releases the claim instead of dispatching", () => {
  const result = transition(STATE_RETRY_WAIT, EVENT_RETRY_DUE, {
    issueEligible: false
  });

  assertTransition(result, {
    from: STATE_RETRY_WAIT,
    to: STATE_RELEASED,
    reason: "retry_due_ineligible",
    terminal: true
  });
  assert.deepEqual(result.actions, ["cancel_retry_timer", "release_claim"]);
  assert.deepEqual(result.durableWrites, ["manifest_retry_released", "state_snapshot_released"]);
});

test("running issue moves to blocked on terminal adapter failure", () => {
  const result = transition(STATE_RUNNING, EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE, {
    reason: "turn_input_required"
  });

  assertTransition(result, {
    from: STATE_RUNNING,
    to: STATE_BLOCKED,
    reason: "turn_input_required",
    terminal: true
  });
  assert.deepEqual(result.actions, ["stop_adapter", "clear_running_claim", "block_issue"]);
  assert.deepEqual(result.durableWrites, [
    "github_blocked_label",
    "workpad_blocked",
    "manifest_terminal_failure"
  ]);
});

test("reconciliation ineligibility cancels a running issue for future cleanup", () => {
  const result = transition(STATE_RUNNING, EVENT_RECONCILIATION_INELIGIBLE);

  assertTransition(result, {
    from: STATE_RUNNING,
    to: STATE_CANCELLED,
    reason: "cancelled_by_reconciliation",
    terminal: true
  });
  assert.deepEqual(result.actions, ["stop_adapter", "preserve_evidence"]);
});

test("stale detection and recovery move stale issue to blocked", () => {
  const stale = transition(STATE_RUNNING, EVENT_STALE_DETECTED);

  assertTransition(stale, {
    from: STATE_RUNNING,
    to: STATE_STALE,
    reason: EVENT_STALE_DETECTED
  });
  assert.deepEqual(stale.durableWrites, ["recovery_manifest_stale", "state_snapshot_stale"]);

  const blocked = transition(STATE_STALE, EVENT_STALE_RECOVERY_BLOCKED);
  assertTransition(blocked, {
    from: STATE_STALE,
    to: STATE_BLOCKED,
    reason: "stale_recovery_blocked",
    terminal: true
  });
  assert.deepEqual(blocked.actions, ["move_stale_issue_to_blocked", "release_stale_claim"]);
});

test("cancelled cleanup releases on success and blocks on uncertainty", () => {
  const released = transition(STATE_CANCELLED, EVENT_CLEANUP_COMPLETE);
  assertTransition(released, {
    from: STATE_CANCELLED,
    to: STATE_RELEASED,
    reason: EVENT_CLEANUP_COMPLETE,
    terminal: true
  });
  assert.deepEqual(released.actions, ["release_cancelled_claim"]);

  const blocked = transition(STATE_CANCELLED, EVENT_CLEANUP_COMPLETE, {
    cleanupOk: false
  });
  assertTransition(blocked, {
    from: STATE_CANCELLED,
    to: STATE_BLOCKED,
    reason: "cleanup_uncertain",
    terminal: true
  });
  assert.deepEqual(blocked.actions, ["block_for_manual_cleanup"]);
});

test("human-fixed blocked issue returns to eligible only when policy says it is eligible", () => {
  const eligible = transition(STATE_BLOCKED, EVENT_HUMAN_FIXED_BLOCKED_ISSUE, {
    issueEligible: true
  });
  assertTransition(eligible, {
    from: STATE_BLOCKED,
    to: STATE_ELIGIBLE,
    reason: EVENT_HUMAN_FIXED_BLOCKED_ISSUE
  });

  const released = transition(STATE_BLOCKED, EVENT_HUMAN_FIXED_BLOCKED_ISSUE, {
    issueEligible: false
  });
  assertTransition(released, {
    from: STATE_BLOCKED,
    to: STATE_RELEASED,
    reason: EVENT_HUMAN_FIXED_BLOCKED_ISSUE
  });
});

test("unknown states and events fail closed by throwing", () => {
  assert.throws(
    () => transition("unknown", EVENT_ELIGIBILITY_DETECTED),
    /unknown orchestrator state: unknown/
  );
  assert.throws(
    () => transition(STATE_RELEASED, "unknown_event"),
    /unknown orchestrator event: unknown_event/
  );
});

test("invalid direct transitions fail closed by throwing", () => {
  assert.throws(
    () => transition(STATE_RELEASED, EVENT_ADAPTER_TERMINAL_SUCCESS, {
      terminal_status: "success",
      terminal_reason: "success"
    }),
    /invalid orchestrator transition: released -> human_review/
  );
  assert.throws(
    () => transition(STATE_RELEASED, EVENT_WORKSPACE_PREPARED),
    /invalid orchestrator transition: released -> running/
  );
  assert.throws(
    () => transition(STATE_CLAIMED, EVENT_RETRY_DUE, {
      issueEligible: true
    }),
    /invalid orchestrator transition: claimed -> claimed/
  );
});

test("retry exhaustion blocks instead of scheduling another retry", () => {
  const explicit = transition(STATE_RUNNING, EVENT_RETRY_EXHAUSTED);
  assertTransition(explicit, {
    from: STATE_RUNNING,
    to: STATE_BLOCKED,
    reason: "retry_exhausted",
    terminal: true
  });

  const exhaustedRetryable = transition(STATE_RUNNING, EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE, {
    reason: "read_timeout",
    retryAttempt: DEFAULT_MAX_ATTEMPTS + 1
  });
  assertTransition(exhaustedRetryable, {
    from: STATE_RUNNING,
    to: STATE_BLOCKED,
    reason: "retry_exhausted",
    terminal: true
  });
});

test("retry backoff formula matches the ADR defaults and cap", () => {
  assert.equal(DEFAULT_MAX_ATTEMPTS, 3);
  assert.equal(retryBackoffMs(1), 10000);
  assert.equal(retryBackoffMs(2), 20000);
  assert.equal(retryBackoffMs(10), 300000);
  assert.throws(() => retryBackoffMs(0), /retry attempt must be a positive integer/);
});

test("retry classification helpers separate retryable and terminal failures", () => {
  assert.equal(isRetryableFailure("read_timeout"), true);
  assert.equal(isRetryableFailure("process_exit_before_completion"), true);
  assert.equal(isRetryableFailure("turn_input_required"), false);

  assert.equal(isTerminalFailure("turn_input_required"), true);
  assert.equal(isTerminalFailure("unsupported_tool_call"), true);
  assert.equal(isTerminalFailure("read_timeout"), false);
});

test("adapter terminal taxonomy maps to reducer event categories", () => {
  assert.deepEqual(classifyAdapterTerminal({
    terminal_status: "success",
    terminal_reason: "success"
  }), {
    category: "success",
    event: EVENT_ADAPTER_TERMINAL_SUCCESS,
    reason: "success"
  });

  assert.deepEqual(classifyAdapterTerminal({
    terminal_status: "success",
    terminal_reason: "turn_completed"
  }), {
    category: "success",
    event: EVENT_ADAPTER_TERMINAL_SUCCESS,
    reason: "turn_completed"
  });

  assert.deepEqual(classifyAdapterTerminal({
    terminal_status: "failure",
    terminal_reason: "read_timeout"
  }), {
    category: "retryable_failure",
    event: EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
    reason: "read_timeout"
  });

  assert.deepEqual(classifyAdapterTerminal({
    terminal_status: "failure",
    terminal_reason: "turn_input_required"
  }), {
    category: "terminal_failure",
    event: EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
    reason: "turn_input_required"
  });
});
