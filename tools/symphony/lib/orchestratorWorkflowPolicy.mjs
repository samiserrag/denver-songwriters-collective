import { createHash } from "node:crypto";

const KNOWN_TOP_LEVEL_FIELDS = new Set([
  "config",
  "format",
  "markdown",
  "prompt_template",
  "version",
  "warnings",
  "workflow_format",
  "workflow_version"
]);
const SUPPORTED_WORKFLOW_FORMATS = new Set(["yaml-front-matter", "legacy-json-comment"]);
const REQUIRED_LABEL_KEYS = Object.freeze(["ready", "running", "humanReview", "blocked", "general"]);

export function buildWorkflowPolicySnapshot(workflowPolicy, options = {}) {
  try {
    if (!isPlainObject(workflowPolicy)) {
      throw new Error("workflow policy input must be an object");
    }
    if (!isPlainObject(workflowPolicy.config)) {
      throw new Error("workflow policy input requires config object");
    }
    const promptTemplate = workflowPolicy.prompt_template ?? workflowPolicy.markdown;
    if (typeof promptTemplate !== "string") {
      throw new Error("workflow policy input requires prompt_template string");
    }
    const workflowFormat = workflowPolicy.workflow_format ?? workflowPolicy.format;
    assertSupportedWorkflowFormat(workflowFormat);
    validateWorkflowConfigShape(workflowPolicy.config);

    const generatedAt = options.now === undefined ? null : toIsoTimestamp(options.now, "now");
    const workflowVersion = workflowPolicy.workflow_version
      ?? workflowPolicy.version
      ?? workflowPolicy.config.version
      ?? null;
    const extraPolicyFields = unknownTopLevelFields(workflowPolicy);
    const config = canonicalizeJson(workflowPolicy.config, "config");
    const prompt = promptTemplate;

    const policyPayload = canonicalizeJson({
      workflow_format: workflowFormat,
      workflow_version: workflowVersion,
      config,
      prompt_template: prompt,
      extra_policy_fields: extraPolicyFields
    }, "policy_payload");

    const configHash = hashCanonical(config);
    const promptHash = hashCanonical(prompt);
    const workflowHash = hashCanonical(policyPayload);

    return {
      ok: true,
      snapshot: {
        workflow_format: workflowFormat,
        workflow_version: workflowVersion,
        workflow_hash: workflowHash,
        config_hash: configHash,
        prompt_hash: promptHash,
        accepted_labels: config.labels ?? null,
        accepted_adapter: config.codex?.adapter ?? null,
        accepted_timeouts: acceptedTimeouts(config),
        accepted_workspace_root: config.workspace?.root ?? null,
        max_concurrent_agents: config.max_concurrent_agents ?? null,
        recovery: config.recovery ?? null,
        lock: config.lock ?? null,
        config,
        extra_policy_fields: extraPolicyFields,
        generated_at: generatedAt
      }
    };
  } catch (error) {
    return failure("workflow_policy_snapshot_failed", error);
  }
}

export function compareWorkflowPolicySnapshots(acceptedSnapshot, currentSnapshot) {
  try {
    const accepted = normalizeComparableSnapshot(acceptedSnapshot, "accepted workflow policy snapshot");
    const current = normalizeComparableSnapshot(currentSnapshot, "current workflow policy snapshot");
    const changedFields = changedWorkflowPolicyFields(accepted, current);
    const changed = changedFields.length > 0;

    return {
      ok: true,
      changed,
      changed_fields: changedFields,
      old_hash: accepted.workflow_hash,
      new_hash: current.workflow_hash,
      reason: changed ? "workflow_policy_drift" : null
    };
  } catch (error) {
    return failure("workflow_policy_snapshot_compare_failed", error);
  }
}

function normalizeComparableSnapshot(snapshot, label) {
  if (!isPlainObject(snapshot)) {
    throw new Error(`${label} must be an object`);
  }
  const workflowHash = stringOrNull(snapshot.workflow_hash ?? snapshot.hash ?? snapshot.config_hash);
  const workflowVersion = snapshot.workflow_version ?? snapshot.version ?? null;
  if (!workflowHash && workflowVersion === null) {
    throw new Error(`${label} requires workflow_hash or workflow_version`);
  }

  return {
    ...snapshot,
    workflow_hash: workflowHash,
    workflow_version: workflowVersion,
    workflow_format: stringOrNull(snapshot.workflow_format ?? snapshot.format)
  };
}

function changedWorkflowPolicyFields(accepted, current) {
  const fields = [
    "workflow_hash",
    "workflow_version",
    "workflow_format",
    "config_hash",
    "prompt_hash",
    "accepted_labels",
    "accepted_adapter",
    "accepted_timeouts",
    "accepted_workspace_root",
    "max_concurrent_agents",
    "recovery",
    "lock"
  ];
  return fields.filter((field) => !stableEqual(accepted[field] ?? null, current[field] ?? null));
}

function acceptedTimeouts(config) {
  const codex = isPlainObject(config.codex) ? config.codex : {};
  return {
    execution_timeout_minutes: codex.execution_timeout_minutes ?? null,
    execution_timeout_kill_grace_seconds: codex.execution_timeout_kill_grace_seconds ?? null
  };
}

function assertSupportedWorkflowFormat(format) {
  if (typeof format !== "string" || format.length === 0) {
    throw new Error("workflow policy input requires workflow format string");
  }
  if (!SUPPORTED_WORKFLOW_FORMATS.has(format)) {
    throw new Error(`unsupported workflow format: ${format}`);
  }
}

function validateWorkflowConfigShape(config) {
  if (config.version !== 1) {
    throw new Error("version must be 1");
  }
  if (config.max_concurrent_agents !== 1) {
    throw new Error("max_concurrent_agents must be 1 for Phase 1");
  }
  validateLabels(config.labels);
  if (!config.workspace?.root || !config.workspace?.logs || !config.workspace?.state) {
    throw new Error("workspace.root, workspace.logs, and workspace.state are required");
  }
  assertPositiveInteger(config.recovery?.stale_running_minutes, "recovery.stale_running_minutes");
  assertPositiveInteger(config.lock?.stale_minutes, "lock.stale_minutes");
  if (config.codex?.adapter !== "codex-exec") {
    throw new Error("Phase 1 supports only the codex-exec adapter");
  }
  assertPositiveNumber(config.codex?.execution_timeout_minutes, "codex.execution_timeout_minutes");
  assertPositiveNumber(
    config.codex?.execution_timeout_kill_grace_seconds,
    "codex.execution_timeout_kill_grace_seconds"
  );
}

function validateLabels(labels) {
  if (!isPlainObject(labels)) {
    throw new Error("config.labels must be an object");
  }
  const values = [];
  for (const key of REQUIRED_LABEL_KEYS) {
    const value = labels[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`labels.${key} is required`);
    }
    values.push(value);
  }
  if (new Set(values).size !== values.length) {
    throw new Error("labels must not contain duplicate values");
  }
}

function assertPositiveInteger(value, name) {
  if (value === undefined) {
    return;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertPositiveNumber(value, name) {
  if (value === undefined) {
    return;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

function unknownTopLevelFields(input) {
  const unknown = {};
  for (const [key, value] of Object.entries(input)) {
    if (!KNOWN_TOP_LEVEL_FIELDS.has(key) && value !== undefined) {
      unknown[key] = canonicalizeJson(value, key);
    }
  }
  return unknown;
}

function stableEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function hashCanonical(value) {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value) {
  return JSON.stringify(canonicalizeJson(value, "value"));
}

function canonicalizeJson(value, path) {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalizeJson(item, `${path}.${index}`));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalizeJson(entryValue, `${path}.${key}`)])
    );
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`${path} must be JSON-serializable`);
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
  return new Date(value).toISOString();
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function failure(reason, error) {
  return {
    ok: false,
    reason,
    error: error instanceof Error ? error.message : String(error)
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
