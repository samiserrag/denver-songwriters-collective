function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickIssue(entry) {
  return {
    issue_number: Number.isInteger(entry?.issue_number) ? entry.issue_number : null,
    state: typeof entry?.state === "string" ? entry.state : null,
    reason: typeof entry?.reason === "string" ? entry.reason : null,
    due: entry?.due === true,
    due_at: typeof entry?.due_at === "string" ? entry.due_at : null,
    updated_at: typeof entry?.updated_at === "string" ? entry.updated_at : null
  };
}

export function buildOperatorSummary(statusSnapshot, options = {}) {
  const recentLimit = Number.isInteger(options.recent_limit) && options.recent_limit > 0 ? options.recent_limit : 5;

  if (!statusSnapshot || typeof statusSnapshot !== "object" || Array.isArray(statusSnapshot)) {
    return {
      ok: false,
      reason: "operator_summary_invalid_status",
      generated_at: null,
      errors: [{ path: "status", reason: "malformed_status_snapshot" }]
    };
  }

  const blocked = asArray(statusSnapshot.blocked).map(pickIssue);
  const retryDue = asArray(statusSnapshot.retry_due).map(pickIssue);
  const retrying = asArray(statusSnapshot.retrying).map(pickIssue);
  const running = asArray(statusSnapshot.running).map(pickIssue);
  const transitions = asArray(statusSnapshot.state_transitions)
    .map((entry) => ({
      at: typeof entry?.at === "string" ? entry.at : null,
      issue_number: Number.isInteger(entry?.issue_number) ? entry.issue_number : null,
      from: typeof entry?.from === "string" ? entry.from : null,
      to: typeof entry?.to === "string" ? entry.to : null,
      reason: typeof entry?.reason === "string" ? entry.reason : null
    }))
    .slice(0, recentLimit);

  return {
    ok: true,
    reason: null,
    generated_at: typeof statusSnapshot.generated_at === "string" ? statusSnapshot.generated_at : null,
    mode: typeof statusSnapshot.mode === "string" ? statusSnapshot.mode : null,
    counts: statusSnapshot.counts && typeof statusSnapshot.counts === "object" ? statusSnapshot.counts : null,
    attention: {
      blocked_count: blocked.length,
      retry_due_count: retryDue.length,
      running_count: running.length
    },
    blocked: blocked.slice(0, recentLimit),
    retry_due: retryDue.slice(0, recentLimit),
    retrying: retrying.slice(0, recentLimit),
    transitions
  };
}
