import { normalizeToolPolicyDecisionEvidenceList } from "./orchestratorToolEvidence.mjs";
import { decideToolPolicy } from "./orchestratorToolPolicy.mjs";

export const TOOL_DRY_RUN_VERSION = 1;

const DRY_RUN_RESULT_SUMMARY = Object.freeze({
  mode: "dry_run_only",
  executed: false
});

const UNAVAILABLE_REASONS = new Set([
  "tool_not_in_accepted_snapshot",
  "tool_unavailable",
  "tool_runtime_unavailable",
  "tool_disconnected",
  "tool_auth_expired",
  "tool_auth_revoked",
  "tool_auth_unavailable"
]);

const MALFORMED_REASONS = new Set([
  "capability_snapshot_invalid",
  "tool_dry_run_secret_input_denied",
  "tool_policy_invalid"
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

export function runToolPolicyDryRun(input = {}) {
  if (!isPlainObject(input)) {
    return failure("tool_dry_run_invalid", [{
      path: "input",
      reason: "malformed_tool_dry_run_input",
      message: "tool dry-run input must be an object"
    }]);
  }

  const requests = input.requests ?? [];
  if (!Array.isArray(requests)) {
    return failure("tool_dry_run_invalid", [{
      path: "requests",
      reason: "malformed_tool_dry_run_requests",
      message: "requests must be an array"
    }]);
  }

  const approvalContexts = input.approvalContexts ?? input.approvals ?? [];
  if (!Array.isArray(approvalContexts)) {
    return failure("tool_dry_run_invalid", [{
      path: "approvalContexts",
      reason: "malformed_tool_dry_run_approvals",
      message: "approvalContexts must be an array when provided"
    }]);
  }

  const results = requests
    .map((request, index) => evaluateRequest(input.capabilitySnapshot, request, {
      approvalContexts,
      path: `requests.${index}`
    }))
    .sort(compareResults);
  const toolPolicyDecisions = normalizeToolPolicyDecisionEvidenceList(
    results
      .map((result) => result.evidence)
      .filter((evidence) => evidence !== null)
  );

  return {
    ok: true,
    reason: "tool_dry_run_completed",
    dry_run: true,
    dry_run_version: TOOL_DRY_RUN_VERSION,
    summary: summarize(results),
    results,
    tool_policy_decisions: toolPolicyDecisions,
    errors: results.flatMap((result) => result.errors)
  };
}

function evaluateRequest(capabilitySnapshot, request, { approvalContexts, path }) {
  if (!isPlainObject(request)) {
    return dryRunResult({
      allowed: false,
      reason: "tool_policy_invalid",
      errors: [{
        path,
        reason: "malformed_tool_request",
        message: "tool request must be an object"
      }]
    });
  }

  const secretErrors = [];
  scanForSecrets(request, path, secretErrors);
  if (secretErrors.length > 0) {
    return dryRunResult({
      allowed: false,
      reason: "tool_dry_run_secret_input_denied",
      tool_id: safeString(request.tool_id),
      action: safeString(request.action),
      category: safeString(request.category),
      errors: secretErrors
    });
  }

  const enrichedRequest = applyApprovalContext(request, approvalContexts);
  const appliedSecretErrors = [];
  scanForSecrets(enrichedRequest, path, appliedSecretErrors);
  if (appliedSecretErrors.length > 0) {
    return dryRunResult({
      allowed: false,
      reason: "tool_dry_run_secret_input_denied",
      tool_id: safeString(request.tool_id),
      action: safeString(request.action),
      category: safeString(request.category),
      errors: appliedSecretErrors
    });
  }

  const decision = decideToolPolicy(capabilitySnapshot, enrichedRequest);
  return dryRunResultFromDecision(decision);
}

function dryRunResultFromDecision(decision) {
  const evidenceInput = {
    ...decision,
    result_summary: DRY_RUN_RESULT_SUMMARY
  };
  let evidence = null;
  const errors = normalizeErrors(decision.errors);
  try {
    evidence = normalizeToolPolicyDecisionEvidenceList([evidenceInput])[0];
  } catch (error) {
    errors.push({
      path: "tool_policy_decision",
      reason: "tool_dry_run_evidence_unavailable",
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return dryRunResult({
    ok: decision.ok === true,
    allowed: decision.allowed === true,
    reason: nonEmptyStringOr(decision.reason, "tool_policy_invalid"),
    tool_id: stringOrNull(decision.tool_id ?? decision.evidence?.requested?.tool_id),
    action: stringOrNull(decision.evidence?.requested?.action),
    category: stringOrNull(decision.category ?? decision.evidence?.requested?.category),
    risk_class: stringOrNull(decision.risk_class),
    requires_explicit_approval: Boolean(decision.requires_explicit_approval),
    approval_satisfied: Boolean(decision.approval_satisfied),
    availability_reason: stringOrNull(decision.evidence?.availability_reason),
    evidence,
    errors
  });
}

function dryRunResult({
  ok = false,
  allowed,
  reason,
  tool_id = null,
  action = null,
  category = null,
  risk_class = null,
  requires_explicit_approval = false,
  approval_satisfied = false,
  availability_reason = null,
  evidence = null,
  errors = []
}) {
  return {
    ok,
    allowed: allowed === true,
    decision: allowed === true ? "allow" : "block",
    reason,
    tool_id,
    action,
    category,
    risk_class,
    requires_explicit_approval,
    approval_satisfied,
    availability_reason,
    result_summary: DRY_RUN_RESULT_SUMMARY,
    evidence,
    errors: normalizeErrors(errors)
  };
}

function summarize(results) {
  const summary = {
    total: results.length,
    allowed: 0,
    blocked: 0,
    approval_required: 0,
    unavailable: 0,
    malformed: 0
  };

  for (const result of results) {
    if (result.allowed) {
      summary.allowed += 1;
    } else {
      summary.blocked += 1;
    }
    if (result.requires_explicit_approval || result.reason.endsWith("_approval_required")) {
      summary.approval_required += 1;
    }
    if (UNAVAILABLE_REASONS.has(result.reason)) {
      summary.unavailable += 1;
    }
    if (MALFORMED_REASONS.has(result.reason) || result.evidence === null) {
      summary.malformed += 1;
    }
  }

  return summary;
}

function applyApprovalContext(request, approvalContexts) {
  const context = isPlainObject(request.context) ? request.context : {};
  if (request.context !== undefined && !isPlainObject(request.context)) {
    return request;
  }
  if (isPlainObject(context.approval)) {
    return request;
  }

  const approval = approvalContexts.find((entry) => approvalMatchesRequest(entry, request, context));
  if (!approval) {
    return request;
  }

  return {
    ...request,
    context: {
      ...context,
      approval: canonicalizeJson(approval)
    }
  };
}

function approvalMatchesRequest(approval, request, context) {
  if (!isPlainObject(approval) || approval.approved !== true) {
    return false;
  }
  if (approval.tool_id !== request.tool_id || approval.action !== request.action || approval.category !== request.category) {
    return false;
  }
  if (approval.operation !== undefined && approval.operation !== context.operation) {
    return false;
  }
  if (approval.target_environment !== undefined && approval.target_environment !== context.target_environment) {
    return false;
  }
  return true;
}

function compareResults(left, right) {
  return (
    sortValue(left.tool_id).localeCompare(sortValue(right.tool_id))
    || sortValue(left.action).localeCompare(sortValue(right.action))
    || sortValue(left.category).localeCompare(sortValue(right.category))
    || left.reason.localeCompare(right.reason)
  );
}

function normalizeErrors(errors = []) {
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors
    .map((error) => ({
      path: stringOrNull(error?.path),
      reason: stringOrNull(error?.reason) ?? "tool_dry_run_error",
      message: stringOrNull(error?.message) ?? stringOrNull(error?.reason) ?? "tool dry-run error"
    }))
    .sort((left, right) => (
      sortValue(left.path).localeCompare(sortValue(right.path))
      || left.reason.localeCompare(right.reason)
      || left.message.localeCompare(right.message)
    ));
}

function failure(reason, errors) {
  return {
    ok: false,
    reason,
    dry_run: true,
    dry_run_version: TOOL_DRY_RUN_VERSION,
    summary: {
      total: 0,
      allowed: 0,
      blocked: 0,
      approval_required: 0,
      unavailable: 0,
      malformed: 0
    },
    results: [],
    tool_policy_decisions: [],
    errors: normalizeErrors(errors)
  };
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
          reason: "tool_dry_run_secret_field_denied",
          message: "secret-like request field is not accepted by dry-run tool policy harness"
        });
      }
      scanForSecrets(entry, `${path}.${key}`, errors);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    errors.push({
      path,
      reason: "tool_dry_run_secret_value_denied",
      message: "secret-like request value is not accepted by dry-run tool policy harness"
    });
  }
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJson(entry));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalizeJson(entryValue)])
    );
  }
  return value;
}

function safeString(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value)) ? "[redacted]" : value;
}

function nonEmptyStringOr(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sortValue(value) {
  return value ?? "\uffff";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
