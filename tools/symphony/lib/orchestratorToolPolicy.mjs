import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_RISK_CLASSES,
  CAPABILITY_SNAPSHOT_VERSION,
  isKnownCapabilityCategory
} from "./orchestratorCapabilitySnapshot.mjs";

export const TOOL_POLICY_VERSION = 1;

export const TOOL_POLICY_DECISIONS = Object.freeze({
  allow: "allow",
  block: "block"
});

const HIGH_RISK_CATEGORIES = new Set([
  CAPABILITY_CATEGORIES.githubMutation,
  CAPABILITY_CATEGORIES.browserProductionMutation,
  CAPABILITY_CATEGORIES.supabaseWrite,
  CAPABILITY_CATEGORIES.shellHighRisk,
  CAPABILITY_CATEGORIES.credentialConnectorRead,
  CAPABILITY_CATEGORIES.credentialConnectorWrite
]);

const WRITE_CATEGORIES = new Set([
  CAPABILITY_CATEGORIES.repoFileWrite,
  CAPABILITY_CATEGORIES.githubMutation,
  CAPABILITY_CATEGORIES.browserProductionMutation,
  CAPABILITY_CATEGORIES.supabaseWrite,
  CAPABILITY_CATEGORIES.shellHighRisk,
  CAPABILITY_CATEGORIES.credentialConnectorWrite
]);

const UNAVAILABLE_CREDENTIAL_STATES = new Set([
  "disconnected",
  "expired",
  "revoked",
  "unavailable"
]);

const SECRET_KEY_PATTERN = /(^|[_-])(api[_-]?key|auth[_-]?token|bearer|cookie|database[_-]?url|password|private[_-]?key|secret|token)([_-]|$)/i;
const SECRET_VALUE_PATTERNS = [
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\b(postgres|postgresql|mysql|mongodb):\/\/[^/\s:@]+:[^@\s]+@/i
];

export function decideToolPolicy(capabilitySnapshot, request = {}) {
  const errors = [];
  const snapshotValidation = validateSnapshot(capabilitySnapshot);
  if (!snapshotValidation.ok) {
    return blockDecision({
      reason: "capability_snapshot_invalid",
      request,
      errors: snapshotValidation.errors
    });
  }

  if (!isPlainObject(request)) {
    return blockDecision({
      reason: "tool_policy_invalid",
      request: {},
      errors: [{
        path: "request",
        reason: "malformed_tool_request",
        message: "tool request must be an object"
      }]
    });
  }

  scanForSecrets(request, "request", errors);

  const normalizedRequest = normalizeRequest(request, errors);
  if (errors.length > 0) {
    return blockDecision({
      reason: "tool_policy_invalid",
      request: normalizedRequest,
      errors
    });
  }

  const tool = capabilitySnapshot.tools.find((entry) => entry.tool_id === normalizedRequest.tool_id);
  if (!tool) {
    return blockDecision({
      reason: "tool_not_in_accepted_snapshot",
      request: normalizedRequest,
      errors: [{
        path: "request.tool_id",
        reason: "tool_not_in_accepted_snapshot",
        message: `tool is not present in accepted capability snapshot: ${normalizedRequest.tool_id}`
      }]
    });
  }

  const evidenceBase = buildEvidence(normalizedRequest, tool, false, "pending");
  const availabilityReason = toolAvailabilityReason(tool);
  if (availabilityReason) {
    return blockDecision({
      reason: availabilityReason,
      request: normalizedRequest,
      tool,
      evidence: {
        ...evidenceBase,
        availability_reason: tool.availability_reason ?? availabilityReason
      },
      errors: [{
        path: `snapshot.tools.${tool.tool_id}.available`,
        reason: availabilityReason,
        message: `tool is unavailable: ${tool.tool_id}`
      }]
    });
  }

  if (normalizedRequest.category !== tool.category) {
    return blockDecision({
      reason: "tool_category_mismatch",
      request: normalizedRequest,
      tool,
      evidence: evidenceBase,
      errors: [{
        path: "request.category",
        reason: "tool_category_mismatch",
        message: `requested category ${normalizedRequest.category} does not match accepted category ${tool.category}`
      }]
    });
  }

  if (tool.denied_actions.includes(normalizedRequest.action)) {
    return blockDecision({
      reason: "tool_action_denied",
      request: normalizedRequest,
      tool,
      evidence: evidenceBase,
      errors: [{
        path: "request.action",
        reason: "tool_action_denied",
        message: `requested action is explicitly denied for tool: ${normalizedRequest.action}`
      }]
    });
  }

  if (!tool.approved_actions.includes(normalizedRequest.action)) {
    return blockDecision({
      reason: "tool_action_not_approved",
      request: normalizedRequest,
      tool,
      evidence: evidenceBase,
      errors: [{
        path: "request.action",
        reason: "tool_action_not_approved",
        message: `requested action is not approved for tool: ${normalizedRequest.action}`
      }]
    });
  }

  const approvalRequirement = approvalRequirementFor(tool, normalizedRequest);
  const approvalSatisfied = isApprovalSatisfied(normalizedRequest, approvalRequirement);
  if (approvalRequirement.required && !approvalSatisfied) {
    return blockDecision({
      reason: approvalRequirement.reason,
      request: normalizedRequest,
      tool,
      evidence: buildEvidence(normalizedRequest, tool, false, approvalRequirement.reason, {
        approval_requirement: approvalRequirement.reason
      }),
      errors: [{
        path: "request.context.approval",
        reason: approvalRequirement.reason,
        message: approvalRequirement.message
      }]
    });
  }

  return {
    ok: true,
    allowed: true,
    decision: TOOL_POLICY_DECISIONS.allow,
    reason: "tool_allowed",
    tool_id: normalizedRequest.tool_id,
    category: tool.category,
    risk_class: tool.risk_class,
    requires_explicit_approval: approvalRequirement.required,
    approval_satisfied: approvalRequirement.required ? true : approvalSatisfied,
    evidence: buildEvidence(normalizedRequest, tool, true, "tool_allowed", {
      approval_requirement: approvalRequirement.required ? approvalRequirement.reason : null
    }),
    errors: []
  };
}

export function isHighRiskToolCategory(category) {
  return HIGH_RISK_CATEGORIES.has(category);
}

function validateSnapshot(snapshot) {
  const errors = [];
  if (!isPlainObject(snapshot)) {
    return {
      ok: false,
      errors: [{
        path: "snapshot",
        reason: "malformed_capability_snapshot",
        message: "capability snapshot must be an object"
      }]
    };
  }
  scanForSecrets(snapshot, "snapshot", errors);
  if (snapshot.ok !== true) {
    errors.push({
      path: "snapshot.ok",
      reason: "capability_snapshot_invalid",
      message: "capability snapshot must be a successful accepted snapshot"
    });
  }
  if (snapshot.schema_version !== CAPABILITY_SNAPSHOT_VERSION) {
    errors.push({
      path: "snapshot.schema_version",
      reason: "capability_snapshot_schema_mismatch",
      message: `capability snapshot schema_version must be ${CAPABILITY_SNAPSHOT_VERSION}`
    });
  }
  if (!Array.isArray(snapshot.tools)) {
    errors.push({
      path: "snapshot.tools",
      reason: "malformed_capability_tools",
      message: "capability snapshot tools must be an array"
    });
  }
  if (typeof snapshot.fingerprint !== "string" || !snapshot.fingerprint.startsWith("sha256:")) {
    errors.push({
      path: "snapshot.fingerprint",
      reason: "capability_snapshot_fingerprint_missing",
      message: "capability snapshot fingerprint must be present"
    });
  }

  const seenKeys = new Set();
  for (const [index, tool] of (Array.isArray(snapshot.tools) ? snapshot.tools : []).entries()) {
    const path = `snapshot.tools.${index}`;
    if (!isPlainObject(tool)) {
      errors.push({
        path,
        reason: "malformed_capability_tool",
        message: "capability snapshot tool must be an object"
      });
      continue;
    }
    validateToolShape(tool, path, errors);
    const key = `${tool.tool_id}:${tool.category}`;
    if (seenKeys.has(key)) {
      errors.push({
        path,
        reason: "duplicate_capability_tool",
        message: `duplicate capability entry for ${key}`
      });
    }
    seenKeys.add(key);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function validateToolShape(tool, path, errors) {
  if (!nonEmptyString(tool.tool_id)) {
    errors.push({
      path: `${path}.tool_id`,
      reason: "missing_capability_required_field",
      message: "tool_id must be a non-empty string"
    });
  }
  if (!nonEmptyString(tool.category) || !isKnownCapabilityCategory(tool.category)) {
    errors.push({
      path: `${path}.category`,
      reason: "unknown_capability_category",
      message: "tool category must be a known capability category"
    });
  }
  if (typeof tool.available !== "boolean") {
    errors.push({
      path: `${path}.available`,
      reason: "invalid_capability_boolean",
      message: "tool.available must be a boolean"
    });
  }
  if (!Object.values(CAPABILITY_RISK_CLASSES).includes(tool.risk_class)) {
    errors.push({
      path: `${path}.risk_class`,
      reason: "invalid_capability_risk_class",
      message: "tool.risk_class must be a known risk class"
    });
  }
  if (!Array.isArray(tool.approved_actions) || tool.approved_actions.some((action) => !nonEmptyString(action))) {
    errors.push({
      path: `${path}.approved_actions`,
      reason: "invalid_capability_string_array",
      message: "approved_actions must be an array of non-empty strings"
    });
  }
  if (!Array.isArray(tool.denied_actions) || tool.denied_actions.some((action) => !nonEmptyString(action))) {
    errors.push({
      path: `${path}.denied_actions`,
      reason: "invalid_capability_string_array",
      message: "denied_actions must be an array of non-empty strings"
    });
  }
  if (typeof tool.requires_explicit_approval !== "boolean") {
    errors.push({
      path: `${path}.requires_explicit_approval`,
      reason: "invalid_capability_boolean",
      message: "requires_explicit_approval must be a boolean"
    });
  }
}

function normalizeRequest(request, errors) {
  const context = isPlainObject(request.context) ? request.context : {};
  if (request.context !== undefined && !isPlainObject(request.context)) {
    errors.push({
      path: "request.context",
      reason: "malformed_tool_context",
      message: "request.context must be an object when provided"
    });
  }

  const toolId = requiredString(request.tool_id, "request.tool_id", errors);
  const action = requiredString(request.action, "request.action", errors);
  const category = requiredString(request.category, "request.category", errors);
  if (category && !isKnownCapabilityCategory(category)) {
    errors.push({
      path: "request.category",
      reason: "unknown_capability_category",
      message: `unknown capability category: ${category}`
    });
  }

  const production = booleanFromContext(context.production)
    || stringOrNull(context.target_environment) === "production";
  const credentialBearing = booleanFromContext(context.credential_bearing);
  const operation = stringOrNull(context.operation);

  return {
    tool_id: toolId,
    action,
    category,
    context: {
      risk_class: stringOrNull(context.risk_class),
      operation,
      target_environment: stringOrNull(context.target_environment),
      production,
      credential_bearing: credentialBearing,
      approval: normalizeApproval(context.approval)
    }
  };
}

function approvalRequirementFor(tool, request) {
  if (request.context.production && isMutationRequest(request)) {
    return {
      required: true,
      reason: "production_mutation_approval_required",
      message: "production mutation requires exact explicit approval"
    };
  }
  if (request.context.credential_bearing && isWriteCategory(request.category)) {
    return {
      required: true,
      reason: "credential_write_approval_required",
      message: "credential-bearing write requires exact explicit approval"
    };
  }
  if (tool.requires_explicit_approval || isHighRiskToolCategory(request.category) || tool.risk_class === CAPABILITY_RISK_CLASSES.high) {
    return {
      required: true,
      reason: "tool_approval_required",
      message: "high-risk tool category requires exact explicit approval"
    };
  }
  return {
    required: false,
    reason: null,
    message: null
  };
}

function isApprovalSatisfied(request, requirement) {
  const approval = request.context.approval;
  if (!isPlainObject(approval) || approval.approved !== true) {
    return false;
  }
  if (!requirement.required) {
    return true;
  }
  return (
    approval.tool_id === request.tool_id
    && approval.category === request.category
    && approval.action === request.action
    && (approval.operation === undefined || approval.operation === request.context.operation)
    && (approval.target_environment === undefined || approval.target_environment === request.context.target_environment)
    && (approval.reason === undefined || approval.reason === requirement.reason)
  );
}

function normalizeApproval(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function toolAvailabilityReason(tool) {
  if (tool.available !== true) {
    return tool.availability_reason ?? "tool_unavailable";
  }
  if (UNAVAILABLE_CREDENTIAL_STATES.has(tool.credential_state)) {
    switch (tool.credential_state) {
      case "disconnected":
        return "tool_disconnected";
      case "expired":
        return "tool_auth_expired";
      case "revoked":
        return "tool_auth_revoked";
      case "unavailable":
        return "tool_auth_unavailable";
      default:
        return "tool_unavailable";
    }
  }
  return null;
}

function blockDecision({ reason, request, tool = null, evidence = null, errors }) {
  const category = tool?.category ?? request?.category ?? null;
  const riskClass = tool?.risk_class ?? request?.context?.risk_class ?? null;
  const requiresExplicitApproval = Boolean(
    tool?.requires_explicit_approval
    || isHighRiskToolCategory(category)
    || riskClass === CAPABILITY_RISK_CLASSES.high
    || reason.endsWith("_approval_required")
  );
  return {
    ok: false,
    allowed: false,
    decision: TOOL_POLICY_DECISIONS.block,
    reason,
    tool_id: request?.tool_id ?? tool?.tool_id ?? null,
    category,
    risk_class: riskClass,
    requires_explicit_approval: requiresExplicitApproval,
    approval_satisfied: false,
    evidence: evidence ?? buildEvidence(request, tool, false, reason),
    errors
  };
}

function buildEvidence(request, tool, allowed, reason, extra = {}) {
  return {
    policy_version: TOOL_POLICY_VERSION,
    requested: {
      tool_id: request?.tool_id ?? null,
      action: request?.action ?? null,
      category: request?.category ?? null,
      operation: request?.context?.operation ?? null,
      target_environment: request?.context?.target_environment ?? null,
      production: request?.context?.production ?? false,
      credential_bearing: request?.context?.credential_bearing ?? false
    },
    matched_tool: tool ? {
      tool_id: tool.tool_id,
      display_name: tool.display_name,
      provider: tool.provider,
      source: tool.source
    } : null,
    allowed,
    reason,
    approval: {
      required: Boolean(extra.approval_requirement),
      requirement: extra.approval_requirement ?? null,
      satisfied: allowed ? Boolean(extra.approval_requirement) : false
    },
    availability_reason: tool?.availability_reason ?? null,
    risk_class: tool?.risk_class ?? request?.context?.risk_class ?? null
  };
}

function requiredString(value, path, errors) {
  if (nonEmptyString(value)) {
    return value;
  }
  errors.push({
    path,
    reason: "missing_tool_policy_required_field",
    message: `${path} must be a non-empty string`
  });
  return null;
}

function isMutationRequest(request) {
  if (isWriteCategory(request.category)) {
    return true;
  }
  const operation = request.context.operation ?? request.action ?? "";
  return /\b(apply|comment|create|delete|deploy|edit|merge|migrate|mutate|publish|push|submit|update|write)\b/i.test(operation);
}

function isWriteCategory(category) {
  return WRITE_CATEGORIES.has(category);
}

function scanForSecrets(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${path}.${index}`, errors));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        errors.push({
          path: `${path}.${key}`,
          reason: "tool_policy_secret_field_denied",
          message: `secret-like field is not allowed in tool policy input: ${key}`
        });
      }
      scanForSecrets(entry, `${path}.${key}`, errors);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    errors.push({
      path,
      reason: "tool_policy_secret_value_denied",
      message: "secret-like value is not allowed in tool policy input"
    });
  }
}

function booleanFromContext(value) {
  return value === true;
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
