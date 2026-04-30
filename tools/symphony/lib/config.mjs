import path from "node:path";

export const DEFAULT_LABELS = Object.freeze({
  ready: "symphony:ready",
  running: "symphony:running",
  humanReview: "symphony:human-review",
  blocked: "symphony:blocked",
  general: "symphony"
});

export const DEFAULT_WORKSPACE = Object.freeze({
  root: ".symphony/worktrees",
  logs: ".symphony/logs",
  state: ".symphony/state"
});

export function resolveConfig(repoRoot, workflowConfig = {}, env = process.env) {
  const workspace = {
    ...DEFAULT_WORKSPACE,
    ...(workflowConfig.workspace || {})
  };

  const labels = {
    ...DEFAULT_LABELS,
    ...(workflowConfig.labels || {})
  };

  return {
    version: workflowConfig.version || 1,
    maxConcurrentAgents: Number(workflowConfig.max_concurrent_agents || 1),
    labels,
    workspaceRoot: path.resolve(repoRoot, env.SYMPHONY_WORKSPACE_ROOT || workspace.root),
    logRoot: path.resolve(repoRoot, env.SYMPHONY_LOG_ROOT || workspace.logs),
    stateRoot: path.resolve(repoRoot, env.SYMPHONY_STATE_ROOT || workspace.state),
    codexAdapter: workflowConfig.codex?.adapter || "codex-exec"
  };
}

export function requiredLabelNames(labels = DEFAULT_LABELS) {
  return [
    labels.general,
    labels.ready,
    labels.running,
    labels.humanReview,
    labels.blocked
  ];
}
