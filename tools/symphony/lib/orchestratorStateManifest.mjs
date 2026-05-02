import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ORCHESTRATOR_STATES, STATE_RETRY_WAIT } from "./orchestratorState.mjs";

export const ORCHESTRATOR_STATE_MANIFEST_KIND = "symphony_orchestrator_state";
export const ORCHESTRATOR_STATE_MANIFEST_VERSION = 1;

const KNOWN_STATES = new Set(Object.values(ORCHESTRATOR_STATES));
const OPTIONAL_STRING_FIELDS = Object.freeze([
  "title",
  "branch_name",
  "worktree_path",
  "log_path",
  "manifest_path",
  "reason",
  "terminal_status",
  "terminal_reason"
]);

export function createOrchestratorStateSnapshot({
  generatedAt = new Date(),
  issueNumber,
  state,
  title,
  branchName,
  worktreePath,
  logPath,
  manifestPath,
  attempt,
  reason,
  terminalStatus,
  terminalReason,
  adapterStateSnapshot = null,
  retry = null,
  retryAttempts = {},
  transition = null,
  stateTransitions = [],
  codexTotals = defaultCodexTotals(),
  codexRateLimits = null,
  lastOutcome = null,
  workflow = null,
  repo = null,
  lock = null
} = {}) {
  const generatedAtIso = toIsoTimestamp(generatedAt, "generated_at");
  const issues = {};
  const normalizedRetryAttempts = normalizeRetryAttempts(retryAttempts);

  if (issueNumber !== undefined || state !== undefined) {
    const issue = normalizeIssueState({
      issue_number: issueNumber,
      state,
      title,
      branch_name: branchName,
      worktree_path: worktreePath,
      log_path: logPath,
      manifest_path: manifestPath,
      attempt,
      reason,
      terminal_status: terminalStatus,
      terminal_reason: terminalReason,
      adapter_state_snapshot: adapterStateSnapshot,
      retry,
      updated_at: generatedAtIso
    });
    issues[String(issue.issue_number)] = issue;

    if (issue.state === STATE_RETRY_WAIT && issue.retry) {
      const retryDelayMs = issue.retry.delayMs ?? issue.retry.delay_ms;
      normalizedRetryAttempts[String(issue.issue_number)] = normalizeRetryAttempt({
        issue_number: issue.issue_number,
        state: STATE_RETRY_WAIT,
        attempt: issue.retry.attempt,
        max_attempts: issue.retry.maxAttempts ?? issue.retry.max_attempts,
        delay_ms: retryDelayMs,
        due_at: issue.retry.dueAt ?? issue.retry.due_at ?? addMilliseconds(generatedAtIso, retryDelayMs),
        reason: issue.retry.reason || issue.reason,
        last_error: issue.retry.lastError ?? issue.retry.last_error ?? issue.reason,
        branch_name: issue.branch_name,
        worktree_path: issue.worktree_path,
        manifest_path: issue.manifest_path,
        updated_at: generatedAtIso
      });
    }
  }

  const transitions = [...stateTransitions];
  if (transition) {
    transitions.push(normalizeTransition(transition, generatedAtIso));
  }

  return validateOrchestratorStateSnapshot({
    manifest_kind: ORCHESTRATOR_STATE_MANIFEST_KIND,
    orchestrator_state_version: ORCHESTRATOR_STATE_MANIFEST_VERSION,
    generated_at: generatedAtIso,
    repo,
    lock,
    issues,
    retry_attempts: normalizedRetryAttempts,
    state_transitions: transitions,
    codex_totals: normalizeCodexTotals(codexTotals),
    codex_rate_limits: codexRateLimits,
    last_outcome: lastOutcome,
    workflow
  });
}

export function validateOrchestratorStateSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw new Error("orchestrator state manifest must be an object");
  }
  if (snapshot.manifest_kind !== ORCHESTRATOR_STATE_MANIFEST_KIND) {
    throw new Error(`invalid orchestrator state manifest kind: ${snapshot.manifest_kind}`);
  }
  if (snapshot.orchestrator_state_version !== ORCHESTRATOR_STATE_MANIFEST_VERSION) {
    throw new Error(`unknown orchestrator state manifest version: ${snapshot.orchestrator_state_version}`);
  }
  assertTimestamp(snapshot.generated_at, "generated_at");

  if (!isPlainObject(snapshot.issues)) {
    throw new Error("orchestrator state manifest issues must be an object");
  }
  const issues = {};
  for (const [key, issue] of Object.entries(snapshot.issues)) {
    const normalized = normalizeIssueState(issue, `issues.${key}`);
    if (String(normalized.issue_number) !== key) {
      throw new Error(`issues.${key}.issue_number must match its issue key`);
    }
    issues[key] = normalized;
  }

  const retryAttempts = normalizeRetryAttempts(snapshot.retry_attempts);

  if (!Array.isArray(snapshot.state_transitions)) {
    throw new Error("orchestrator state manifest state_transitions must be an array");
  }
  const stateTransitions = snapshot.state_transitions.map((transition, index) => (
    normalizeTransition(transition, null, `state_transitions.${index}`)
  ));

  return {
    ...snapshot,
    issues,
    retry_attempts: retryAttempts,
    state_transitions: stateTransitions,
    codex_totals: normalizeCodexTotals(snapshot.codex_totals)
  };
}

export async function writeOrchestratorStateManifest(filePath, snapshot, {
  mkdirFn = mkdir,
  writeFileFn = writeFile
} = {}) {
  const validated = validateOrchestratorStateSnapshot(snapshot);
  await mkdirFn(path.dirname(filePath), { recursive: true });
  await writeFileFn(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return filePath;
}

export async function readOrchestratorStateManifest(filePath, {
  readFileFn = readFile
} = {}) {
  let text;
  try {
    text = await readFileFn(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid orchestrator state manifest JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return validateOrchestratorStateSnapshot(parsed);
}

function normalizeIssueState(issue, pathPrefix = "issue") {
  if (!isPlainObject(issue)) {
    throw new Error(`${pathPrefix} must be an object`);
  }
  const issueNumber = positiveInteger(issue.issue_number, `${pathPrefix}.issue_number`);
  assertKnownState(issue.state, `${pathPrefix}.state`);
  assertTimestamp(issue.updated_at, `${pathPrefix}.updated_at`);
  for (const field of OPTIONAL_STRING_FIELDS) {
    assertOptionalString(issue[field], `${pathPrefix}.${field}`);
  }
  const normalized = {
    issue_number: issueNumber,
    state: issue.state,
    updated_at: issue.updated_at
  };

  copyDefined(normalized, issue, OPTIONAL_STRING_FIELDS);
  copyOptionalPositiveInteger(normalized, issue, "attempt", `${pathPrefix}.attempt`);
  if (issue.adapter_state_snapshot !== undefined) {
    normalized.adapter_state_snapshot = issue.adapter_state_snapshot;
  }
  if (issue.retry !== undefined && issue.retry !== null) {
    normalized.retry = normalizeRetryObject(issue.retry, `${pathPrefix}.retry`);
  }
  return normalized;
}

function normalizeRetryAttempts(retryAttempts = {}) {
  if (!isPlainObject(retryAttempts)) {
    throw new Error("orchestrator state manifest retry_attempts must be an object");
  }
  const normalized = {};
  for (const [key, retryAttempt] of Object.entries(retryAttempts)) {
    const retry = normalizeRetryAttempt(retryAttempt, `retry_attempts.${key}`);
    if (String(retry.issue_number) !== key) {
      throw new Error(`retry_attempts.${key}.issue_number must match its issue key`);
    }
    normalized[key] = retry;
  }
  return normalized;
}

function normalizeRetryAttempt(retryAttempt, pathPrefix = "retry_attempt") {
  if (!isPlainObject(retryAttempt)) {
    throw new Error(`${pathPrefix} must be an object`);
  }
  const issueNumber = positiveInteger(retryAttempt.issue_number, `${pathPrefix}.issue_number`);
  const state = retryAttempt.state || STATE_RETRY_WAIT;
  if (state !== STATE_RETRY_WAIT) {
    throw new Error(`${pathPrefix}.state must be ${STATE_RETRY_WAIT}`);
  }
  const normalized = {
    issue_number: issueNumber,
    state,
    attempt: positiveInteger(retryAttempt.attempt, `${pathPrefix}.attempt`),
    max_attempts: positiveInteger(retryAttempt.max_attempts, `${pathPrefix}.max_attempts`),
    delay_ms: nonNegativeNumber(retryAttempt.delay_ms, `${pathPrefix}.delay_ms`),
    due_at: assertTimestamp(retryAttempt.due_at, `${pathPrefix}.due_at`),
    reason: nonEmptyString(retryAttempt.reason, `${pathPrefix}.reason`),
    updated_at: assertTimestamp(retryAttempt.updated_at, `${pathPrefix}.updated_at`)
  };
  for (const field of ["last_error", "branch_name", "worktree_path", "manifest_path"]) {
    assertOptionalString(retryAttempt[field], `${pathPrefix}.${field}`);
    if (retryAttempt[field] !== undefined) {
      normalized[field] = retryAttempt[field];
    }
  }
  return normalized;
}

function normalizeRetryObject(retry, pathPrefix) {
  if (!isPlainObject(retry)) {
    throw new Error(`${pathPrefix} must be an object`);
  }
  const normalized = {
    attempt: positiveInteger(retry.attempt, `${pathPrefix}.attempt`),
    maxAttempts: positiveInteger(retry.maxAttempts ?? retry.max_attempts, `${pathPrefix}.maxAttempts`),
    delayMs: nonNegativeNumber(retry.delayMs ?? retry.delay_ms, `${pathPrefix}.delayMs`),
    reason: nonEmptyString(retry.reason, `${pathPrefix}.reason`)
  };
  if (retry.dueAt !== undefined || retry.due_at !== undefined) {
    normalized.dueAt = assertTimestamp(retry.dueAt ?? retry.due_at, `${pathPrefix}.dueAt`);
  }
  if (retry.lastError !== undefined || retry.last_error !== undefined) {
    normalized.lastError = nonEmptyString(retry.lastError ?? retry.last_error, `${pathPrefix}.lastError`);
  }
  return normalized;
}

function normalizeTransition(transition, defaultTimestamp = null, pathPrefix = "transition") {
  if (!isPlainObject(transition)) {
    throw new Error(`${pathPrefix} must be an object`);
  }
  assertKnownState(transition.from, `${pathPrefix}.from`);
  assertKnownState(transition.to, `${pathPrefix}.to`);
  const at = assertTimestamp(transition.at || defaultTimestamp, `${pathPrefix}.at`);
  const normalized = {
    at,
    from: transition.from,
    to: transition.to,
    reason: nonEmptyString(transition.reason, `${pathPrefix}.reason`),
    terminal: Boolean(transition.terminal)
  };
  normalized.actions = arrayOfStrings(transition.actions || [], `${pathPrefix}.actions`);
  normalized.durable_writes = arrayOfStrings(
    transition.durable_writes || transition.durableWrites || [],
    `${pathPrefix}.durable_writes`
  );
  if (transition.retry !== undefined && transition.retry !== null) {
    normalized.retry = normalizeRetryObject(transition.retry, `${pathPrefix}.retry`);
  }
  return normalized;
}

function normalizeCodexTotals(totals = defaultCodexTotals()) {
  if (!isPlainObject(totals)) {
    throw new Error("codex_totals must be an object");
  }
  return {
    input_tokens: nonNegativeNumber(totals.input_tokens ?? totals.inputTokens ?? 0, "codex_totals.input_tokens"),
    output_tokens: nonNegativeNumber(totals.output_tokens ?? totals.outputTokens ?? 0, "codex_totals.output_tokens"),
    total_tokens: nonNegativeNumber(totals.total_tokens ?? totals.totalTokens ?? 0, "codex_totals.total_tokens"),
    seconds_running: nonNegativeNumber(totals.seconds_running ?? totals.secondsRunning ?? 0, "codex_totals.seconds_running")
  };
}

function defaultCodexTotals() {
  return {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    seconds_running: 0
  };
}

function assertKnownState(state, label) {
  if (!KNOWN_STATES.has(state)) {
    throw new Error(`${label} is unknown orchestrator state: ${state}`);
  }
}

function assertTimestamp(value, label) {
  if (typeof value !== "string" || value.length === 0 || Number.isNaN(new Date(value).valueOf())) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return value;
}

function toIsoTimestamp(value, label) {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) {
      throw new Error(`${label} must be a valid timestamp`);
    }
    return value.toISOString();
  }
  return assertTimestamp(value, label);
}

function positiveInteger(value, label) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return numeric;
}

function nonNegativeNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return numeric;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertOptionalString(value, label) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(`${label} must be a string when present`);
  }
}

function arrayOfStrings(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error(`${label} must contain only strings`);
    }
  }
  return value;
}

function copyDefined(target, source, fields) {
  for (const field of fields) {
    if (source[field] !== undefined && source[field] !== null) {
      target[field] = source[field];
    }
  }
}

function copyOptionalPositiveInteger(target, source, field, label) {
  if (source[field] !== undefined) {
    target[field] = positiveInteger(source[field], label);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addMilliseconds(timestamp, milliseconds) {
  const numeric = nonNegativeNumber(milliseconds, "retry.delayMs");
  return new Date(new Date(timestamp).valueOf() + numeric).toISOString();
}
