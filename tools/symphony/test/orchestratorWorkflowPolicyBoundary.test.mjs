import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkflowPolicySnapshot } from "../lib/orchestratorWorkflowPolicy.mjs";

function workflowPolicy(overrides = {}) {
  return {
    format: "yaml-front-matter",
    prompt_template: "# Symphony Workflow\n\nStay prototype-only.",
    config: {
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
      recovery: {
        stale_running_minutes: 240
      },
      lock: {
        stale_minutes: 240
      },
      codex: {
        adapter: "codex-exec",
        fallback: "codex exec --json",
        execution_timeout_minutes: 30,
        execution_timeout_kill_grace_seconds: 15
      }
    },
    ...overrides
  };
}

function withConfig(configOverrides) {
  return workflowPolicy({
    config: {
      ...workflowPolicy().config,
      ...configOverrides
    }
  });
}

function assertSnapshotFailed(result, pattern) {
  assert.deepEqual(Object.keys(result).sort(), ["error", "ok", "reason"]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "workflow_policy_snapshot_failed");
  assert.match(result.error, pattern);
  assert.equal(result.snapshot, undefined);
}

test("workflow format is required and limited to current supported formats", () => {
  for (const policy of [
    workflowPolicy({ format: undefined }),
    workflowPolicy({ format: "" })
  ]) {
    assertSnapshotFailed(
      buildWorkflowPolicySnapshot(policy),
      /requires workflow format string/
    );
  }

  assertSnapshotFailed(
    buildWorkflowPolicySnapshot(workflowPolicy({ format: "future-live-format" })),
    /unsupported workflow format: future-live-format/
  );
});

test("prompt_template remains required at the policy snapshot boundary", () => {
  assertSnapshotFailed(
    buildWorkflowPolicySnapshot(workflowPolicy({ prompt_template: undefined, markdown: undefined })),
    /requires prompt_template string/
  );
  assertSnapshotFailed(
    buildWorkflowPolicySnapshot(workflowPolicy({ prompt_template: ["not", "a", "string"] })),
    /requires prompt_template string/
  );
});

test("labels map must include required keys and unique values", () => {
  assertSnapshotFailed(
    buildWorkflowPolicySnapshot(withConfig({ labels: null })),
    /config.labels must be an object/
  );
  assertSnapshotFailed(
    buildWorkflowPolicySnapshot(withConfig({
      labels: {
        ...workflowPolicy().config.labels,
        ready: undefined
      }
    })),
    /labels.ready is required/
  );
  assertSnapshotFailed(
    buildWorkflowPolicySnapshot(withConfig({
      labels: {
        ...workflowPolicy().config.labels,
        blocked: "symphony:ready"
      }
    })),
    /labels must not contain duplicate values/
  );
});

test("max_concurrent_agents must stay pinned to one", () => {
  for (const value of [0, 2, "1", null]) {
    assertSnapshotFailed(
      buildWorkflowPolicySnapshot(withConfig({ max_concurrent_agents: value })),
      /max_concurrent_agents must be 1 for Phase 1/
    );
  }
});

test("recovery and lock stale thresholds must be positive integers", () => {
  for (const value of [0, -1, 1.5, "240"]) {
    assertSnapshotFailed(
      buildWorkflowPolicySnapshot(withConfig({
        recovery: {
          stale_running_minutes: value
        }
      })),
      /recovery.stale_running_minutes must be a positive integer/
    );
    assertSnapshotFailed(
      buildWorkflowPolicySnapshot(withConfig({
        lock: {
          stale_minutes: value
        }
      })),
      /lock.stale_minutes must be a positive integer/
    );
  }
});

test("codex adapter and timeout fields fail closed on unsupported values", () => {
  assertSnapshotFailed(
    buildWorkflowPolicySnapshot(withConfig({
      codex: {
        ...workflowPolicy().config.codex,
        adapter: "codex-app-server"
      }
    })),
    /Phase 1 supports only the codex-exec adapter/
  );

  for (const value of [0, -1, Number.NaN, "not-a-number"]) {
    assertSnapshotFailed(
      buildWorkflowPolicySnapshot(withConfig({
        codex: {
          ...workflowPolicy().config.codex,
          execution_timeout_minutes: value
        }
      })),
      /codex.execution_timeout_minutes must be a positive number/
    );
    assertSnapshotFailed(
      buildWorkflowPolicySnapshot(withConfig({
        codex: {
          ...workflowPolicy().config.codex,
          execution_timeout_kill_grace_seconds: value
        }
      })),
      /codex.execution_timeout_kill_grace_seconds must be a positive number/
    );
  }
});
