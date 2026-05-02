import {
  classifyAdapterTerminal,
  EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
  EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
  EVENT_ADAPTER_TERMINAL_SUCCESS,
  isRetryableFailure,
  isTerminalFailure,
  reduceOrchestratorState,
  STATE_RETRY_WAIT,
  STATE_RUNNING,
  SUCCESS_TERMINAL_REASONS
} from "./orchestratorState.mjs";
import {
  createOrchestratorStateSnapshot,
  validateOrchestratorStateSnapshot
} from "./orchestratorStateManifest.mjs";

export function ingestAdapterResult(snapshot, adapterResult, options = {}) {
  let now;
  let validated;
  let selectedIssue;
  let normalized;

  try {
    now = toIsoTimestamp(options.now ?? new Date(), "now");
    validated = validateOrchestratorStateSnapshot(snapshot);
    selectedIssue = selectIssue(validated, options.issueNumber);
    normalized = normalizeAdapterResult(adapterResult);
    assertKnownTerminalTaxonomy(normalized);
  } catch (error) {
    return failClosedDecision({
      now: now ?? new Date(0).toISOString(),
      reason: "adapter_ingest_failed",
      error
    });
  }

  if (selectedIssue.state !== STATE_RUNNING) {
    return failClosedDecision({
      now,
      issueNumber: selectedIssue.issue_number,
      reason: "adapter_ingest_invalid_state",
      error: new Error(`adapter result can only be ingested for running state: ${selectedIssue.state}`)
    });
  }

  const classification = classifyAdapterTerminal({
    terminal_status: normalized.terminal_status,
    terminal_reason: normalized.terminal_reason,
    reason: normalized.reason
  });
  const context = transitionContextForClassification(classification, normalized, selectedIssue, options);
  let transition;
  try {
    transition = reduceOrchestratorState(selectedIssue.state, classification.event, context);
  } catch (error) {
    return failClosedDecision({
      now,
      issueNumber: selectedIssue.issue_number,
      reason: "adapter_ingest_reducer_failed",
      error
    });
  }

  const nextSnapshot = buildNextSnapshot({
    snapshot: validated,
    issue: selectedIssue,
    transition,
    normalized,
    now
  });

  return {
    ok: true,
    dry_run: true,
    generated_at: now,
    issue_number: selectedIssue.issue_number,
    from: selectedIssue.state,
    to: transition.to,
    reason: transition.reason,
    adapter_terminal: {
      category: classification.category,
      terminal_status: normalized.terminal_status,
      terminal_reason: normalized.terminal_reason,
      raw_reason: normalized.reason
    },
    event: {
      type: classification.event,
      context
    },
    transition,
    actions: transition.actions,
    durableWrites: transition.durableWrites,
    next_snapshot: nextSnapshot,
    adapter_state_snapshot: normalized.adapter_state_snapshot,
    accounting: accountingPayload(normalized)
  };
}

function transitionContextForClassification(classification, normalized, issue, options) {
  const context = {
    reason: normalized.terminal_reason,
    terminal_status: normalized.terminal_status,
    terminal_reason: normalized.terminal_reason
  };
  if (classification.event === EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE) {
    context.retryAttempt = options.retryAttempt ?? issue.attempt ?? 1;
    context.maxAttempts = options.maxAttempts;
    context.maxBackoffMs = options.maxBackoffMs;
  }
  return context;
}

function buildNextSnapshot({ snapshot, issue, transition, normalized, now }) {
  const partial = createOrchestratorStateSnapshot({
    generatedAt: now,
    issueNumber: issue.issue_number,
    state: transition.to,
    title: issue.title,
    branchName: issue.branch_name,
    worktreePath: issue.worktree_path,
    logPath: issue.log_path,
    manifestPath: issue.manifest_path,
    attempt: issue.attempt,
    reason: transition.reason,
    terminalStatus: normalized.terminal_status,
    terminalReason: normalized.terminal_reason,
    adapterStateSnapshot: normalized.adapter_state_snapshot,
    retry: transition.to === STATE_RETRY_WAIT ? transition.retry : null,
    retryAttempts: snapshot.retry_attempts,
    transition,
    stateTransitions: snapshot.state_transitions,
    codexTotals: snapshot.codex_totals,
    codexRateLimits: normalized.rate_limits ?? snapshot.codex_rate_limits,
    lastOutcome: {
      issue_number: issue.issue_number,
      ok: normalized.ok,
      reason: transition.reason,
      terminal_status: normalized.terminal_status,
      terminal_reason: normalized.terminal_reason,
      thread_id: normalized.thread_id,
      turn_id: normalized.turn_id,
      session_id: normalized.session_id,
      turn_count: normalized.turn_count
    },
    workflow: snapshot.workflow,
    repo: snapshot.repo,
    lock: snapshot.lock
  });

  const issueKey = String(issue.issue_number);
  const retryAttempts = {
    ...snapshot.retry_attempts,
    ...partial.retry_attempts
  };
  if (transition.to !== STATE_RETRY_WAIT) {
    delete retryAttempts[issueKey];
  }

  return validateOrchestratorStateSnapshot({
    ...snapshot,
    generated_at: now,
    issues: {
      ...snapshot.issues,
      [issueKey]: partial.issues[issueKey]
    },
    retry_attempts: retryAttempts,
    state_transitions: partial.state_transitions,
    codex_rate_limits: partial.codex_rate_limits,
    last_outcome: partial.last_outcome
  });
}

function normalizeAdapterResult(adapterResult) {
  if (!isPlainObject(adapterResult)) {
    throw new Error("adapter result must be an object");
  }
  const snapshot = isPlainObject(adapterResult.adapter_state_snapshot)
    ? adapterResult.adapter_state_snapshot
    : adapterResult;
  if (!isPlainObject(snapshot)) {
    throw new Error("adapter_state_snapshot must be an object");
  }

  const terminalStatus = adapterResult.terminal_status ?? snapshot.terminal_status;
  const terminalReason = adapterResult.terminal_reason ?? snapshot.terminal_reason ?? adapterResult.reason;
  if (typeof terminalStatus !== "string" || terminalStatus.length === 0) {
    throw new Error("adapter terminal_status is required");
  }
  if (typeof terminalReason !== "string" || terminalReason.length === 0) {
    throw new Error("adapter terminal_reason is required");
  }

  const threadId = firstDefined(adapterResult.thread_id, snapshot.thread_id, null);
  const turnId = firstDefined(adapterResult.turn_id, snapshot.turn_id, null);
  const sessionId = firstDefined(
    adapterResult.session_id,
    snapshot.session_id,
    threadId && turnId ? `${threadId}-${turnId}` : null
  );
  const turnCount = numberOrDefault(adapterResult.turn_count ?? snapshot.turn_count, 0);
  const tokenUsage = firstDefined(adapterResult.token_usage, snapshot.token_usage, null);
  const rateLimits = firstDefined(adapterResult.rate_limits, snapshot.rate_limits, null);

  return {
    ok: Boolean(adapterResult.ok ?? snapshot.ok),
    reason: adapterResult.reason ?? terminalReason,
    terminal_status: terminalStatus,
    terminal_reason: terminalReason,
    thread_id: threadId,
    turn_id: turnId,
    session_id: sessionId,
    turn_count: turnCount,
    last_protocol_event: firstDefined(adapterResult.last_protocol_event, snapshot.last_protocol_event, null),
    last_protocol_event_at: firstDefined(adapterResult.last_protocol_event_at, snapshot.last_protocol_event_at, null),
    token_usage: tokenUsage,
    rate_limits: rateLimits,
    adapter_events_count: numberOrDefault(
      adapterResult.adapter_events_count ?? snapshot.adapter_events_count ?? adapterResult.adapter_events?.length,
      0
    ),
    protocol_events_count: numberOrDefault(
      adapterResult.protocol_events_count ?? snapshot.protocol_events_count ?? adapterResult.protocol_events?.length,
      0
    ),
    adapter_state_snapshot: {
      ...snapshot,
      thread_id: threadId,
      turn_id: turnId,
      session_id: sessionId,
      turn_count: turnCount,
      last_protocol_event: firstDefined(adapterResult.last_protocol_event, snapshot.last_protocol_event, null),
      last_protocol_event_at: firstDefined(adapterResult.last_protocol_event_at, snapshot.last_protocol_event_at, null),
      token_usage: tokenUsage,
      rate_limits: rateLimits,
      adapter_events_count: numberOrDefault(
        adapterResult.adapter_events_count ?? snapshot.adapter_events_count ?? adapterResult.adapter_events?.length,
        0
      ),
      protocol_events_count: numberOrDefault(
        adapterResult.protocol_events_count ?? snapshot.protocol_events_count ?? adapterResult.protocol_events?.length,
        0
      ),
      terminal_status: terminalStatus,
      terminal_reason: terminalReason,
      ok: Boolean(adapterResult.ok ?? snapshot.ok)
    }
  };
}

function assertKnownTerminalTaxonomy(normalized) {
  const status = normalized.terminal_status;
  const reason = normalized.terminal_reason;
  if (status === "success" && SUCCESS_TERMINAL_REASONS.includes(reason)) {
    return;
  }
  if (status === "failure" && (isRetryableFailure(reason) || isTerminalFailure(reason))) {
    return;
  }
  throw new Error(`unknown adapter terminal taxonomy: ${status}/${reason}`);
}

function selectIssue(snapshot, issueNumber) {
  const issues = Object.values(snapshot.issues);
  if (issueNumber !== undefined) {
    const issue = snapshot.issues[String(issueNumber)];
    if (!issue) {
      throw new Error(`issue ${issueNumber} was not found in orchestrator state snapshot`);
    }
    return issue;
  }
  if (issues.length !== 1) {
    throw new Error("issueNumber is required when snapshot contains multiple issues");
  }
  return issues[0];
}

function accountingPayload(normalized) {
  return {
    thread_id: normalized.thread_id,
    turn_id: normalized.turn_id,
    session_id: normalized.session_id,
    turn_count: normalized.turn_count,
    last_protocol_event: normalized.last_protocol_event,
    last_protocol_event_at: normalized.last_protocol_event_at,
    token_usage: normalized.token_usage,
    rate_limits: normalized.rate_limits,
    adapter_events_count: normalized.adapter_events_count,
    protocol_events_count: normalized.protocol_events_count
  };
}

function failClosedDecision({ now, issueNumber = null, reason, error }) {
  return {
    ok: false,
    dry_run: true,
    generated_at: now,
    issue_number: issueNumber,
    reason,
    error: error instanceof Error ? error.message : String(error),
    event: null,
    transition: null,
    next_snapshot: null,
    adapter_state_snapshot: null,
    accounting: null,
    actions: ["stop_adapter_ingestion", "require_manual_review"],
    durableWrites: ["adapter_ingest_manifest_error"]
  };
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return null;
}

function numberOrDefault(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }
  return numeric;
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
