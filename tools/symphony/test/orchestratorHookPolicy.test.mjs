import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EXECUTABLE_HOOK_NAMES,
  HOOK_EXECUTION_MODES,
  PLANNING_HOOK_POINTS,
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

function reasons(result) {
  return result.errors.map((error) => error.reason);
}

test("valid minimal disabled/no-hook policy", () => {
  const result = validateHookPolicy({});

  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.deepEqual(result.errors, []);
  assert.equal(result.policy.enabled, false);
  assert.equal(result.policy.mode, HOOK_EXECUTION_MODES.disabled);
  assert.deepEqual(result.policy.hooks, {});
  assert.deepEqual(result.policy.planning, {});
});

test("valid fake and dry-run hook policies", () => {
  const fake = validateHookPolicy({
    mode: HOOK_EXECUTION_MODES.fake,
    hooks: {
      before_run: fakeHook()
    }
  });
  const dryRun = validateHookPolicy({
    mode: HOOK_EXECUTION_MODES.dryRun,
    hooks: {
      after_create: fakeHook({ command: ["npm", "run", "symphony:hook:after-create"] })
    }
  });

  assert.equal(fake.ok, true);
  assert.equal(fake.policy.enabled, true);
  assert.equal(fake.policy.hooks.before_run.mode, HOOK_EXECUTION_MODES.fake);
  assert.deepEqual(fake.policy.hooks.before_run.command, ["npm", "run", "symphony:hook:before-run"]);
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.policy.hooks.after_create.mode, HOOK_EXECUTION_MODES.dryRun);
});

test("allowed executable hook names are accepted", () => {
  const result = validateHookPolicy({
    mode: HOOK_EXECUTION_MODES.fake,
    hooks: Object.fromEntries(EXECUTABLE_HOOK_NAMES.map((name) => [name, fakeHook({
      command: ["npm", "run", `symphony:hook:${name}`]
    })]))
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.policy.executable_hook_names, [
    "after_create",
    "after_run",
    "before_remove",
    "before_run"
  ]);
});

test("unknown executable hook names are rejected", () => {
  const result = validateHookPolicy({
    mode: HOOK_EXECUTION_MODES.fake,
    hooks: {
      post_claim: fakeHook()
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "hook_policy_invalid");
  assert.deepEqual(reasons(result), ["unknown_executable_hook"]);
});

test("internal planning hook points are evidence-only names", () => {
  const valid = validateHookPolicy({
    planning: Object.fromEntries(PLANNING_HOOK_POINTS.map((name) => [name, {
      enabled: name === "preflight",
      future_note: name
    }]))
  });
  const command = validateHookPolicy({
    planning: {
      preflight: {
        command: ["npm", "test"]
      }
    }
  });
  const unknown = validateHookPolicy({
    planning: {
      arbitrary: {}
    }
  });

  assert.equal(valid.ok, true);
  assert.equal(valid.policy.planning.preflight.enabled, true);
  assert.deepEqual(valid.policy.planning.cleanup.unknown_fields, {
    future_note: "cleanup"
  });
  assert.equal(command.ok, false);
  assert.deepEqual(reasons(command), ["planning_hook_command_denied"]);
  assert.equal(unknown.ok, false);
  assert.deepEqual(reasons(unknown), ["unknown_planning_hook_point"]);
});

test("command string is rejected and command array is accepted", () => {
  const stringCommand = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ command: "npm test" })
    }
  });
  const arrayCommand = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ command: ["npm", "test"] })
    }
  });

  assert.equal(stringCommand.ok, false);
  assert.deepEqual(reasons(stringCommand), ["hook_command_string_denied"]);
  assert.equal(arrayCommand.ok, true);
  assert.deepEqual(arrayCommand.policy.hooks.before_run.command, ["npm", "test"]);
});

test("cwd outside allowed workspace boundaries is rejected", () => {
  const cases = ["/tmp", "../outside", "workspace/../outside", "~/.ssh", ".git", ".symphony/state"];

  for (const cwd of cases) {
    const result = validateHookPolicy({
      hooks: {
        before_run: fakeHook({ cwd })
      }
    });

    assert.equal(result.ok, false, cwd);
    assert.equal(reasons(result).includes("hook_cwd_outside_workspace"), true, cwd);
  }
});

test("timeout bounds fail closed", () => {
  const tooHigh = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ timeout_ms: 300001 })
    }
  });
  const invalid = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ timeout_ms: 1.5 })
    }
  });

  assert.equal(tooHigh.ok, false);
  assert.deepEqual(reasons(tooHigh), ["invalid_hook_timeout"]);
  assert.equal(invalid.ok, false);
  assert.deepEqual(reasons(invalid), ["invalid_hook_timeout"]);
});

test("output capture limit bounds fail closed", () => {
  const tooHigh = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ output_limit_bytes: 65537 })
    }
  });
  const invalid = validateHookPolicy({
    hooks: {
      before_run: fakeHook({ output_limit_bytes: -1 })
    }
  });

  assert.equal(tooHigh.ok, false);
  assert.deepEqual(reasons(tooHigh), ["invalid_hook_output_limit"]);
  assert.equal(invalid.ok, false);
  assert.deepEqual(reasons(invalid), ["invalid_hook_output_limit"]);
});

test("env secret forwarding is rejected", () => {
  const secretEnv = validateHookPolicy({
    hooks: {
      before_run: fakeHook({
        env: {
          GITHUB_TOKEN: "secret"
        }
      })
    }
  });
  const secretList = validateHookPolicy({
    hooks: {
      before_run: fakeHook({
        secret_env: ["GITHUB_TOKEN"]
      })
    }
  });
  const allowSecrets = validateHookPolicy({
    hooks: {
      before_run: fakeHook({
        allow_secrets: true
      })
    }
  });

  assert.equal(secretEnv.ok, false);
  assert.deepEqual(reasons(secretEnv), ["hook_env_not_allowed"]);
  assert.equal(secretList.ok, false);
  assert.deepEqual(reasons(secretList), ["hook_secret_forwarding_denied"]);
  assert.equal(allowSecrets.ok, false);
  assert.deepEqual(reasons(allowSecrets), ["hook_secret_forwarding_denied"]);
});

test("denylisted commands are rejected", () => {
  const cases = [
    {
      command: ["gh", "issue", "edit", "1", "--add-label", "symphony:ready"],
      reason: "github_mutation_command_denied"
    },
    {
      command: ["git", "push", "origin", "main"],
      reason: "git_mutation_command_denied"
    },
    {
      command: ["supabase", "db", "push"],
      reason: "database_mutation_command_denied"
    },
    {
      command: ["vercel", "deploy"],
      reason: "deployment_command_denied"
    },
    {
      command: ["nohup", "npm", "run", "dev"],
      reason: "background_process_command_denied"
    }
  ];

  for (const entry of cases) {
    const result = validateHookPolicy({
      hooks: {
        before_run: fakeHook({ command: entry.command })
      }
    });

    assert.equal(result.ok, false, entry.command.join(" "));
    assert.equal(reasons(result).includes(entry.reason), true, entry.command.join(" "));
  }
});

test("interactive and TTY flags are rejected", () => {
  const result = validateHookPolicy({
    hooks: {
      before_run: fakeHook({
        interactive: true,
        tty: true,
        stdin: "inherit"
      })
    }
  });

  assert.equal(result.ok, false);
  assert.deepEqual(reasons(result).sort(), [
    "hook_interactive_prompt_denied",
    "hook_interactive_stdin_denied",
    "hook_tty_denied"
  ].sort());
});

test("unknown future fields are preserved without interpretation", () => {
  const result = validateHookPolicy({
    future_policy: {
      keep: true
    },
    hooks: {
      before_run: fakeHook({
        future_hook: {
          nested: "value"
        }
      })
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.policy.unknown_fields, {
    future_policy: {
      keep: true
    }
  });
  assert.deepEqual(result.policy.hooks.before_run.unknown_fields, {
    future_hook: {
      nested: "value"
    }
  });
});

test("malformed inputs fail closed", () => {
  const malformedPolicy = validateHookPolicy("not object");
  const malformedHooks = validateHookPolicy({ hooks: [] });
  const malformedHook = validateHookPolicy({
    hooks: {
      before_run: []
    }
  });

  assert.equal(malformedPolicy.ok, false);
  assert.deepEqual(reasons(malformedPolicy), ["malformed_hook_policy"]);
  assert.equal(malformedHooks.ok, false);
  assert.deepEqual(reasons(malformedHooks), ["malformed_hooks"]);
  assert.equal(malformedHook.ok, false);
  assert.deepEqual(reasons(malformedHook), ["malformed_hook"]);
});

test("real hook mode is rejected without explicit future approval", () => {
  const result = validateHookPolicy({
    mode: HOOK_EXECUTION_MODES.real,
    hooks: {
      before_run: fakeHook()
    }
  });

  assert.equal(result.ok, false);
  assert.deepEqual(reasons(result), ["real_hook_execution_not_approved"]);
});

test("helper stays pure and does not import runtime or execution modules", () => {
  const source = readFileSync(new URL("../lib/orchestratorHookPolicy.mjs", import.meta.url), "utf8");

  assert.equal(/from\s+["']node:(fs|child_process|net|http|https)["']/.test(source), false);
  assert.equal(/from\s+["']\.\/runner\.mjs["']/.test(source), false);
  assert.equal(/from\s+["']\.\.\/lib\/runner\.mjs["']/.test(source), false);
  assert.equal(/from\s+["']\.\/codexAdapter\.mjs["']/.test(source), false);
  assert.equal(/from\s+["']\.\/codexAppServerAdapter\.mjs["']/.test(source), false);
  assert.equal(/from\s+["']\.\/github\.mjs["']/.test(source), false);
});
