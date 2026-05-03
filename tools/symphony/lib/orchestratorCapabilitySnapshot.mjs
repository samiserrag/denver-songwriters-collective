import { createHash } from "node:crypto";

export const CAPABILITY_SNAPSHOT_VERSION = 1;

export const CAPABILITY_CATEGORIES = Object.freeze({
  repoFileRead: "repo_file_read",
  repoFileWrite: "repo_file_write",
  githubRead: "github_read",
  githubMutation: "github_mutation",
  browserPreviewVerification: "browser_preview_verification",
  browserProductionMutation: "browser_production_mutation",
  supabaseRead: "supabase_read",
  supabaseWrite: "supabase_write",
  axiomRead: "axiom_read",
  shellSafe: "shell_safe",
  shellHighRisk: "shell_high_risk",
  credentialConnectorRead: "credential_connector_read",
  credentialConnectorWrite: "credential_connector_write"
});

export const CAPABILITY_RISK_CLASSES = Object.freeze({
  low: "low",
  medium: "medium",
  high: "high"
});

const CATEGORY_VALUES = Object.freeze(Object.values(CAPABILITY_CATEGORIES));
const CATEGORY_SET = new Set(CATEGORY_VALUES);
const RISK_VALUES = Object.freeze(Object.values(CAPABILITY_RISK_CLASSES));
const RISK_SET = new Set(RISK_VALUES);
const KNOWN_CATALOG_FIELDS = new Set([
  "catalog_version",
  "source",
  "source_version",
  "tools"
]);
const KNOWN_TOOL_FIELDS = new Set([
  "approved_actions",
  "availability_reason",
  "available",
  "category",
  "connected",
  "credential_state",
  "denied_actions",
  "display_name",
  "id",
  "metadata",
  "provider",
  "requires_explicit_approval",
  "risk_class",
  "source",
  "tool_id"
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

const DEFAULTS_BY_CATEGORY = Object.freeze({
  [CAPABILITY_CATEGORIES.repoFileRead]: {
    risk_class: CAPABILITY_RISK_CLASSES.low,
    requires_explicit_approval: false
  },
  [CAPABILITY_CATEGORIES.repoFileWrite]: {
    risk_class: CAPABILITY_RISK_CLASSES.medium,
    requires_explicit_approval: false
  },
  [CAPABILITY_CATEGORIES.githubRead]: {
    risk_class: CAPABILITY_RISK_CLASSES.medium,
    requires_explicit_approval: false
  },
  [CAPABILITY_CATEGORIES.githubMutation]: {
    risk_class: CAPABILITY_RISK_CLASSES.high,
    requires_explicit_approval: true
  },
  [CAPABILITY_CATEGORIES.browserPreviewVerification]: {
    risk_class: CAPABILITY_RISK_CLASSES.medium,
    requires_explicit_approval: false
  },
  [CAPABILITY_CATEGORIES.browserProductionMutation]: {
    risk_class: CAPABILITY_RISK_CLASSES.high,
    requires_explicit_approval: true
  },
  [CAPABILITY_CATEGORIES.supabaseRead]: {
    risk_class: CAPABILITY_RISK_CLASSES.medium,
    requires_explicit_approval: false
  },
  [CAPABILITY_CATEGORIES.supabaseWrite]: {
    risk_class: CAPABILITY_RISK_CLASSES.high,
    requires_explicit_approval: true
  },
  [CAPABILITY_CATEGORIES.axiomRead]: {
    risk_class: CAPABILITY_RISK_CLASSES.medium,
    requires_explicit_approval: false
  },
  [CAPABILITY_CATEGORIES.shellSafe]: {
    risk_class: CAPABILITY_RISK_CLASSES.medium,
    requires_explicit_approval: false
  },
  [CAPABILITY_CATEGORIES.shellHighRisk]: {
    risk_class: CAPABILITY_RISK_CLASSES.high,
    requires_explicit_approval: true
  },
  [CAPABILITY_CATEGORIES.credentialConnectorRead]: {
    risk_class: CAPABILITY_RISK_CLASSES.high,
    requires_explicit_approval: true
  },
  [CAPABILITY_CATEGORIES.credentialConnectorWrite]: {
    risk_class: CAPABILITY_RISK_CLASSES.high,
    requires_explicit_approval: true
  }
});

export function buildCapabilitySnapshot(catalogInput = {}, options = {}) {
  let generatedAt = null;
  const errors = [];

  try {
    generatedAt = toIsoTimestamp(options.now ?? new Date(), "now");
    if (!isPlainObject(catalogInput)) {
      return failure("capability_snapshot_invalid", [{
        path: "catalog",
        reason: "malformed_capability_catalog",
        message: "capability catalog must be an object"
      }], generatedAt);
    }

    scanForSecrets(catalogInput, "catalog", errors);

    const toolsInput = catalogInput.tools ?? [];
    if (!Array.isArray(toolsInput)) {
      errors.push({
        path: "catalog.tools",
        reason: "malformed_capability_tools",
        message: "catalog.tools must be an array"
      });
    }

    const tools = [];
    const seenKeys = new Set();
    for (const [index, toolInput] of (Array.isArray(toolsInput) ? toolsInput : []).entries()) {
      const tool = normalizeTool(toolInput, `catalog.tools.${index}`, errors);
      if (!tool) {
        continue;
      }
      const key = `${tool.tool_id}:${tool.category}`;
      if (seenKeys.has(key)) {
        errors.push({
          path: `catalog.tools.${index}`,
          reason: "duplicate_capability_tool",
          message: `duplicate capability entry for ${key}`
        });
        continue;
      }
      seenKeys.add(key);
      tools.push(tool);
    }

    const sortedTools = tools.sort(compareTools);
    const snapshot = {
      schema_version: CAPABILITY_SNAPSHOT_VERSION,
      ok: true,
      reason: null,
      generated_at: generatedAt,
      catalog_version: normalizeCatalogVersion(catalogInput.catalog_version, errors),
      source: stringOrNull(catalogInput.source),
      source_version: stringOrNumberOrNull(catalogInput.source_version),
      tools: sortedTools,
      counts_by_category: countBy(CATEGORY_VALUES, sortedTools, "category"),
      counts_by_risk: countBy(RISK_VALUES, sortedTools, "risk_class"),
      unavailable_tools: sortedTools
        .filter((tool) => tool.available === false)
        .map((tool) => unavailableToolSummary(tool)),
      approval_required_tools: sortedTools
        .filter((tool) => tool.requires_explicit_approval === true)
        .map((tool) => approvalRequiredToolSummary(tool)),
      fingerprint: null,
      unknown_fields: unknownFields(catalogInput, KNOWN_CATALOG_FIELDS)
    };
    snapshot.fingerprint = hashCanonical(fingerprintPayload(snapshot));

    if (errors.length > 0) {
      return failure("capability_snapshot_invalid", errors, generatedAt);
    }

    return snapshot;
  } catch (error) {
    return failure("capability_snapshot_invalid", [{
      path: "capability_snapshot",
      reason: "capability_snapshot_error",
      message: error instanceof Error ? error.message : String(error)
    }], generatedAt);
  }
}

export function isKnownCapabilityCategory(category) {
  return CATEGORY_SET.has(category);
}

function normalizeTool(toolInput, path, errors) {
  if (!isPlainObject(toolInput)) {
    errors.push({
      path,
      reason: "malformed_capability_tool",
      message: "capability tool entry must be an object"
    });
    return null;
  }

  const toolId = requiredString(toolInput.tool_id ?? toolInput.id, `${path}.tool_id`, errors);
  const category = requiredString(toolInput.category, `${path}.category`, errors);
  if (category && !CATEGORY_SET.has(category)) {
    errors.push({
      path: `${path}.category`,
      reason: "unknown_capability_category",
      message: `unknown capability category: ${category}`
    });
  }

  const defaults = DEFAULTS_BY_CATEGORY[category] ?? {
    risk_class: CAPABILITY_RISK_CLASSES.high,
    requires_explicit_approval: true
  };
  const riskClass = normalizeRiskClass(toolInput.risk_class, defaults.risk_class, `${path}.risk_class`, errors);
  const credentialState = normalizeCredentialState(toolInput.credential_state);
  const availability = normalizeAvailability(toolInput, credentialState);
  const approvedActions = normalizeStringArray(
    toolInput.approved_actions,
    `${path}.approved_actions`,
    errors
  );
  const deniedActions = normalizeStringArray(
    toolInput.denied_actions,
    `${path}.denied_actions`,
    errors
  );
  const metadata = normalizeMetadata(toolInput.metadata, `${path}.metadata`, errors);

  if (!toolId || !category) {
    return null;
  }

  return {
    tool_id: toolId,
    display_name: stringOrNull(toolInput.display_name) ?? toolId,
    provider: stringOrNull(toolInput.provider),
    source: stringOrNull(toolInput.source),
    category,
    available: availability.available,
    availability_reason: availability.reason,
    credential_state: credentialState,
    risk_class: riskClass,
    approved_actions: approvedActions,
    denied_actions: deniedActions,
    requires_explicit_approval: normalizeBoolean(
      toolInput.requires_explicit_approval,
      defaults.requires_explicit_approval,
      `${path}.requires_explicit_approval`,
      errors
    ),
    metadata,
    unknown_fields: unknownFields(toolInput, KNOWN_TOOL_FIELDS)
  };
}

function normalizeCatalogVersion(value, errors) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  errors.push({
    path: "catalog.catalog_version",
    reason: "invalid_catalog_version",
    message: "catalog_version must be a string, finite number, or null"
  });
  return null;
}

function normalizeAvailability(toolInput, credentialState) {
  if (toolInput.connected === false) {
    return {
      available: false,
      reason: stringOrNull(toolInput.availability_reason) ?? "tool_disconnected"
    };
  }
  if (UNAVAILABLE_CREDENTIAL_STATES.has(credentialState)) {
    return {
      available: false,
      reason: stringOrNull(toolInput.availability_reason) ?? reasonForCredentialState(credentialState)
    };
  }
  if (toolInput.available === false) {
    return {
      available: false,
      reason: stringOrNull(toolInput.availability_reason) ?? "tool_unavailable"
    };
  }
  return {
    available: true,
    reason: stringOrNull(toolInput.availability_reason)
  };
}

function reasonForCredentialState(credentialState) {
  switch (credentialState) {
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

function normalizeCredentialState(value) {
  return stringOrNull(value) ?? "none";
}

function normalizeRiskClass(value, fallback, path, errors) {
  const risk = value === undefined || value === null ? fallback : value;
  if (!RISK_SET.has(risk)) {
    errors.push({
      path,
      reason: "invalid_capability_risk_class",
      message: `risk_class must be one of ${RISK_VALUES.join(", ")}`
    });
    return fallback;
  }
  return risk;
}

function normalizeBoolean(value, fallback, path, errors) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  errors.push({
    path,
    reason: "invalid_capability_boolean",
    message: `${path} must be a boolean`
  });
  return fallback;
}

function normalizeStringArray(value, path, errors) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    errors.push({
      path,
      reason: "invalid_capability_string_array",
      message: `${path} must be an array of strings`
    });
    return [];
  }
  const strings = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || entry.length === 0) {
      errors.push({
        path: `${path}.${index}`,
        reason: "invalid_capability_string_array_entry",
        message: `${path}.${index} must be a non-empty string`
      });
      continue;
    }
    strings.push(entry);
  }
  return Array.from(new Set(strings)).sort((left, right) => left.localeCompare(right));
}

function normalizeMetadata(value, path, errors) {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isPlainObject(value)) {
    errors.push({
      path,
      reason: "invalid_capability_metadata",
      message: "metadata must be an object when provided"
    });
    return {};
  }
  return canonicalizeJson(value, path);
}

function requiredString(value, path, errors) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  errors.push({
    path,
    reason: "missing_capability_required_field",
    message: `${path} must be a non-empty string`
  });
  return null;
}

function countBy(keys, tools, field) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const tool of tools) {
    counts[tool[field]] = (counts[tool[field]] ?? 0) + 1;
  }
  return counts;
}

function unavailableToolSummary(tool) {
  return {
    tool_id: tool.tool_id,
    display_name: tool.display_name,
    category: tool.category,
    availability_reason: tool.availability_reason ?? "tool_unavailable",
    credential_state: tool.credential_state
  };
}

function approvalRequiredToolSummary(tool) {
  return {
    tool_id: tool.tool_id,
    display_name: tool.display_name,
    category: tool.category,
    risk_class: tool.risk_class,
    availability_reason: tool.availability_reason,
    credential_state: tool.credential_state
  };
}

function fingerprintPayload(snapshot) {
  return {
    schema_version: snapshot.schema_version,
    catalog_version: snapshot.catalog_version,
    source: snapshot.source,
    source_version: snapshot.source_version,
    tools: snapshot.tools,
    unknown_fields: snapshot.unknown_fields
  };
}

function compareTools(left, right) {
  return (
    left.category.localeCompare(right.category)
    || left.tool_id.localeCompare(right.tool_id)
  );
}

function unknownFields(input, knownFields) {
  const unknown = {};
  for (const [key, value] of Object.entries(input)) {
    if (!knownFields.has(key) && value !== undefined) {
      unknown[key] = canonicalizeJson(value, key);
    }
  }
  return unknown;
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
          reason: "capability_secret_field_denied",
          message: `secret-like field is not allowed in capability snapshots: ${key}`
        });
      }
      scanForSecrets(entry, `${path}.${key}`, errors);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    errors.push({
      path,
      reason: "capability_secret_value_denied",
      message: "secret-like value is not allowed in capability snapshots"
    });
  }
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

function failure(reason, errors, generatedAt = null) {
  return {
    ok: false,
    reason,
    generated_at: generatedAt,
    errors
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
