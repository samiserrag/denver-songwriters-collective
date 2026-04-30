export const WORKPAD_MARKER = "<!-- symphony-workpad -->";
const WORKPAD_UPDATED_PATTERN = /-\s*Last Updated:\s*`?([^`\n]+)`?/i;

export function labelNames(issue) {
  return (issue.labels || []).map((label) => (typeof label === "string" ? label : label.name));
}

export function hasLabel(issue, label) {
  return labelNames(issue).includes(label);
}

export function isPullRequest(issue) {
  return Boolean(issue.pull_request);
}

export function isEligibleIssue(issue, labels) {
  return (
    issue.state === "open" &&
    !isPullRequest(issue) &&
    hasLabel(issue, labels.ready) &&
    !hasLabel(issue, labels.running) &&
    !hasLabel(issue, labels.blocked) &&
    !hasLabel(issue, labels.humanReview)
  );
}

export function filterEligibleIssues(issues, labels) {
  return issues.filter((issue) => isEligibleIssue(issue, labels));
}

export function countRunningIssues(issues, labels) {
  return issues.filter((issue) => issue.state === "open" && hasLabel(issue, labels.running)).length;
}

export function findWorkpadComment(comments = []) {
  return comments.find((comment) => String(comment.body || "").includes(WORKPAD_MARKER)) || null;
}

export function parseWorkpadUpdatedAt(body = "") {
  const match = String(body).match(WORKPAD_UPDATED_PATTERN);
  if (!match) {
    return null;
  }
  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function runningIssueLastUpdatedAt({ issue, comments = [] }) {
  const workpad = findWorkpadComment(comments);
  if (workpad) {
    return parseWorkpadUpdatedAt(workpad.body) || new Date(workpad.updated_at || workpad.created_at);
  }
  return new Date(issue.updated_at || issue.created_at);
}

export function assessRunningIssue({ issue, comments = [], labels, now = new Date(), staleMs }) {
  const lastUpdatedAt = runningIssueLastUpdatedAt({ issue, comments });
  const lastUpdatedTime = lastUpdatedAt.valueOf();
  const ageMs = Number.isNaN(lastUpdatedTime) ? null : now.valueOf() - lastUpdatedTime;
  const isRunning = issue.state === "open" && hasLabel(issue, labels.running);
  const isStale = isRunning && ageMs !== null && ageMs >= staleMs;

  return {
    issueNumber: issue.number,
    title: issue.title,
    isRunning,
    isStale,
    ageMs,
    lastUpdatedAt: Number.isNaN(lastUpdatedTime) ? null : lastUpdatedAt.toISOString(),
    source: findWorkpadComment(comments) ? "workpad" : "issue"
  };
}

export function labelTransitionFor(state, labels) {
  if (state === "claim") {
    return {
      add: [labels.general, labels.running],
      remove: [labels.ready, labels.blocked, labels.humanReview]
    };
  }
  if (state === "blocked") {
    return {
      add: [labels.general, labels.blocked],
      remove: [labels.ready, labels.running, labels.humanReview]
    };
  }
  if (state === "human-review") {
    return {
      add: [labels.general, labels.humanReview],
      remove: [labels.ready, labels.running, labels.blocked]
    };
  }
  throw new Error(`unknown label transition state: ${state}`);
}

export function buildWorkpadBody({ state, issue, branchName, worktreePath, detail }) {
  const now = new Date().toISOString();
  return [
    WORKPAD_MARKER,
    "## Codex Workpad",
    "",
    `- Issue: #${issue.number} ${issue.title}`,
    `- State: ${state}`,
    `- Last Updated: ${now}`,
    branchName ? `- Branch: \`${branchName}\`` : "- Branch: pending",
    worktreePath ? `- Worktree: \`${worktreePath}\`` : "- Worktree: pending",
    detail ? `- Detail: ${detail}` : "- Detail: pending",
    "",
    "This comment is maintained by the local Symphony runner."
  ].join("\n");
}
