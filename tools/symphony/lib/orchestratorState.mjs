export const STATE_ELIGIBLE = "eligible";
export const STATE_CLAIMED = "claimed";
export const STATE_RUNNING = "running";
export const STATE_RETRY_WAIT = "retry_wait";
export const STATE_BLOCKED = "blocked";
export const STATE_HUMAN_REVIEW = "human_review";
export const STATE_RELEASED = "released";
export const STATE_STALE = "stale";
export const STATE_CANCELLED = "cancelled";

export const ORCHESTRATOR_STATES = Object.freeze({
  eligible: STATE_ELIGIBLE,
  claimed: STATE_CLAIMED,
  running: STATE_RUNNING,
  retryWait: STATE_RETRY_WAIT,
  blocked: STATE_BLOCKED,
  humanReview: STATE_HUMAN_REVIEW,
  released: STATE_RELEASED,
  stale: STATE_STALE,
  cancelled: STATE_CANCELLED
});

export const EVENT_ELIGIBILITY_DETECTED = "eligibility_detected";
export const EVENT_CLAIM_ACCEPTED = "claim_accepted";
export const EVENT_WORKSPACE_PREPARED = "workspace_prepared";
export const EVENT_ADAPTER_STARTED = "adapter_started";
export const EVENT_ADAPTER_PROGRESS = "adapter_progress";
export const EVENT_ADAPTER_TERMINAL_SUCCESS = "adapter_terminal_success";
export const EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE = "adapter_terminal_retryable_failure";
export const EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE = "adapter_terminal_nonretryable_failure";
export const EVENT_RECONCILIATION_INELIGIBLE = "reconciliation_ineligible";
export const EVENT_RETRY_DUE = "retry_due";
export const EVENT_RETRY_EXHAUSTED = "retry_exhausted";
export const EVENT_STALE_DETECTED = "stale_detected";
export const EVENT_STALE_RECOVERY_BLOCKED = "stale_recovery_blocked";
export const EVENT_HUMAN_FIXED_BLOCKED_ISSUE = "human_fixed_blocked_issue";
export const EVENT_CLEANUP_COMPLETE = "cleanup_complete";

export const ORCHESTRATOR_EVENTS = Object.freeze({
  eligibilityDetected: EVENT_ELIGIBILITY_DETECTED,
  claimAccepted: EVENT_CLAIM_ACCEPTED,
  workspacePrepared: EVENT_WORKSPACE_PREPARED,
  adapterStarted: EVENT_ADAPTER_STARTED,
  adapterProgress: EVENT_ADAPTER_PROGRESS,
  adapterTerminalSuccess: EVENT_ADAPTER_TERMINAL_SUCCESS,
  adapterTerminalRetryableFailure: EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
  adapterTerminalNonretryableFailure: EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
  reconciliationIneligible: EVENT_RECONCILIATION_INELIGIBLE,
  retryDue: EVENT_RETRY_DUE,
  retryExhausted: EVENT_RETRY_EXHAUSTED,
  staleDetected: EVENT_STALE_DETECTED,
  staleRecoveryBlocked: EVENT_STALE_RECOVERY_BLOCKED,
  humanFixedBlockedIssue: EVENT_HUMAN_FIXED_BLOCKED_ISSUE,
  cleanupComplete: EVENT_CLEANUP_COMPLETE
});

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_BASE_DELAY_MS = 10000;
export const DEFAULT_MAX_RETRY_BACKOFF_MS = 300000;

export const SUCCESS_TERMINAL_REASONS = Object.freeze([
  "success",
  "turn_completed"
]);

export const RETRYABLE_FAILURE_REASONS = Object.freeze([
  "response_timeout",
  "read_timeout",
  "turn_timeout",
  "process_exit_before_completion",
  "stall_timeout",
  "codex_startup_timeout",
  "workspace_prepare_failed",
  "temporary_github_read_failure",
  "no_available_orchestrator_slots"
]);

export const TERMINAL_FAILURE_REASONS = Object.freeze([
  "event_callback_error",
  "invalid_workflow_config",
  "json_rpc_error",
  "log_write_error",
  "missing_acceptance_criteria",
  "missing_approval",
  "missing_approved_write_set",
  "protocol_parse_error",
  "retry_exhausted",
  "turn_cancelled",
  "turn_failed",
  "turn_input_required",
  "unsupported_tool_call",
  "write_set_drift"
]);

const KNOWN_STATES = new Set(Object.values(ORCHESTRATOR_STATES));
const KNOWN_EVENTS = new Set(Object.values(ORCHESTRATOR_EVENTS));
const SUCCESS_REASONS = new Set(SUCCESS_TERMINAL_REASONS);
const RETRYABLE_REASONS = new Set(RETRYABLE_FAILURE_REASONS);
const TERMINAL_REASONS = new Set(TERMINAL_FAILURE_REASONS);

export function isRetryableFailure(reason) {
  return RETRYABLE_REASONS.has(String(reason || ""));
}

export function isTerminalFailure(reason) {
  return TERMINAL_REASONS.has(String(reason || ""));
}

export function retryBackoffMs(attempt, maxBackoffMs = DEFAULT_MAX_RETRY_BACKOFF_MS) {
  const numericAttempt = Number(attempt);
  if (!Number.isInteger(numericAttempt) || numericAttempt < 1) {
    throw new Error("retry attempt must be a positive integer");
  }
  const numericMaxBackoff = Number(maxBackoffMs);
  if (!Number.isFinite(numericMaxBackoff) || numericMaxBackoff < 1) {
    throw new Error("max retry backoff must be a positive number");
  }
  return Math.min(DEFAULT_RETRY_BASE_DELAY_MS * (2 ** (numericAttempt - 1)), numericMaxBackoff);
}

export function classifyAdapterTerminal(adapterResult = {}) {
  const terminalStatus = adapterResult.terminal_status || adapterResult.terminalStatus;
  const terminalReason = adapterResult.terminal_reason || adapterResult.terminalReason || adapterResult.reason;

  if (terminalStatus === "success" && SUCCESS_REASONS.has(String(terminalReason || ""))) {
    return {
      category: "success",
      event: EVENT_ADAPTER_TERMINAL_SUCCESS,
      reason: terminalReason || "success"
    };
  }

  if (terminalStatus === "failure" && isRetryableFailure(terminalReason)) {
    return {
      category: "retryable_failure",
      event: EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
      reason: terminalReason
    };
  }

  if (terminalStatus === "failure" && isTerminalFailure(terminalReason)) {
    return {
      category: "terminal_failure",
      event: EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
      reason: terminalReason
    };
  }

  return {
    category: "terminal_failure",
    event: EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
    reason: terminalReason || "unknown_adapter_terminal"
  };
}

export function reduceOrchestratorState(currentState, event, context = {}) {
  const eventType = typeof event === "string" ? event : event?.type;
  assertKnownState(currentState);
  assertKnownEvent(eventType);

  switch (eventType) {
    case EVENT_ELIGIBILITY_DETECTED:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_RELEASED, STATE_ELIGIBLE],
        to: STATE_CLAIMED,
        reason: context.reason || EVENT_ELIGIBILITY_DETECTED,
        actions: ["reserve_claim", "validate_workspace_path"],
        durableWrites: ["manifest_planned_issue", "state_snapshot_claimed"]
      });

    case EVENT_CLAIM_ACCEPTED:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_ELIGIBLE, STATE_CLAIMED],
        to: STATE_CLAIMED,
        reason: context.reason || EVENT_CLAIM_ACCEPTED,
        actions: ["apply_claim_label_transition", "write_claim_workpad", "create_log_path"],
        durableWrites: ["github_labels", "workpad_claimed", "manifest_claim_event"]
      });

    case EVENT_WORKSPACE_PREPARED:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_CLAIMED],
        to: STATE_RUNNING,
        reason: context.reason || EVENT_WORKSPACE_PREPARED,
        actions: ["record_workspace_prepared", "prepare_adapter_launch"],
        durableWrites: ["manifest_attempt_phase", "workpad_running", "state_snapshot_running"]
      });

    case EVENT_ADAPTER_STARTED:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_RUNNING],
        to: STATE_RUNNING,
        reason: context.reason || EVENT_ADAPTER_STARTED,
        actions: ["record_adapter_session", "stream_adapter_events"],
        durableWrites: ["jsonl_log", "state_snapshot_running", "manifest_phase"]
      });

    case EVENT_ADAPTER_PROGRESS:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_RUNNING],
        to: STATE_RUNNING,
        reason: context.reason || EVENT_ADAPTER_PROGRESS,
        actions: ["update_last_event", "update_token_totals", "update_rate_limits"],
        durableWrites: ["state_snapshot_running"]
      });

    case EVENT_ADAPTER_TERMINAL_SUCCESS:
      return reduceAdapterSuccess(currentState, event, context);

    case EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE:
      return reduceRetryableFailure(currentState, event, context);

    case EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_RUNNING],
        to: STATE_BLOCKED,
        reason: eventReason(event, context, "terminal_adapter_failure"),
        actions: ["stop_adapter", "clear_running_claim", "block_issue"],
        durableWrites: ["github_blocked_label", "workpad_blocked", "manifest_terminal_failure"],
        terminal: true
      });

    case EVENT_RECONCILIATION_INELIGIBLE:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_RUNNING],
        to: STATE_CANCELLED,
        reason: context.reason || "cancelled_by_reconciliation",
        actions: ["stop_adapter", "preserve_evidence"],
        durableWrites: ["workpad_cancelled", "manifest_cancelled_by_reconciliation", "state_snapshot_cancelled"],
        terminal: true
      });

    case EVENT_RETRY_DUE:
      return reduceRetryDue(currentState, context);

    case EVENT_RETRY_EXHAUSTED:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_RUNNING, STATE_RETRY_WAIT],
        to: STATE_BLOCKED,
        reason: context.reason || "retry_exhausted",
        actions: ["clear_retry", "block_issue"],
        durableWrites: ["github_blocked_label", "workpad_blocked", "manifest_retry_exhausted"],
        terminal: true
      });

    case EVENT_STALE_DETECTED:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_RUNNING, STATE_RETRY_WAIT],
        to: STATE_STALE,
        reason: context.reason || EVENT_STALE_DETECTED,
        actions: ["assess_stale_claim", "preserve_recovery_evidence"],
        durableWrites: ["recovery_manifest_stale", "state_snapshot_stale"]
      });

    case EVENT_STALE_RECOVERY_BLOCKED:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_STALE],
        to: STATE_BLOCKED,
        reason: context.reason || "stale_recovery_blocked",
        actions: ["move_stale_issue_to_blocked", "release_stale_claim"],
        durableWrites: ["github_blocked_label", "workpad_blocked", "recovery_manifest_blocked"],
        terminal: true
      });

    case EVENT_HUMAN_FIXED_BLOCKED_ISSUE:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_BLOCKED],
        to: context.issueEligible ? STATE_ELIGIBLE : STATE_RELEASED,
        reason: context.reason || EVENT_HUMAN_FIXED_BLOCKED_ISSUE,
        actions: ["release_blocked_claim", "await_future_eligibility"],
        durableWrites: [
          "manifest_human_fix_observed",
          context.issueEligible ? "state_snapshot_eligible" : "state_snapshot_released"
        ]
      });

    case EVENT_CLEANUP_COMPLETE:
      return requireTransition({
        from: currentState,
        allowedFrom: [STATE_CANCELLED],
        to: context.cleanupOk === false ? STATE_BLOCKED : STATE_RELEASED,
        reason: context.cleanupOk === false ? "cleanup_uncertain" : context.reason || EVENT_CLEANUP_COMPLETE,
        actions: context.cleanupOk === false ? ["block_for_manual_cleanup"] : ["release_cancelled_claim"],
        durableWrites: context.cleanupOk === false
          ? ["github_blocked_label", "workpad_blocked", "manifest_cleanup_uncertain"]
          : ["manifest_cancellation_outcome", "state_snapshot_released"],
        terminal: true
      });

    default:
      throw new Error(`unhandled orchestrator event: ${eventType}`);
  }
}

function assertKnownState(state) {
  if (!KNOWN_STATES.has(state)) {
    throw new Error(`unknown orchestrator state: ${state}`);
  }
}

function assertKnownEvent(event) {
  if (!KNOWN_EVENTS.has(event)) {
    throw new Error(`unknown orchestrator event: ${event}`);
  }
}

function requireTransition({
  from,
  allowedFrom,
  to,
  reason,
  actions = [],
  durableWrites = [],
  retry = null,
  terminal = false
}) {
  if (!allowedFrom.includes(from)) {
    throw new Error(`invalid orchestrator transition: ${from} -> ${to}`);
  }
  return {
    from,
    to,
    actions,
    durableWrites,
    reason,
    retry,
    terminal
  };
}

function reduceAdapterSuccess(currentState, event, context) {
  const terminalStatus = event?.terminal_status || context.terminal_status || context.terminalStatus;
  const terminalReason = eventReason(event, context, "success");
  if (terminalStatus !== "success" || !SUCCESS_REASONS.has(String(terminalReason))) {
    return requireTransition({
      from: currentState,
      allowedFrom: [STATE_RUNNING],
      to: STATE_BLOCKED,
      reason: "terminal_success_without_success_taxonomy",
      actions: ["stop_adapter", "clear_running_claim", "block_issue"],
      durableWrites: ["github_blocked_label", "workpad_blocked", "manifest_terminal_taxonomy_mismatch"],
      terminal: true
    });
  }
  return requireTransition({
    from: currentState,
    allowedFrom: [STATE_RUNNING],
    to: STATE_HUMAN_REVIEW,
    reason: terminalReason,
    actions: ["stop_adapter", "clear_running_claim", "transition_to_human_review"],
    durableWrites: ["github_human_review_label", "workpad_human_review", "manifest_success"],
    terminal: true
  });
}

function reduceRetryableFailure(currentState, event, context) {
  const reason = eventReason(event, context, "retryable_adapter_failure");
  const attempt = positiveInteger(context.retryAttempt ?? context.attempt ?? 1, "retry attempt");
  const maxAttempts = positiveInteger(context.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, "max attempts");

  if (attempt > maxAttempts) {
    return requireTransition({
      from: currentState,
      allowedFrom: [STATE_RUNNING],
      to: STATE_BLOCKED,
      reason: "retry_exhausted",
      actions: ["stop_adapter", "clear_running_claim", "block_issue"],
      durableWrites: ["github_blocked_label", "workpad_blocked", "manifest_retry_exhausted"],
      terminal: true
    });
  }

  const retry = {
    attempt,
    maxAttempts,
    delayMs: retryBackoffMs(attempt, context.maxBackoffMs ?? DEFAULT_MAX_RETRY_BACKOFF_MS),
    reason
  };

  return requireTransition({
    from: currentState,
    allowedFrom: [STATE_RUNNING],
    to: STATE_RETRY_WAIT,
    reason,
    actions: ["stop_adapter", "schedule_retry"],
    durableWrites: ["retry_entry", "workpad_retry_wait", "manifest_retry_due_time"],
    retry
  });
}

function reduceRetryDue(currentState, context) {
  if (currentState !== STATE_RETRY_WAIT) {
    throw new Error(`invalid orchestrator transition: ${currentState} -> ${STATE_CLAIMED}`);
  }
  if (!context.issueEligible) {
    return {
      from: currentState,
      to: STATE_RELEASED,
      actions: ["cancel_retry_timer", "release_claim"],
      durableWrites: ["manifest_retry_released", "state_snapshot_released"],
      reason: context.reason || "retry_due_ineligible",
      retry: null,
      terminal: true
    };
  }
  return {
    from: currentState,
    to: STATE_CLAIMED,
    actions: ["move_retry_to_claimed", "refresh_issue_snapshot"],
    durableWrites: ["manifest_retry_fired", "state_snapshot_claimed"],
    reason: context.reason || EVENT_RETRY_DUE,
    retry: null,
    terminal: false
  };
}

function eventReason(event, context, fallback) {
  return event?.terminal_reason || event?.terminalReason || event?.reason || context.terminal_reason || context.terminalReason || context.reason || fallback;
}

function positiveInteger(value, label) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return numeric;
}
