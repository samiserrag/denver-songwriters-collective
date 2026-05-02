import {
  EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
  EVENT_CLEANUP_COMPLETE,
  EVENT_RECONCILIATION_INELIGIBLE,
  EVENT_RETRY_DUE,
  EVENT_STALE_DETECTED,
  EVENT_STALE_RECOVERY_BLOCKED,
  reduceOrchestratorState,
  STATE_BLOCKED,
  STATE_CANCELLED,
  STATE_HUMAN_REVIEW,
  STATE_RELEASED,
  STATE_RETRY_WAIT,
  STATE_RUNNING,
  STATE_STALE
} from "./orchestratorState.mjs";
import { validateOrchestratorStateSnapshot } from "./orchestratorStateManifest.mjs";

export const DEFAULT_RECONCILE_STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000;

const DEFAULT_LABELS = Object.freeze({
  running: "symphony:running",
  blocked: "symphony:blocked",
  humanReview: "symphony:human-review"
});

export function reconcileOrchestratorState(snapshot, observed = {}, options = {}) {
  const now = toIsoTimestamp(options.now ?? observed.now ?? new Date(), "now");
  let validated;

  try {
    if (snapshot === null || snapshot === undefined) {
      throw new Error("missing orchestrator state snapshot");
    }
    validated = validateOrchestratorStateSnapshot(snapshot);
    assertPlainObject(observed, "observed");
  } catch (error) {
    return failClosedDecision({
      now,
      reason: "invalid_orchestrator_state_snapshot",
      error
    });
  }

  const decisions = Object.values(validated.issues).map((issue) => (
    reconcileIssue(issue, validated, observed, options, now)
  ));

  return {
    ok: decisions.every((decision) => decision.ok !== false),
    dry_run: true,
    generated_at: now,
    decisions,
    proposed_events: decisions
      .filter((decision) => decision.event)
      .map((decision) => ({
        issue_number: decision.issue_number,
        event: decision.event
      })),
    transitions: decisions
      .filter((decision) => decision.transition)
      .map((decision) => decision.transition)
  };
}

function reconcileIssue(issue, snapshot, observed, options, now) {
  const evidence = observedForIssue(issue.issue_number, observed);
  if (!evidence) {
    return failClosedIssueDecision(issue, {
      now,
      reason: "missing_observed_issue_snapshot",
      detail: `missing observed evidence for issue ${issue.issue_number}`
    });
  }
  if (!isPlainObject(evidence)) {
    return failClosedIssueDecision(issue, {
      now,
      reason: "malformed_observed_issue_snapshot",
      detail: `observed evidence for issue ${issue.issue_number} must be an object`
    });
  }

  try {
    switch (issue.state) {
      case STATE_RUNNING:
        return reconcileRunningIssue(issue, snapshot, evidence, observed, options, now);
      case STATE_RETRY_WAIT:
        return reconcileRetryWaitIssue(issue, snapshot, evidence, now);
      case STATE_STALE:
        return transitionDecision(issue, EVENT_STALE_RECOVERY_BLOCKED, {
          reason: staleRecoveryReason(evidence)
        }, now, evidence);
      case STATE_CANCELLED:
        if (evidence.cleanupComplete) {
          return transitionDecision(issue, EVENT_CLEANUP_COMPLETE, {
            cleanupOk: evidence.cleanupOk !== false
          }, now, evidence);
        }
        return noTransitionDecision(issue, "cancelled_awaiting_cleanup", now, evidence);
      case STATE_BLOCKED:
      case STATE_HUMAN_REVIEW:
      case STATE_RELEASED:
        return noTransitionDecision(issue, `${issue.state}_is_not_reconciled_for_dispatch`, now, evidence);
      default:
        return failClosedIssueDecision(issue, {
          now,
          reason: "unknown_orchestrator_state",
          detail: `unknown orchestrator state: ${issue.state}`
        });
    }
  } catch (error) {
    return failClosedIssueDecision(issue, {
      now,
      reason: "reducer_reconciliation_failed",
      error
    });
  }
}

function reconcileRunningIssue(issue, snapshot, evidence, observed, options, now) {
  const labelMismatchReason = runningLabelMismatchReason(evidence, options.labels);
  if (labelMismatchReason) {
    return transitionDecision(issue, EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE, {
      reason: labelMismatchReason
    }, now, evidence);
  }

  const workflowDriftReason = workflowDrift(issue, snapshot, evidence, observed);
  if (workflowDriftReason) {
    return transitionDecision(issue, EVENT_RECONCILIATION_INELIGIBLE, {
      reason: workflowDriftReason
    }, now, evidence);
  }

  if (evidence.eligible === false || evidence.issueEligible === false) {
    return transitionDecision(issue, EVENT_RECONCILIATION_INELIGIBLE, {
      reason: evidence.ineligibleReason || "issue_no_longer_eligible"
    }, now, evidence);
  }

  const staleReason = staleRunningReason(issue, evidence, options, now);
  if (staleReason) {
    return transitionDecision(issue, EVENT_STALE_DETECTED, {
      reason: staleReason
    }, now, evidence);
  }

  return noTransitionDecision(issue, "running_issue_fresh_and_eligible", now, evidence);
}

function reconcileRetryWaitIssue(issue, snapshot, evidence, now) {
  const retry = snapshot.retry_attempts[String(issue.issue_number)] || issue.retry;
  if (!retry) {
    return failClosedIssueDecision(issue, {
      now,
      reason: "missing_retry_attempt",
      detail: `retry_wait issue ${issue.issue_number} has no retry attempt`
    });
  }

  if (new Date(retry.due_at).valueOf() > new Date(now).valueOf()) {
    return noTransitionDecision(issue, "retry_not_due", now, evidence);
  }

  return transitionDecision(issue, EVENT_RETRY_DUE, {
    issueEligible: evidence.eligible === true || evidence.issueEligible === true,
    reason: (evidence.eligible === false || evidence.issueEligible === false)
      ? "retry_due_ineligible"
      : EVENT_RETRY_DUE
  }, now, evidence);
}

function transitionDecision(issue, eventType, context, now, evidence) {
  const transition = reduceOrchestratorState(issue.state, eventType, context);
  return {
    ok: true,
    dry_run: true,
    issue_number: issue.issue_number,
    state: issue.state,
    status: "transition",
    reason: transition.reason,
    event: {
      type: eventType,
      context
    },
    transition,
    actions: transition.actions,
    durableWrites: transition.durableWrites,
    observed: summarizeEvidence(evidence),
    generated_at: now
  };
}

function noTransitionDecision(issue, reason, now, evidence) {
  return {
    ok: true,
    dry_run: true,
    issue_number: issue.issue_number,
    state: issue.state,
    status: "no_transition",
    reason,
    event: null,
    transition: null,
    actions: [],
    durableWrites: [],
    observed: summarizeEvidence(evidence),
    generated_at: now
  };
}

function failClosedDecision({ now, reason, error }) {
  return {
    ok: false,
    dry_run: true,
    generated_at: now,
    reason,
    error: error instanceof Error ? error.message : String(error),
    decisions: [],
    proposed_events: [],
    transitions: [],
    actions: ["stop_reconciliation", "require_manual_review"],
    durableWrites: ["reconciliation_manifest_error"]
  };
}

function failClosedIssueDecision(issue, { now, reason, detail, error }) {
  return {
    ok: false,
    dry_run: true,
    issue_number: issue?.issue_number ?? null,
    state: issue?.state ?? null,
    status: "fail_closed",
    reason,
    error: detail || (error instanceof Error ? error.message : String(error)),
    event: null,
    transition: null,
    actions: ["block_or_manual_recovery"],
    durableWrites: ["reconciliation_manifest_error"],
    observed: null,
    generated_at: now
  };
}

function observedForIssue(issueNumber, observed) {
  const issues = observed.issues || observed.issueSnapshots || {};
  return issues[String(issueNumber)] ?? issues[issueNumber] ?? null;
}

function runningLabelMismatchReason(evidence, labels = DEFAULT_LABELS) {
  const configuredLabels = { ...DEFAULT_LABELS, ...labels };
  const currentLabels = evidence.labels;
  if (currentLabels !== undefined) {
    if (!Array.isArray(currentLabels)) {
      return "label_workpad_mismatch";
    }
    if (currentLabels.includes(configuredLabels.blocked) || currentLabels.includes(configuredLabels.humanReview)) {
      return "label_workpad_mismatch";
    }
    if (!currentLabels.includes(configuredLabels.running)) {
      return "label_workpad_mismatch";
    }
  }

  const workpadState = evidence.workpadState ?? evidence.workpad_state;
  if (workpadState !== undefined && workpadState !== "running") {
    return "label_workpad_mismatch";
  }
  return null;
}

function workflowDrift(issue, snapshot, evidence, observed) {
  const accepted = issue.workflow || snapshot.workflow || null;
  const current = evidence.workflow || observed.workflow || null;
  if (!accepted || !current) {
    return null;
  }

  const acceptedHash = accepted.workflow_hash || accepted.hash || accepted.config_hash;
  const currentHash = current.workflow_hash || current.hash || current.config_hash;
  if (acceptedHash && currentHash && acceptedHash !== currentHash) {
    return "workflow_policy_drift";
  }

  const acceptedVersion = accepted.workflow_version || accepted.version;
  const currentVersion = current.workflow_version || current.version;
  if (acceptedVersion && currentVersion && acceptedVersion !== currentVersion) {
    return "workflow_policy_drift";
  }
  return null;
}

function staleRunningReason(issue, evidence, options, now) {
  const staleThresholdMs = Number(options.staleThresholdMs ?? options.staleMs ?? DEFAULT_RECONCILE_STALE_THRESHOLD_MS);
  if (!Number.isFinite(staleThresholdMs) || staleThresholdMs < 1) {
    throw new Error("stale threshold must be a positive number");
  }

  const heartbeat = evidence.workpadUpdatedAt
    ?? evidence.workpad_updated_at
    ?? evidence.heartbeatAt
    ?? evidence.heartbeat_at
    ?? issue.updated_at;
  const ageMs = new Date(now).valueOf() - new Date(heartbeat).valueOf();
  if (!Number.isFinite(ageMs)) {
    return "running_stale_missing_heartbeat";
  }
  if (ageMs >= staleThresholdMs && !hasLiveOwnerEvidence(evidence)) {
    return "running_stale_by_heartbeat";
  }
  return null;
}

function staleRecoveryReason(evidence) {
  if (evidence.safeAutoRelease === true || evidence.safe_auto_release === true) {
    return "stale_recovery_blocked_safe_evidence_requires_human_review";
  }
  return evidence.recoveryReason || evidence.recovery_reason || "stale_recovery_blocked";
}

function hasLiveOwnerEvidence(evidence) {
  return Boolean(
    evidence.liveOwner === true ||
    evidence.live_owner === true ||
    evidence.workspace?.lockHeld === true ||
    evidence.workspace?.lock_held === true ||
    evidence.lock?.held === true
  );
}

function summarizeEvidence(evidence) {
  if (!evidence || !isPlainObject(evidence)) {
    return null;
  }
  return {
    eligible: evidence.eligible ?? evidence.issueEligible ?? null,
    labels: Array.isArray(evidence.labels) ? [...evidence.labels] : evidence.labels ?? null,
    workpad_state: evidence.workpad_state ?? evidence.workpadState ?? null,
    workpad_updated_at: evidence.workpad_updated_at ?? evidence.workpadUpdatedAt ?? null,
    workflow: evidence.workflow ?? null,
    workspace: evidence.workspace ?? null
  };
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toIsoTimestamp(value, label) {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) {
      throw new Error(`${label} must be a valid timestamp`);
    }
    return value.toISOString();
  }
  if (typeof value !== "string" || Number.isNaN(new Date(value).valueOf())) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return new Date(value).toISOString();
}
