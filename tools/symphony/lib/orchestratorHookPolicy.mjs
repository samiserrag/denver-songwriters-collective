export const HOOK_POLICY_VERSION = 1;

export const HOOK_EXECUTION_MODES = Object.freeze({
  disabled: "disabled",
  dryRun: "dry_run",
  fake: "fake",
  real: "real"
});

export const EXECUTABLE_HOOK_NAMES = Object.freeze([
  "after_create",
  "before_run",
  "after_run",
  "before_remove"
]);

export const PLANNING_HOOK_POINTS = Object.freeze([
  "preflight",
  "pre_claim",
  "post_claim",
  "pre_workspace",
  "post_workspace",
  "pre_adapter",
  "post_adapter",
  "pre_reconcile",
  "post_reconcile",
  "cleanup"
]);

export const DEFAULT_HOOK_TIMEOUT_MS = 60000;
export const MAX_HOOK_TIMEOUT_MS = 300000;
export const DEFAULT_HOOK_OUTPUT_LIMIT_BYTES = 8192;
export const MAX_HOOK_OUTPUT_LIMIT_BYTES = 65536;

const EXECUTABLE_HOOK_SET = new Set(EXECUTABLE_HOOK_NAMES);
const PLANNING_HOOK_SET = new Set(PLANNING_HOOK_POINTS);
const MODE_SET = new Set(Object.values(HOOK_EXECUTION_MODES));
const KNOWN_POLICY_FIELDS = new Set([
  "enabled",
  "env",
  "hooks",
  "mode",
  "output_limit_bytes",
  "planning",
  "secret_env",
  "secrets",
  "timeout_ms"
]);
const KNOWN_HOOK_FIELDS = new Set([
  "allow_secrets",
  "command",
  "cwd",
  "env",
  "interactive",
  "output_limit_bytes",
  "secret_env",
  "secrets",
  "stdin",
  "timeout_ms",
  "tty"
]);
const ALLOWED_ENV_KEYS = new Set([
  "CI",
  "NO_COLOR",
  "SYMPHONY_HOOK_PHASE",
  "SYMPHONY_ISSUE_NUMBER",
  "SYMPHONY_ISSUE_URL",
  "SYMPHONY_LOG_PATH",
  "SYMPHONY_MANIFEST_PATH",
  "SYMPHONY_WORKFLOW_HASH",
  "SYMPHONY_WORKSPACE_PATH"
]);
const SECRET_ENV_PATTERN = /(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DATABASE)/i;
const DENIED_ENV_PREFIXES = [
  "AXIOM_",
  "CODEX_",
  "GH_",
  "GITHUB_",
  "OPENAI_",
  "ANTHROPIC_",
  "RESEND_",
  "STRIPE_",
  "SUPABASE_",
  "VERCEL_"
];
const DENIED_COMMAND_PATTERNS = [
  {
    pattern: /^gh\s+(issue\s+edit|pr\s+merge|label\b)/,
    reason: "github_mutation_command_denied"
  },
  {
    pattern: /^git\s+(push|reset\s+--hard|clean\b|checkout\s+--|worktree\s+remove|branch\s+-d|branch\s+-D)/,
    reason: "git_mutation_command_denied"
  },
  {
    pattern: /^supabase\s+(db\s+push|migration\s+up)/,
    reason: "database_mutation_command_denied"
  },
  {
    pattern: /^psql\b/,
    reason: "database_mutation_command_denied"
  },
  {
    pattern: /^vercel\s+(deploy|env\b)/,
    reason: "deployment_command_denied"
  },
  {
    pattern: /(^|\s)(sudo|su)\b/,
    reason: "privilege_escalation_command_denied"
  },
  {
    pattern: /(^|\s)(chmod|chown)\s+-R\b/,
    reason: "recursive_permission_command_denied"
  },
  {
    pattern: /\brm\s+-[^\s]*r[^\s]*f?\s+\//,
    reason: "destructive_absolute_path_command_denied"
  },
  {
    pattern: /(^|\s)(nohup|daemon)\b|&$/,
    reason: "background_process_command_denied"
  },
  {
    pattern: /\bcurl\b.*\|.*\b(sh|bash)\b|\bwget\b.*\|.*\b(sh|bash)\b/,
    reason: "pipe_to_shell_command_denied"
  }
];
const SHELL_METACHARACTER_PATTERN = /[;&|<>`$()]/;

export function validateHookPolicy(input = {}, options = {}) {
  const errors = [];

  if (input === null || input === undefined) {
    return success(normalizePolicy({}, options, errors), errors);
  }
  if (!isPlainObject(input)) {
    return failure("hook_policy_invalid", [{
      path: "policy",
      reason: "malformed_hook_policy",
      message: "hook policy must be an object"
    }]);
  }

  const policy = normalizePolicy(input, options, errors);
  if (errors.length > 0) {
    return failure("hook_policy_invalid", errors, policy);
  }

  return success(policy, errors);
}

export function isExecutableHookName(name) {
  return EXECUTABLE_HOOK_SET.has(name);
}

export function isPlanningHookPoint(name) {
  return PLANNING_HOOK_SET.has(name);
}

function normalizePolicy(input, options, errors) {
  const mode = normalizeMode(input.mode, input, options, errors);
  const timeoutMs = normalizeTimeout(input.timeout_ms, "policy.timeout_ms", errors);
  const outputLimitBytes = normalizeOutputLimit(
    input.output_limit_bytes,
    "policy.output_limit_bytes",
    errors
  );
  const policyEnv = normalizeEnv(input.env, "policy.env", errors);

  validateSecretForwarding(input, "policy", options, errors);

  const hooks = normalizeExecutableHooks(input.hooks, {
    mode,
    policyEnv,
    timeoutMs,
    outputLimitBytes,
    options,
    errors
  });
  const planning = normalizePlanningHooks(input.planning, errors);

  return {
    version: HOOK_POLICY_VERSION,
    enabled: mode !== HOOK_EXECUTION_MODES.disabled,
    mode,
    defaults: {
      timeout_ms: timeoutMs,
      output_limit_bytes: outputLimitBytes,
      env: policyEnv
    },
    hooks,
    planning,
    executable_hook_names: Object.keys(hooks),
    planning_hook_points: Object.keys(planning),
    unknown_fields: unknownFields(input, KNOWN_POLICY_FIELDS)
  };
}

function normalizeMode(value, input, options, errors) {
  const hooks = isPlainObject(input.hooks) ? Object.keys(input.hooks) : [];
  const defaultMode = hooks.length > 0 ? HOOK_EXECUTION_MODES.dryRun : HOOK_EXECUTION_MODES.disabled;
  const mode = value === undefined || value === null ? defaultMode : value;

  if (!MODE_SET.has(mode)) {
    errors.push({
      path: "policy.mode",
      reason: "invalid_hook_mode",
      message: `hook mode must be one of ${Array.from(MODE_SET).join(", ")}`
    });
    return defaultMode;
  }

  if (mode === HOOK_EXECUTION_MODES.real && options.allowRealHooks !== true) {
    errors.push({
      path: "policy.mode",
      reason: "real_hook_execution_not_approved",
      message: "real hook execution is not approved by default"
    });
  }

  return mode;
}

function normalizeExecutableHooks(hooksInput, context) {
  if (hooksInput === undefined || hooksInput === null) {
    return {};
  }
  if (!isPlainObject(hooksInput)) {
    context.errors.push({
      path: "policy.hooks",
      reason: "malformed_hooks",
      message: "hooks must be an object keyed by hook name"
    });
    return {};
  }

  const hooks = {};
  for (const [name, hookInput] of Object.entries(hooksInput).sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    const path = `policy.hooks.${name}`;
    if (!EXECUTABLE_HOOK_SET.has(name)) {
      context.errors.push({
        path,
        reason: "unknown_executable_hook",
        message: `unknown executable hook: ${name}`
      });
      continue;
    }
    if (!isPlainObject(hookInput)) {
      context.errors.push({
        path,
        reason: "malformed_hook",
        message: "hook definition must be an object"
      });
      continue;
    }

    const env = {
      ...context.policyEnv,
      ...normalizeEnv(hookInput.env, `${path}.env`, context.errors)
    };
    validateSecretForwarding(hookInput, path, context.options, context.errors);
    validateInteractiveFlags(hookInput, path, context.errors);

    const timeoutMs = normalizeTimeout(hookInput.timeout_ms, `${path}.timeout_ms`, context.errors, {
      fallback: context.timeoutMs
    });
    const outputLimitBytes = normalizeOutputLimit(
      hookInput.output_limit_bytes,
      `${path}.output_limit_bytes`,
      context.errors,
      { fallback: context.outputLimitBytes }
    );
    const cwd = normalizeCwd(hookInput.cwd, `${path}.cwd`, context.errors);
    const command = normalizeCommand(hookInput.command, `${path}.command`, context.errors);

    hooks[name] = {
      name,
      mode: context.mode,
      command,
      cwd,
      timeout_ms: timeoutMs,
      output_limit_bytes: outputLimitBytes,
      env,
      unknown_fields: unknownFields(hookInput, KNOWN_HOOK_FIELDS)
    };
  }

  return hooks;
}

function normalizePlanningHooks(planningInput, errors) {
  if (planningInput === undefined || planningInput === null) {
    return {};
  }
  if (!isPlainObject(planningInput)) {
    errors.push({
      path: "policy.planning",
      reason: "malformed_planning_hooks",
      message: "planning hook points must be an object"
    });
    return {};
  }

  const planning = {};
  for (const [name, value] of Object.entries(planningInput).sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    const path = `policy.planning.${name}`;
    if (!PLANNING_HOOK_SET.has(name)) {
      errors.push({
        path,
        reason: "unknown_planning_hook_point",
        message: `unknown planning hook point: ${name}`
      });
      continue;
    }
    if (!isPlainObject(value)) {
      errors.push({
        path,
        reason: "malformed_planning_hook_point",
        message: "planning hook point evidence must be an object"
      });
      continue;
    }
    if (value.command !== undefined) {
      errors.push({
        path: `${path}.command`,
        reason: "planning_hook_command_denied",
        message: "planning hook points are evidence only and cannot define commands"
      });
    }
    planning[name] = {
      name,
      enabled: Boolean(value.enabled),
      unknown_fields: unknownFields(value, new Set(["enabled"]))
    };
  }
  return planning;
}

function normalizeCommand(value, path, errors) {
  if (typeof value === "string") {
    errors.push({
      path,
      reason: "hook_command_string_denied",
      message: "hook command must be a structured array, not a shell string"
    });
    return [];
  }
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({
      path,
      reason: "hook_command_required",
      message: "hook command must be a non-empty array"
    });
    return [];
  }
  const command = value.map((part, index) => {
    if (typeof part !== "string" || part.length === 0) {
      errors.push({
        path: `${path}.${index}`,
        reason: "invalid_hook_command_part",
        message: "hook command parts must be non-empty strings"
      });
      return "";
    }
    if (SHELL_METACHARACTER_PATTERN.test(part)) {
      errors.push({
        path: `${path}.${index}`,
        reason: "hook_command_shell_metacharacter_denied",
        message: "hook command parts cannot contain shell metacharacters"
      });
    }
    return part;
  });

  const joined = command.filter(Boolean).join(" ");
  for (const denied of DENIED_COMMAND_PATTERNS) {
    if (denied.pattern.test(joined)) {
      errors.push({
        path,
        reason: denied.reason,
        message: `hook command is denied: ${joined}`
      });
      break;
    }
  }

  return command;
}

function normalizeCwd(value, path, errors) {
  const cwd = value === undefined || value === null ? "." : value;
  if (typeof cwd !== "string" || cwd.length === 0) {
    errors.push({
      path,
      reason: "invalid_hook_cwd",
      message: "hook cwd must be a non-empty string"
    });
    return ".";
  }

  const normalized = cwd.replaceAll("\\", "/");
  if (
    normalized.startsWith("/")
    || normalized.startsWith("~")
    || normalized.includes("$HOME")
    || normalized === ".git"
    || normalized.startsWith(".git/")
    || normalized === ".symphony/state"
    || normalized.startsWith(".symphony/state/")
    || normalized === ".symphony/logs"
    || normalized.startsWith(".symphony/logs/")
    || normalized === ".."
    || normalized.startsWith("../")
    || normalized.includes("/../")
  ) {
    errors.push({
      path,
      reason: "hook_cwd_outside_workspace",
      message: "hook cwd must stay within the approved workspace boundary"
    });
  }

  return normalized;
}

function normalizeTimeout(value, path, errors, { fallback = DEFAULT_HOOK_TIMEOUT_MS } = {}) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 1 || value > MAX_HOOK_TIMEOUT_MS) {
    errors.push({
      path,
      reason: "invalid_hook_timeout",
      message: `hook timeout must be an integer from 1 to ${MAX_HOOK_TIMEOUT_MS}`
    });
    return fallback;
  }
  return value;
}

function normalizeOutputLimit(value, path, errors, { fallback = DEFAULT_HOOK_OUTPUT_LIMIT_BYTES } = {}) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 0 || value > MAX_HOOK_OUTPUT_LIMIT_BYTES) {
    errors.push({
      path,
      reason: "invalid_hook_output_limit",
      message: `hook output limit must be an integer from 0 to ${MAX_HOOK_OUTPUT_LIMIT_BYTES}`
    });
    return fallback;
  }
  return value;
}

function normalizeEnv(value, path, errors) {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isPlainObject(value)) {
    errors.push({
      path,
      reason: "malformed_hook_env",
      message: "hook env must be an object"
    });
    return {};
  }

  const env = {};
  for (const [key, envValue] of Object.entries(value).sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    const envPath = `${path}.${key}`;
    if (!isAllowedEnvKey(key) || isDeniedEnvKey(key)) {
      errors.push({
        path: envPath,
        reason: "hook_env_not_allowed",
        message: `hook env key is not allowed: ${key}`
      });
      continue;
    }
    if (typeof envValue !== "string") {
      errors.push({
        path: envPath,
        reason: "invalid_hook_env_value",
        message: "hook env values must be strings"
      });
      continue;
    }
    env[key] = envValue;
  }
  return env;
}

function validateSecretForwarding(input, path, options, errors) {
  const secretEnv = input.secret_env ?? input.secrets;
  if (secretEnv !== undefined && secretEnv !== null && !isEmptySecretList(secretEnv)) {
    errors.push({
      path: `${path}.secret_env`,
      reason: "hook_secret_forwarding_denied",
      message: "secret forwarding is denied by default"
    });
  }
  if (input.allow_secrets === true && options.allowSecretForwarding !== true) {
    errors.push({
      path: `${path}.allow_secrets`,
      reason: "hook_secret_forwarding_denied",
      message: "secret forwarding requires a later explicit approval"
    });
  }
}

function validateInteractiveFlags(input, path, errors) {
  if (input.interactive === true) {
    errors.push({
      path: `${path}.interactive`,
      reason: "hook_interactive_prompt_denied",
      message: "interactive hooks are denied"
    });
  }
  if (input.tty === true) {
    errors.push({
      path: `${path}.tty`,
      reason: "hook_tty_denied",
      message: "TTY hooks are denied"
    });
  }
  if (input.stdin === "inherit" || input.stdin === "tty") {
    errors.push({
      path: `${path}.stdin`,
      reason: "hook_interactive_stdin_denied",
      message: "hook stdin must be closed or empty"
    });
  }
}

function unknownFields(input, knownFields) {
  const unknown = {};
  if (!isPlainObject(input)) {
    return unknown;
  }
  for (const [key, value] of Object.entries(input).sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    if (!knownFields.has(key) && value !== undefined) {
      unknown[key] = value;
    }
  }
  return unknown;
}

function isAllowedEnvKey(key) {
  return ALLOWED_ENV_KEYS.has(key);
}

function isDeniedEnvKey(key) {
  return SECRET_ENV_PATTERN.test(key) || DENIED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function isEmptySecretList(value) {
  return (Array.isArray(value) && value.length === 0)
    || (isPlainObject(value) && Object.keys(value).length === 0);
}

function success(policy, errors) {
  return {
    ok: true,
    reason: null,
    errors,
    policy
  };
}

function failure(reason, errors, policy = null) {
  return {
    ok: false,
    reason,
    errors,
    policy
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
