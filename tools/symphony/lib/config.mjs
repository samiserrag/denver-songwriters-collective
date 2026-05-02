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

export const DEFAULT_RECOVERY = Object.freeze({
  staleRunningMinutes: 240
});

export const DEFAULT_LOCK = Object.freeze({
  staleMinutes: 240
});

export const DEFAULT_CODEX = Object.freeze({
  executionTimeoutMinutes: 30,
  executionTimeoutKillGraceSeconds: 15
});

function hasOwnEnvValue(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function parsePositiveNumber(value, sourceName) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`${sourceName} must be a positive number`);
  }
  return numericValue;
}

function resolvePositiveNumber({ env, envName, configValue, defaultValue, configName }) {
  if (hasOwnEnvValue(env, envName)) {
    return parsePositiveNumber(env[envName], envName);
  }
  if (configValue !== undefined) {
    return parsePositiveNumber(configValue, configName);
  }
  return defaultValue;
}

export function resolveConfig(repoRoot, workflowConfig = {}, env = process.env) {
  const workspace = {
    ...DEFAULT_WORKSPACE,
    ...(workflowConfig.workspace || {})
  };

  const labels = {
    ...DEFAULT_LABELS,
    ...(workflowConfig.labels || {})
  };

  const recovery = workflowConfig.recovery || {};
  const staleRunningMinutes = Number(
    env.SYMPHONY_STALE_RUNNING_MINUTES || recovery.stale_running_minutes || DEFAULT_RECOVERY.staleRunningMinutes
  );
  const lock = workflowConfig.lock || {};
  const lockStaleMinutes = Number(
    env.SYMPHONY_LOCK_STALE_MINUTES || lock.stale_minutes || DEFAULT_LOCK.staleMinutes
  );
  const codex = workflowConfig.codex || {};
  const codexExecutionTimeoutMinutes = resolvePositiveNumber({
    env,
    envName: "SYMPHONY_CODEX_EXECUTION_TIMEOUT_MINUTES",
    configValue: codex.execution_timeout_minutes,
    defaultValue: DEFAULT_CODEX.executionTimeoutMinutes,
    configName: "codex.execution_timeout_minutes"
  });
  const codexExecutionTimeoutKillGraceSeconds = resolvePositiveNumber({
    env,
    envName: "SYMPHONY_CODEX_EXECUTION_TIMEOUT_KILL_GRACE_SECONDS",
    configValue: codex.execution_timeout_kill_grace_seconds,
    defaultValue: DEFAULT_CODEX.executionTimeoutKillGraceSeconds,
    configName: "codex.execution_timeout_kill_grace_seconds"
  });
  const stateRoot = path.resolve(repoRoot, env.SYMPHONY_STATE_ROOT || workspace.state);

  return {
    version: workflowConfig.version || 1,
    maxConcurrentAgents: Number(workflowConfig.max_concurrent_agents || 1),
    labels,
    workspaceRoot: path.resolve(repoRoot, env.SYMPHONY_WORKSPACE_ROOT || workspace.root),
    logRoot: path.resolve(repoRoot, env.SYMPHONY_LOG_ROOT || workspace.logs),
    stateRoot,
    manifestRoot: path.join(stateRoot, "manifests"),
    lockPath: path.join(stateRoot, "runner.lock"),
    lockStaleMinutes,
    lockStaleMs: lockStaleMinutes * 60 * 1000,
    staleRunningMinutes,
    staleRunningMs: staleRunningMinutes * 60 * 1000,
    codexAdapter: workflowConfig.codex?.adapter || "codex-exec",
    codexExecutionTimeoutMinutes,
    codexExecutionTimeoutMs: codexExecutionTimeoutMinutes * 60 * 1000,
    codexExecutionTimeoutKillGraceSeconds,
    codexExecutionTimeoutKillGraceMs: codexExecutionTimeoutKillGraceSeconds * 1000
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
