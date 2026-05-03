import { isKnownCapabilityCategory } from "./orchestratorCapabilitySnapshot.mjs";

export const TOOL_EVIDENCE_VERSION = 1;

const SECRET_KEY_PATTERN = /(^|[_-])(api[_-]?key|auth[_-]?token|bearer|cookie|database[_-]?url|password|private[_-]?key|secret|token)([_-]|$)/i;
const SECRET_VALUE_PATTERNS = [
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\b(postgres|postgresql|mysql|mongodb):\/\/[^/\s:@]+:[^@\s]+@/i
];

export function normalizeCapabilitySnapshotEvidence(input, path = "capability_snapshot") {
  if (!isPlainObject(input)) {
    throw new Error(`${path} must be an object`);
  }
  assertSecretFree(input, path);

  const fingerprint = nonEmptyString(input.fingerprint, `${path}.fingerprint`);
  if (!fingerprint.startsWith("sha256:")) {
    throw new Error(`${path}.fingerprint must start with sha256:`);
  }

  const unavailableTools = sortToolSummaries(
    arrayOrDefault(input.unavailable_tools, `${path}.unavailable_tools`)
      .map((tool, index) => normalizeUnavailableTool(tool, `${path}.unavailable_tools.${index}`))
  );
  const approvalRequiredTools = sortToolSummaries(
    arrayOrDefault(input.approval_required_tools, `${path}.approval_required_tools`)
      .map((tool, index) => normalizeApprovalRequiredTool(tool, `${path}.approval_required_tools.${index}`))
  );

  return {
    evidence_version: TOOL_EVIDENCE_VERSION,
    fingerprint,
    catalog_version: stringOrNumberOrNull(input.catalog_version),
    generated_at: assertTimestamp(input.generated_at, `${path}.generated_at`),
    counts_by_category: normalizeCountMap(input.counts_by_category, `${path}.counts_by_category`),
    counts_by_risk: normalizeCountMap(input.counts_by_risk, `${path}.counts_by_risk`),
    unavailable_tool_count: nonNegativeInteger(
      input.unavailable_tool_count ?? unavailableTools.length,
      `${path}.unavailable_tool_count`
    ),
    unavailable_tools: unavailableTools,
    approval_required_tool_count: nonNegativeInteger(
      input.approval_required_tool_count ?? approvalRequiredTools.length,
      `${path}.approval_required_tool_count`
    ),
    approval_required_tools: approvalRequiredTools
  };
}

export function normalizeToolPolicyDecisionEvidence(input, path = "tool_policy_decision") {
  if (!isPlainObject(input)) {
    throw new Error(`${path} must be an object`);
  }
  assertSecretFree(input, path);

  const evidence = isPlainObject(input.evidence) ? input.evidence : {};
  const requested = isPlainObject(evidence.requested) ? evidence.requested : {};
  const approval = isPlainObject(evidence.approval) ? evidence.approval : {};
  const matchedTool = isPlainObject(evidence.matched_tool)
    ? evidence.matched_tool
    : isPlainObject(input.matched_tool)
      ? input.matched_tool
      : null;

  const category = nonEmptyString(input.category ?? requested.category, `${path}.category`);
  if (!isKnownCapabilityCategory(category)) {
    throw new Error(`${path}.category is unknown capability category: ${category}`);
  }

  const allowed = boolean(input.allowed, `${path}.allowed`);
  const normalized = {
    evidence_version: TOOL_EVIDENCE_VERSION,
    tool_id: nonEmptyString(input.tool_id ?? requested.tool_id, `${path}.tool_id`),
    action: nonEmptyString(input.action ?? requested.action, `${path}.action`),
    category,
    allowed,
    decision: allowed ? "allow" : "block",
    reason: nonEmptyString(input.reason ?? evidence.reason, `${path}.reason`),
    requires_explicit_approval: boolean(
      input.requires_explicit_approval ?? approval.required ?? false,
      `${path}.requires_explicit_approval`
    ),
    approval_satisfied: boolean(
      input.approval_satisfied ?? approval.satisfied ?? false,
      `${path}.approval_satisfied`
    ),
    approval_requirement: stringOrNull(approval.requirement),
    risk_class: stringOrNull(input.risk_class ?? evidence.risk_class),
    availability_reason: stringOrNull(input.availability_reason ?? evidence.availability_reason),
    matched_tool: matchedToolSummary(matchedTool),
    result_summary: plainJsonOrNull(input.result_summary ?? evidence.result_summary, `${path}.result_summary`),
    error: plainJsonOrNull(input.error ?? evidence.error, `${path}.error`),
    timed_out: optionalBoolean(input.timed_out ?? evidence.timed_out, `${path}.timed_out`)
  };

  return stripUndefined(normalized);
}

export function normalizeToolPolicyDecisionEvidenceList(input = [], path = "tool_policy_decisions") {
  const decisions = arrayOrDefault(input, path)
    .map((decision, index) => normalizeToolPolicyDecisionEvidence(decision, `${path}.${index}`));
  return decisions.sort((left, right) => (
    left.tool_id.localeCompare(right.tool_id)
    || left.action.localeCompare(right.action)
    || left.category.localeCompare(right.category)
    || left.reason.localeCompare(right.reason)
  ));
}

export function buildToolEvidenceStatus({ capabilitySnapshot = null, toolPolicyDecisions = [] } = {}, {
  recentLimit = 5
} = {}) {
  const decisions = normalizeToolPolicyDecisionEvidenceList(toolPolicyDecisions);
  const blocked = decisions.filter((decision) => decision.allowed === false);
  const allowed = decisions.filter((decision) => decision.allowed === true);

  return {
    capability_snapshot: capabilitySnapshot ? {
      present: true,
      fingerprint: capabilitySnapshot.fingerprint,
      catalog_version: capabilitySnapshot.catalog_version,
      generated_at: capabilitySnapshot.generated_at,
      unavailable_tool_count: capabilitySnapshot.unavailable_tool_count,
      approval_required_tool_count: capabilitySnapshot.approval_required_tool_count,
      counts_by_category: capabilitySnapshot.counts_by_category,
      counts_by_risk: capabilitySnapshot.counts_by_risk
    } : {
      present: false,
      fingerprint: null,
      catalog_version: null,
      generated_at: null,
      unavailable_tool_count: 0,
      approval_required_tool_count: 0,
      counts_by_category: {},
      counts_by_risk: {}
    },
    tool_policy: {
      decisions_present: decisions.length > 0,
      decision_count: decisions.length,
      allowed_count: allowed.length,
      blocked_count: blocked.length,
      recent_blocked_reasons: blocked.slice(-recentLimit).map((decision) => ({
        tool_id: decision.tool_id,
        action: decision.action,
        category: decision.category,
        reason: decision.reason
      })),
      recent_allowed_categories: uniquePreservingOrder(
        allowed.slice(-recentLimit).map((decision) => decision.category)
      )
    }
  };
}

function normalizeUnavailableTool(tool, path) {
  if (!isPlainObject(tool)) {
    throw new Error(`${path} must be an object`);
  }
  const category = nonEmptyString(tool.category, `${path}.category`);
  if (!isKnownCapabilityCategory(category)) {
    throw new Error(`${path}.category is unknown capability category: ${category}`);
  }
  return {
    tool_id: nonEmptyString(tool.tool_id, `${path}.tool_id`),
    display_name: nonEmptyString(tool.display_name ?? tool.tool_id, `${path}.display_name`),
    category,
    availability_reason: nonEmptyString(tool.availability_reason, `${path}.availability_reason`),
    credential_state: stringOrNull(tool.credential_state)
  };
}

function normalizeApprovalRequiredTool(tool, path) {
  if (!isPlainObject(tool)) {
    throw new Error(`${path} must be an object`);
  }
  const category = nonEmptyString(tool.category, `${path}.category`);
  if (!isKnownCapabilityCategory(category)) {
    throw new Error(`${path}.category is unknown capability category: ${category}`);
  }
  return {
    tool_id: nonEmptyString(tool.tool_id, `${path}.tool_id`),
    display_name: nonEmptyString(tool.display_name ?? tool.tool_id, `${path}.display_name`),
    category,
    risk_class: nonEmptyString(tool.risk_class, `${path}.risk_class`),
    availability_reason: stringOrNull(tool.availability_reason),
    credential_state: stringOrNull(tool.credential_state)
  };
}

function matchedToolSummary(tool) {
  if (!tool) {
    return null;
  }
  return {
    tool_id: stringOrNull(tool.tool_id),
    display_name: stringOrNull(tool.display_name),
    provider: stringOrNull(tool.provider),
    source: stringOrNull(tool.source)
  };
}

function normalizeCountMap(value = {}, path) {
  if (!isPlainObject(value)) {
    throw new Error(`${path} must be an object`);
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => [key, nonNegativeInteger(count, `${path}.${key}`)])
  );
}

function sortToolSummaries(tools) {
  return tools.sort((left, right) => (
    left.category.localeCompare(right.category)
    || left.tool_id.localeCompare(right.tool_id)
  ));
}

function assertSecretFree(value, path) {
  const errors = [];
  scanForSecrets(value, path, errors);
  if (errors.length > 0) {
    const first = errors[0];
    throw new Error(`${first.path}: ${first.reason}`);
  }
}

function scanForSecrets(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${path}.${index}`, errors));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        errors.push({ path: `${path}.${key}`, reason: "tool_evidence_secret_field_denied" });
      }
      scanForSecrets(entry, `${path}.${key}`, errors);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    errors.push({ path, reason: "tool_evidence_secret_value_denied" });
  }
}

function plainJsonOrNull(value, path) {
  if (value === undefined || value === null) {
    return null;
  }
  return canonicalizeJson(value, path);
}

function canonicalizeJson(value, path) {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => canonicalizeJson(entry, `${path}.${index}`));
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

function arrayOrDefault(value, path) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value;
}

function nonNegativeInteger(value, path) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`${path} must be a non-negative integer`);
  }
  return numeric;
}

function nonEmptyString(value, path) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function assertTimestamp(value, path) {
  if (typeof value !== "string" || value.length === 0 || Number.isNaN(new Date(value).valueOf())) {
    throw new Error(`${path} must be a valid timestamp`);
  }
  return value;
}

function boolean(value, path) {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`);
  }
  return value;
}

function optionalBoolean(value, path) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return boolean(value, path);
}

function stringOrNumberOrNull(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stripUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function uniquePreservingOrder(values) {
  return Array.from(new Set(values));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
