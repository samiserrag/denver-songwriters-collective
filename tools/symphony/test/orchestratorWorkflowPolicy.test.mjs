import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkflowPolicySnapshot,
  compareWorkflowPolicySnapshots
} from "../lib/orchestratorWorkflowPolicy.mjs";

const NOW = "2026-05-02T23:00:00.000Z";

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
      },
      future_extension: {
        keep: true
      }
    },
    ...overrides
  };
}

test("same workflow policy input yields the same hash despite object key ordering", () => {
  const left = buildWorkflowPolicySnapshot(workflowPolicy(), { now: NOW });
  const right = buildWorkflowPolicySnapshot({
    prompt_template: "# Symphony Workflow\n\nStay prototype-only.",
    config: {
      future_extension: {
        keep: true
      },
      codex: {
        execution_timeout_kill_grace_seconds: 15,
        execution_timeout_minutes: 30,
        fallback: "codex exec --json",
        adapter: "codex-exec"
      },
      lock: {
        stale_minutes: 240
      },
      recovery: {
        stale_running_minutes: 240
      },
      workspace: {
        state: ".symphony/state",
        logs: ".symphony/logs",
        root: ".symphony/worktrees"
      },
      labels: {
        general: "symphony",
        blocked: "symphony:blocked",
        humanReview: "symphony:human-review",
        running: "symphony:running",
        ready: "symphony:ready"
      },
      max_concurrent_agents: 1,
      version: 1
    },
    format: "yaml-front-matter"
  }, { now: NOW });

  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  assert.equal(left.snapshot.workflow_hash, right.snapshot.workflow_hash);
  assert.equal(left.snapshot.config_hash, right.snapshot.config_hash);
  assert.equal(left.snapshot.prompt_hash, right.snapshot.prompt_hash);
  assert.equal(left.snapshot.generated_at, NOW);
});

test("changed policy field changes hash and reports workflow drift", () => {
  const accepted = buildWorkflowPolicySnapshot(workflowPolicy()).snapshot;
  const current = buildWorkflowPolicySnapshot(workflowPolicy({
    config: {
      ...workflowPolicy().config,
      labels: {
        ...workflowPolicy().config.labels,
        blocked: "symphony:blocked-v2"
      }
    }
  })).snapshot;

  const comparison = compareWorkflowPolicySnapshots(accepted, current);

  assert.equal(accepted.workflow_hash === current.workflow_hash, false);
  assert.equal(comparison.ok, true);
  assert.equal(comparison.changed, true);
  assert.equal(comparison.reason, "workflow_policy_drift");
  assert.deepEqual(comparison.changed_fields.sort(), [
    "accepted_labels",
    "config_hash",
    "workflow_hash"
  ].sort());
  assert.equal(comparison.old_hash, accepted.workflow_hash);
  assert.equal(comparison.new_hash, current.workflow_hash);
});

test("unknown future fields are preserved and hash-stable", () => {
  const left = buildWorkflowPolicySnapshot(workflowPolicy({
    future_top_level: {
      beta: true,
      nested: {
        value: 1
      }
    }
  }));
  const right = buildWorkflowPolicySnapshot(workflowPolicy({
    future_top_level: {
      nested: {
        value: 1
      },
      beta: true
    }
  }));

  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  assert.deepEqual(left.snapshot.extra_policy_fields, {
    future_top_level: {
      beta: true,
      nested: {
        value: 1
      }
    }
  });
  assert.equal(left.snapshot.workflow_hash, right.snapshot.workflow_hash);
});

test("missing required workflow policy fields fail closed", () => {
  const missingConfig = buildWorkflowPolicySnapshot({
    prompt_template: "# Workflow"
  });
  const missingPrompt = buildWorkflowPolicySnapshot({
    config: workflowPolicy().config
  });

  assert.equal(missingConfig.ok, false);
  assert.equal(missingConfig.reason, "workflow_policy_snapshot_failed");
  assert.match(missingConfig.error, /requires config object/);
  assert.equal(missingPrompt.ok, false);
  assert.match(missingPrompt.error, /requires prompt_template string/);
});

test("invalid injected clock fails closed", () => {
  const result = buildWorkflowPolicySnapshot(workflowPolicy(), { now: "not-a-date" });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "workflow_policy_snapshot_failed");
  assert.match(result.error, /now must be a valid timestamp/);
});

test("compare helper reports no drift for identical snapshots", () => {
  const snapshot = buildWorkflowPolicySnapshot(workflowPolicy()).snapshot;
  const comparison = compareWorkflowPolicySnapshots(snapshot, { ...snapshot });

  assert.equal(comparison.ok, true);
  assert.equal(comparison.changed, false);
  assert.deepEqual(comparison.changed_fields, []);
  assert.equal(comparison.old_hash, snapshot.workflow_hash);
  assert.equal(comparison.new_hash, snapshot.workflow_hash);
  assert.equal(comparison.reason, null);
});

test("compare helper reports workflow_policy_drift for changed hash or version", () => {
  const snapshot = buildWorkflowPolicySnapshot(workflowPolicy()).snapshot;
  const changedHash = compareWorkflowPolicySnapshots(snapshot, {
    ...snapshot,
    workflow_hash: "sha256:changed"
  });
  const changedVersion = compareWorkflowPolicySnapshots(snapshot, {
    ...snapshot,
    workflow_version: 2
  });

  assert.equal(changedHash.ok, true);
  assert.equal(changedHash.changed, true);
  assert.equal(changedHash.reason, "workflow_policy_drift");
  assert.deepEqual(changedHash.changed_fields, ["workflow_hash"]);
  assert.equal(changedVersion.ok, true);
  assert.equal(changedVersion.changed, true);
  assert.equal(changedVersion.reason, "workflow_policy_drift");
  assert.deepEqual(changedVersion.changed_fields, ["workflow_version"]);
});

test("compare helper fails closed on malformed snapshots", () => {
  const comparison = compareWorkflowPolicySnapshots({}, {
    workflow_hash: "sha256:current"
  });

  assert.equal(comparison.ok, false);
  assert.equal(comparison.reason, "workflow_policy_snapshot_compare_failed");
  assert.match(comparison.error, /requires workflow_hash or workflow_version/);
});
