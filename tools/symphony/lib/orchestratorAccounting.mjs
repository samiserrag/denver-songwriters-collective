export function normalizeAdapterAccounting(adapterStateSnapshot = {}) {
  if (!isPlainObject(adapterStateSnapshot)) {
    return failure("adapter_state_snapshot must be an object when present");
  }

  return {
    ok: true,
    session: {
      thread_id: stringOrNull(adapterStateSnapshot.thread_id),
      turn_id: stringOrNull(adapterStateSnapshot.turn_id),
      session_id: stringOrNull(adapterStateSnapshot.session_id),
      turn_count: nonNegativeNumberOrNull(adapterStateSnapshot.turn_count),
      last_protocol_event: stringOrNull(adapterStateSnapshot.last_protocol_event),
      last_protocol_event_at: stringOrNull(adapterStateSnapshot.last_protocol_event_at),
      terminal_status: stringOrNull(adapterStateSnapshot.terminal_status),
      terminal_reason: stringOrNull(adapterStateSnapshot.terminal_reason)
    },
    token_usage: adapterStateSnapshot.token_usage ?? null,
    rate_limits: adapterStateSnapshot.rate_limits ?? null,
    event_counts: {
      adapter_events_count: eventCount(adapterStateSnapshot.adapter_events_count, adapterStateSnapshot.adapter_events),
      protocol_events_count: eventCount(adapterStateSnapshot.protocol_events_count, adapterStateSnapshot.protocol_events)
    },
    adapter_state_snapshot: adapterStateSnapshot
  };
}

export function normalizeIssueAccounting(issue) {
  if (!isPlainObject(issue)) {
    return failure("issue accounting input must be an object");
  }
  const issueNumber = positiveIntegerOrNull(issue.issue_number);
  if (issueNumber === null) {
    return failure("issue accounting input requires a positive issue_number");
  }

  const adapterInput = isPlainObject(issue.adapter_state_snapshot) ? issue.adapter_state_snapshot : {};
  const adapter = normalizeAdapterAccounting(adapterInput);
  if (!adapter.ok) {
    return adapter;
  }

  const session = {
    issue_number: issueNumber,
    thread_id: adapter.session.thread_id,
    turn_id: adapter.session.turn_id,
    session_id: adapter.session.session_id,
    turn_count: adapter.session.turn_count,
    last_protocol_event: adapter.session.last_protocol_event,
    last_protocol_event_at: adapter.session.last_protocol_event_at,
    terminal_status: stringOrNull(issue.terminal_status) ?? adapter.session.terminal_status,
    terminal_reason: stringOrNull(issue.terminal_reason) ?? adapter.session.terminal_reason
  };

  return {
    ok: true,
    issue_number: issueNumber,
    session,
    has_session: hasSessionMetadata(adapter.session),
    token_usage_entry: adapter.token_usage === null ? null : {
      issue_number: issueNumber,
      token_usage: adapter.token_usage
    },
    rate_limits_entry: adapter.rate_limits === null ? null : {
      issue_number: issueNumber,
      rate_limits: adapter.rate_limits
    },
    event_counts_entry: {
      issue_number: issueNumber,
      ...adapter.event_counts
    },
    adapter_state_snapshot: adapter.adapter_state_snapshot
  };
}

export function collectSnapshotAccounting(snapshot) {
  if (!isPlainObject(snapshot)) {
    return failure("orchestrator accounting snapshot must be an object");
  }
  if (!isPlainObject(snapshot.issues)) {
    return failure("orchestrator accounting snapshot issues must be an object");
  }

  const accounting = {
    manifest_codex_totals: snapshot.codex_totals ?? null,
    manifest_rate_limits: snapshot.codex_rate_limits ?? null,
    sessions: [],
    token_usage_by_issue: [],
    rate_limits_by_issue: [],
    adapter_event_counts_by_issue: []
  };

  const issues = Object.values(snapshot.issues)
    .sort((left, right) => (left.issue_number ?? 0) - (right.issue_number ?? 0));

  for (const issue of issues) {
    const normalized = normalizeIssueAccounting(issue);
    if (!normalized.ok) {
      return normalized;
    }
    if (normalized.has_session) {
      accounting.sessions.push(normalized.session);
    }
    if (normalized.token_usage_entry) {
      accounting.token_usage_by_issue.push(normalized.token_usage_entry);
    }
    if (normalized.rate_limits_entry) {
      accounting.rate_limits_by_issue.push(normalized.rate_limits_entry);
    }
    if (
      normalized.event_counts_entry.adapter_events_count > 0
      || normalized.event_counts_entry.protocol_events_count > 0
    ) {
      accounting.adapter_event_counts_by_issue.push(normalized.event_counts_entry);
    }
  }

  return {
    ok: true,
    accounting
  };
}

function hasSessionMetadata(session) {
  return session.thread_id !== null
    || session.turn_id !== null
    || session.session_id !== null
    || session.turn_count !== null
    || session.last_protocol_event !== null
    || session.last_protocol_event_at !== null;
}

function eventCount(explicitCount, eventList) {
  const explicit = nonNegativeNumberOrNull(explicitCount);
  if (explicit !== null) {
    return explicit;
  }
  if (Array.isArray(eventList)) {
    return eventList.length;
  }
  return 0;
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nonNegativeNumberOrNull(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return numeric;
}

function positiveIntegerOrNull(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return null;
  }
  return numeric;
}

function failure(error) {
  return {
    ok: false,
    error
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
