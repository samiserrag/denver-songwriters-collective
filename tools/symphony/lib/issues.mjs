export const WORKPAD_MARKER = "<!-- symphony-workpad -->";

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
  return [
    WORKPAD_MARKER,
    "## Codex Workpad",
    "",
    `- Issue: #${issue.number} ${issue.title}`,
    `- State: ${state}`,
    branchName ? `- Branch: \`${branchName}\`` : "- Branch: pending",
    worktreePath ? `- Worktree: \`${worktreePath}\`` : "- Worktree: pending",
    detail ? `- Detail: ${detail}` : "- Detail: pending",
    "",
    "This comment is maintained by the local Symphony runner."
  ].join("\n");
}
