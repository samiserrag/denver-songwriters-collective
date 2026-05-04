import assert from "node:assert/strict";
import test from "node:test";
import {
  HOOK_EXECUTION_MODES,
  validateHookPolicy
} from "../lib/orchestratorHookPolicy.mjs";

function fakeHook(overrides = {}) {
  return {
    command: ["npm", "run", "symphony:hook:before-run"],
    cwd: ".",
    timeout_ms: 60000,
    output_limit_bytes: 8192,
    env: {
      CI: "1",
      NO_COLOR: "1",
      SYMPHONY_HOOK_PHASE: "before_run"
    },
    ...overrides
  };
}

function assertInvalid(result, expectedReasons) {
  assert.equal(result.ok, false);
  assert.equal(result.reason, "hook_policy_invalid");
  assert.equal(Array.isArray(result.errors), true);
  assert.deepEqual(result.errors.map((error) => error.reason), expectedReasons);
  assert.equal(result.policy.version, 1);
  assert.equal(typeof result.policy.enabled, "boolean");
  assert.equal(typeof result.policy.hooks, "object");
}

test("hooks default to dry-run mode and reject unapproved real execution", () => {
  const defaulted = validateHookPolicy({
    hooks: {
      before_run: fakeHook()
    }
  });
  const real = validateHookPolicy({
    mode: HOOK_EXECUTION_MODES.real,
    hooks: {
      before_run: fakeHook()
    }
  });

  assert.equal(defaulted.ok, true);
  assert.equal(defaulted.policy.enabled, true);
  assert.equal(defaulted.policy.mode, HOOK_EXECUTION_MODES.dryRun);
  assert.equal(defaulted.policy.hooks.before_run.mode, HOOK_EXECUTION_MODES.dryRun);
  assertInvalid(real, ["real_hook_execution_not_approved"]);
  assert.equal(real.policy.mode, HOOK_EXECUTION_MODES.real);
});

test("command arrays fail closed on empty argv and invalid argv entries", () => {
  const cases = [
    {
      hook: fakeHook({ command: [] }),
      reasons: ["hook_command_required"]
    },
    {
      hook: fakeHook({ command: ["npm", "", "test"] }),
      reasons: ["invalid_hook_command_part"]
    },
    {
      hook: fakeHook({ command: ["npm", 42, "test"] }),
      reasons: ["invalid_hook_command_part"]
    },
    {
      hook: fakeHook({ command: ["npm", "run", "test && gh issue edit 1"] }),
      reasons: ["hook_command_shell_metacharacter_denied"]
    }
  ];

  for (const { hook, reasons } of cases) {
    const result = validateHookPolicy({
      hooks: {
        before_run: hook
      }
    });

    assertInvalid(result, reasons);
  }
});

test("cwd validation allows relative workspace paths and rejects escapes", () => {
  const valid = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ cwd: "tools/symphony" })
    }
  });
  const cases = [
    "/Users/samiserrag/Documents/GitHub/denver-songwriters-collective",
    "..",
    "tools/../../outside",
    ".git/hooks",
    ".symphony/logs",
    "workspace\\..\\outside",
    "$HOME/project"
  ];

  assert.equal(valid.ok, true);
  assert.equal(valid.policy.hooks.before_run.cwd, "tools/symphony");

  for (const cwd of cases) {
    const result = validateHookPolicy({
      hooks: {
        before_run: fakeHook({ cwd })
      }
    });

    assertInvalid(result, ["hook_cwd_outside_workspace"]);
  }
});

test("timeout and output bounds pin zero negative and oversize behavior", () => {
  const timeoutZero = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ timeout_ms: 0 })
    }
  });
  const timeoutNegative = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ timeout_ms: -1 })
    }
  });
  const timeoutOversize = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ timeout_ms: 300001 })
    }
  });
  const outputZero = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ output_limit_bytes: 0 })
    }
  });
  const outputNegative = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ output_limit_bytes: -1 })
    }
  });
  const outputOversize = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ output_limit_bytes: 65537 })
    }
  });

  assertInvalid(timeoutZero, ["invalid_hook_timeout"]);
  assertInvalid(timeoutNegative, ["invalid_hook_timeout"]);
  assertInvalid(timeoutOversize, ["invalid_hook_timeout"]);
  assert.equal(outputZero.ok, true);
  assert.equal(outputZero.policy.hooks.before_run.output_limit_bytes, 0);
  assertInvalid(outputNegative, ["invalid_hook_output_limit"]);
  assertInvalid(outputOversize, ["invalid_hook_output_limit"]);
});

test("env policy enforces allowlist values and denies secret-bearing keys at policy and hook levels", () => {
  const allowedMerge = validateHookPolicy({
    env: {
      CI: "1",
      SYMPHONY_WORKFLOW_HASH: "workflow-hash"
    },
    hooks: {
      before_run: fakeHook({
        env: {
          NO_COLOR: "1",
          SYMPHONY_HOOK_PHASE: "before_run"
        }
      })
    }
  });
  const policyDenied = validateHookPolicy({
    env: {
      OPENAI_API_KEY: "redacted"
    },
    hooks: {
      before_run: fakeHook()
    }
  });
  const policyInvalidValue = validateHookPolicy({
    env: {
      CI: true
    },
    hooks: {
      before_run: fakeHook()
    }
  });
  const hookDenied = validateHookPolicy({
    hooks: {
      before_run: fakeHook({
        env: {
          SUPABASE_ACCESS_TOKEN: "redacted"
        }
      })
    }
  });

  assert.equal(allowedMerge.ok, true);
  assert.deepEqual(allowedMerge.policy.hooks.before_run.env, {
    CI: "1",
    NO_COLOR: "1",
    SYMPHONY_HOOK_PHASE: "before_run",
    SYMPHONY_WORKFLOW_HASH: "workflow-hash"
  });
  assertInvalid(policyDenied, ["hook_env_not_allowed"]);
  assertInvalid(policyInvalidValue, ["invalid_hook_env_value"]);
  assertInvalid(hookDenied, ["hook_env_not_allowed"]);
});
