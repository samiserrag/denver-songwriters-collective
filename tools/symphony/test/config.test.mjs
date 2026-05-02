import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfig } from "../lib/config.mjs";

const baseWorkflowConfig = {
  version: 1,
  max_concurrent_agents: 1,
  labels: {
    ready: "symphony:ready",
    running: "symphony:running",
    humanReview: "symphony:human-review",
    blocked: "symphony:blocked",
    general: "symphony"
  },
  workspace: {
    root: ".symphony/worktrees",
    logs: ".symphony/logs",
    state: ".symphony/state"
  },
  codex: {
    adapter: "codex-exec"
  }
};

test("resolveConfig applies default Codex execution timeout config", () => {
  const config = resolveConfig("/repo", baseWorkflowConfig, {});

  assert.equal(config.codexExecutionTimeoutMinutes, 30);
  assert.equal(config.codexExecutionTimeoutMs, 30 * 60 * 1000);
  assert.equal(config.codexExecutionTimeoutKillGraceSeconds, 15);
  assert.equal(config.codexExecutionTimeoutKillGraceMs, 15 * 1000);
});

test("resolveConfig reads Codex execution timeout from workflow config", () => {
  const config = resolveConfig("/repo", {
    ...baseWorkflowConfig,
    codex: {
      adapter: "codex-exec",
      execution_timeout_minutes: 45,
      execution_timeout_kill_grace_seconds: 20
    }
  }, {});

  assert.equal(config.codexExecutionTimeoutMinutes, 45);
  assert.equal(config.codexExecutionTimeoutMs, 45 * 60 * 1000);
  assert.equal(config.codexExecutionTimeoutKillGraceSeconds, 20);
  assert.equal(config.codexExecutionTimeoutKillGraceMs, 20 * 1000);
});

test("resolveConfig lets env override Codex execution timeout config", () => {
  const config = resolveConfig("/repo", {
    ...baseWorkflowConfig,
    codex: {
      adapter: "codex-exec",
      execution_timeout_minutes: 45,
      execution_timeout_kill_grace_seconds: 20
    }
  }, {
    SYMPHONY_CODEX_EXECUTION_TIMEOUT_MINUTES: "5",
    SYMPHONY_CODEX_EXECUTION_TIMEOUT_KILL_GRACE_SECONDS: "2"
  });

  assert.equal(config.codexExecutionTimeoutMinutes, 5);
  assert.equal(config.codexExecutionTimeoutMs, 5 * 60 * 1000);
  assert.equal(config.codexExecutionTimeoutKillGraceSeconds, 2);
  assert.equal(config.codexExecutionTimeoutKillGraceMs, 2 * 1000);
});

test("resolveConfig fails closed for invalid Codex execution timeout env", () => {
  assert.throws(
    () => resolveConfig("/repo", baseWorkflowConfig, {
      SYMPHONY_CODEX_EXECUTION_TIMEOUT_MINUTES: "0"
    }),
    /SYMPHONY_CODEX_EXECUTION_TIMEOUT_MINUTES must be a positive number/
  );
  assert.throws(
    () => resolveConfig("/repo", baseWorkflowConfig, {
      SYMPHONY_CODEX_EXECUTION_TIMEOUT_KILL_GRACE_SECONDS: "not-a-number"
    }),
    /SYMPHONY_CODEX_EXECUTION_TIMEOUT_KILL_GRACE_SECONDS must be a positive number/
  );
});
