import {
  ORCHESTRATOR_STATES,
  STATE_BLOCKED,
  STATE_CANCELLED,
  STATE_CLAIMED,
  STATE_ELIGIBLE,
  STATE_HUMAN_REVIEW,
  STATE_RELEASED,
  STATE_RETRY_WAIT,
  STATE_RUNNING,
  STATE_STALE
} from "./orchestratorState.mjs";
import { validateOrchestratorStateSnapshot } from "./orchestratorStateManifest.mjs";

const STATE_VALUES = Object.freeze(Object.values(ORCHESTRATOR_STATES));

export function buildOrchestratorStatusSnapshot(snapshot, options = {}) {
  let generatedAt;
  try {
    generatedAt = toIsoTimestamp(options.now ?? new Date(), "now");
    const validated = validateOrchestratorStateSnapshot(snapshot);
    return buildStatus(validated, generatedAt, options);
  } catch (error) {
    return {
      ok: false,
      reason: "orchestrator_status_snapshot_failed",
      generated_at: generatedAt ?? null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function buildStatus(snapshot, generatedAt, options) {
  const countsByState = emptyStateCounts();
  const running = [];
  const retrying = [];
  const retryDue = [];
  const retryNotDue = [];
  const summaries = emptyStateSummaries();
  const accounting = emptyAccounting(snapshot);

  const issues = Object.values(snapshot.issues)
    .sort((left, right) => left.issue_number - right.issue_number);

  for (const issue of issues) {
    countsByState[issue.state] += 1;
    collectAccounting(accounting, issue);

    const summary = issueSummary(issue, generatedAt);
    if (summary.adapter_state_snapshot) {
      summary.adapter_state_snapshot = issue.adapter_state_snapshot;
    }

    switch (issue.state) {
      case STATE_RUNNING:
        running.push(runningSummary(issue, generatedAt));
        break;
      case STATE_RETRY_WAIT: {
        const retry = retrySummary(issue, snapshot.retry_attempts[String(issue.issue_number)], generatedAt);
        retrying.push(retry);
        if (retry.due === true) {
          retryDue.push(retry);
        } else {
          retryNotDue.push(retry);
        }
        break;
      }
      case STATE_BLOCKED:
      case STATE_HUMAN_REVIEW:
      case STATE_STALE:
      case STATE_CANCELLED:
      case STATE_RELEASED:
      case STATE_ELIGIBLE:
      case STATE_CLAIMED:
        summaries[issue.state].push(summary);
        break;
      default:
        break;
    }
  }

  return {
    ok: true,
    mode: options.mode || "snapshot",
    generated_at: generatedAt,
    source_generated_at: snapshot.generated_at,
    repo: snapshot.repo ?? null,
    lock: snapshot.lock ?? null,
    counts_by_state: countsByState,
    counts: {
      total: issues.length,
      running: countsByState[STATE_RUNNING],
      retry_wait: countsByState[STATE_RETRY_WAIT],
      blocked: countsByState[STATE_BLOCKED],
      human_review: countsByState[STATE_HUMAN_REVIEW],
      stale: countsByState[STATE_STALE],
      cancelled: countsByState[STATE_CANCELLED],
      released: countsByState[STATE_RELEASED],
      claimed: countsByState[STATE_CLAIMED],
      eligible: countsByState[STATE_ELIGIBLE]
    },
    running,
    retrying,
    retry_due: retryDue,
    retry_not_due: retryNotDue,
    blocked: summaries[STATE_BLOCKED],
    human_review: summaries[STATE_HUMAN_REVIEW],
    stale: summaries[STATE_STALE],
    cancelled: summaries[STATE_CANCELLED],
    released: summaries[STATE_RELEASED],
    claimed: summaries[STATE_CLAIMED],
    eligible: summaries[STATE_ELIGIBLE],
    codex_totals: snapshot.codex_totals,
    rate_limits: snapshot.codex_rate_limits ?? null,
    accounting,
    last_outcome: snapshot.last_outcome ?? null,
    actions: [],
    durableWrites: []
  };
}

function runningSummary(issue, generatedAt) {
  const adapter = adapterSnapshot(issue);
  return {
    ...issueSummary(issue, generatedAt),
    owner: adapter.owner ?? adapter.user ?? adapter.created_by ?? null,
    pid: adapter.pid ?? null,
    thread_id: adapter.thread_id ?? null,
    turn_id: adapter.turn_id ?? null,
    session_id: adapter.session_id ?? null,
    turn_count: adapter.turn_count ?? null,
    last_protocol_event: adapter.last_protocol_event ?? null,
    last_protocol_event_at: adapter.last_protocol_event_at ?? null,
    terminal_status: issue.terminal_status ?? adapter.terminal_status ?? null,
    terminal_reason: issue.terminal_reason ?? adapter.terminal_reason ?? null,
    seconds_running: secondsBetween(issue.updated_at, generatedAt),
    token_usage: adapter.token_usage ?? null,
    rate_limits: adapter.rate_limits ?? null,
    adapter_state_snapshot: issue.adapter_state_snapshot ?? null
  };
}

function retrySummary(issue, retryAttempt, generatedAt) {
  const retry = retryAttempt ?? retryObjectFromIssue(issue);
  const dueAt = retry?.due_at ?? retry?.dueAt ?? null;
  const due = dueAt ? new Date(dueAt).valueOf() <= new Date(generatedAt).valueOf() : false;
  return {
    ...issueSummary(issue, generatedAt),
    attempt: retry?.attempt ?? issue.attempt ?? null,
    max_attempts: retry?.max_attempts ?? retry?.maxAttempts ?? null,
    delay_ms: retry?.delay_ms ?? retry?.delayMs ?? null,
    due_at: dueAt,
    due,
    reason: retry?.reason ?? issue.reason ?? null,
    last_error: retry?.last_error ?? retry?.lastError ?? null
  };
}

function issueSummary(issue, generatedAt) {
  const adapter = adapterSnapshot(issue);
  const summary = {
    issue_number: issue.issue_number,
    state: issue.state,
    title: issue.title ?? null,
    branch_name: issue.branch_name ?? null,
    worktree_path: issue.worktree_path ?? null,
    manifest_path: issue.manifest_path ?? null,
    log_path: issue.log_path ?? null,
    attempt: issue.attempt ?? null,
    reason: issue.reason ?? null,
    terminal_status: issue.terminal_status ?? adapter.terminal_status ?? null,
    terminal_reason: issue.terminal_reason ?? adapter.terminal_reason ?? null,
    updated_at: issue.updated_at,
    seconds_since_update: secondsBetween(issue.updated_at, generatedAt)
  };
  if (issue.adapter_state_snapshot !== undefined) {
    summary.adapter_state_snapshot = issue.adapter_state_snapshot;
  }
  return summary;
}

function collectAccounting(accounting, issue) {
  const adapter = adapterSnapshot(issue);
  const hasSession = adapter.thread_id !== undefined
    || adapter.turn_id !== undefined
    || adapter.session_id !== undefined
    || adapter.turn_count !== undefined;
  if (hasSession) {
    accounting.sessions.push({
      issue_number: issue.issue_number,
      thread_id: adapter.thread_id ?? null,
      turn_id: adapter.turn_id ?? null,
      session_id: adapter.session_id ?? null,
      turn_count: adapter.turn_count ?? null,
      last_protocol_event: adapter.last_protocol_event ?? null,
      last_protocol_event_at: adapter.last_protocol_event_at ?? null,
      terminal_status: issue.terminal_status ?? adapter.terminal_status ?? null,
      terminal_reason: issue.terminal_reason ?? adapter.terminal_reason ?? null
    });
  }
  if (adapter.token_usage !== undefined && adapter.token_usage !== null) {
    accounting.token_usage_by_issue.push({
      issue_number: issue.issue_number,
      token_usage: adapter.token_usage
    });
  }
  if (adapter.rate_limits !== undefined && adapter.rate_limits !== null) {
    accounting.rate_limits_by_issue.push({
      issue_number: issue.issue_number,
      rate_limits: adapter.rate_limits
    });
  }
}

function emptyAccounting(snapshot) {
  return {
    manifest_codex_totals: snapshot.codex_totals,
    manifest_rate_limits: snapshot.codex_rate_limits ?? null,
    sessions: [],
    token_usage_by_issue: [],
    rate_limits_by_issue: []
  };
}

function emptyStateCounts() {
  return Object.fromEntries(STATE_VALUES.map((state) => [state, 0]));
}

function emptyStateSummaries() {
  return Object.fromEntries(STATE_VALUES.map((state) => [state, []]));
}

function adapterSnapshot(issue) {
  return isPlainObject(issue.adapter_state_snapshot) ? issue.adapter_state_snapshot : {};
}

function retryObjectFromIssue(issue) {
  if (!isPlainObject(issue.retry)) {
    return null;
  }
  return issue.retry;
}

function secondsBetween(start, end) {
  const startMs = new Date(start).valueOf();
  const endMs = new Date(end).valueOf();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return null;
  }
  return Math.floor((endMs - startMs) / 1000);
}

function toIsoTimestamp(value, label) {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) {
      throw new Error(`${label} must be a valid timestamp`);
    }
    return value.toISOString();
  }
  if (typeof value !== "string" || value.length === 0 || Number.isNaN(new Date(value).valueOf())) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
