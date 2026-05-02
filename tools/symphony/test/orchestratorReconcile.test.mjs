import assert from "node:assert/strict";
import test from "node:test";
import {
  EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE,
  EVENT_RECONCILIATION_INELIGIBLE,
  EVENT_RETRY_DUE,
  EVENT_STALE_DETECTED,
  EVENT_STALE_RECOVERY_BLOCKED,
  STATE_BLOCKED,
  STATE_CANCELLED,
  STATE_CLAIMED,
  STATE_RELEASED,
  STATE_RETRY_WAIT,
  STATE_RUNNING,
  STATE_STALE
} from "../lib/orchestratorState.mjs";
import { reconcileOrchestratorState } from "../lib/orchestratorReconcile.mjs";
import { createOrchestratorStateSnapshot } from "../lib/orchestratorStateManifest.mjs";

const NOW = "2026-05-02T20:00:00.000Z";
const RUNNING_LABEL = "symphony:running";
const BLOCKED_LABEL = "symphony:blocked";

function runningSnapshot(overrides = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_RUNNING,
    title: "Reconcile running issue",
    branchName: "symphony/issue-42-reconcile-running-issue",
    worktreePath: ".symphony/worktrees/issue-42-reconcile-running-issue",
    logPath: ".symphony/logs/issue-42.jsonl",
    manifestPath: ".symphony/state/manifests/run.json",
    attempt: 1,
    reason: "adapter_started",
    workflow: {
      workflow_hash: "sha256:accepted",
      workflow_version: "v1"
    },
    ...overrides
  });
}

function retryWaitSnapshot(overrides = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: "2026-05-02T19:59:50.000Z",
    issueNumber: 42,
    state: STATE_RETRY_WAIT,
    title: "Retry issue",
    reason: "read_timeout",
    retry: {
      attempt: 1,
      maxAttempts: 3,
      delayMs: 10000,
      dueAt: NOW,
      reason: "read_timeout"
    },
    ...overrides
  });
}

function staleSnapshot(overrides = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_STALE,
    title: "Stale issue",
    reason: "stale_detected",
    ...overrides
  });
}

function observedIssue(overrides = {}) {
  return {
    now: NOW,
    issues: {
      42: {
        eligible: true,
        labels: [RUNNING_LABEL],
        workpadState: "running",
        workpadUpdatedAt: "2026-05-02T19:55:00.000Z",
        workflow: {
          workflow_hash: "sha256:accepted",
          workflow_version: "v1"
        },
        workspace: {
          lockHeld: false,
          worktreeExists: true
        },
        ...overrides
      }
    }
  };
}

function onlyDecision(result) {
  assert.equal(result.decisions.length, 1);
  return result.decisions[0];
}

test("running issue still eligible and fresh produces no transition", () => {
  const result = reconcileOrchestratorState(
    runningSnapshot(),
    observedIssue(),
    {
      now: NOW,
      staleThresholdMs: 10 * 60 * 1000
    }
  );
  const decision = onlyDecision(result);

  assert.equal(result.ok, true);
  assert.equal(decision.status, "no_transition");
  assert.equal(decision.reason, "running_issue_fresh_and_eligible");
  assert.equal(decision.event, null);
  assert.equal(decision.transition, null);
  assert.deepEqual(result.proposed_events, []);
  assert.deepEqual(result.transitions, []);
});

test("running issue that loses eligibility cancels through the reducer", () => {
  const result = reconcileOrchestratorState(
    runningSnapshot(),
    observedIssue({
      eligible: false,
      ineligibleReason: "issue_closed"
    }),
    { now: NOW }
  );
  const decision = onlyDecision(result);

  assert.equal(decision.status, "transition");
  assert.equal(decision.event.type, EVENT_RECONCILIATION_INELIGIBLE);
  assert.equal(decision.transition.from, STATE_RUNNING);
  assert.equal(decision.transition.to, STATE_CANCELLED);
  assert.equal(decision.reason, "issue_closed");
  assert.deepEqual(decision.actions, ["stop_adapter", "preserve_evidence"]);
});

test("retry_wait due and eligible moves back to claimed", () => {
  const result = reconcileOrchestratorState(
    retryWaitSnapshot(),
    observedIssue({
      labels: [],
      workpadState: "retry_wait"
    }),
    { now: NOW }
  );
  const decision = onlyDecision(result);

  assert.equal(decision.event.type, EVENT_RETRY_DUE);
  assert.equal(decision.transition.from, STATE_RETRY_WAIT);
  assert.equal(decision.transition.to, STATE_CLAIMED);
  assert.equal(decision.reason, EVENT_RETRY_DUE);
  assert.deepEqual(decision.durableWrites, ["manifest_retry_fired", "state_snapshot_claimed"]);
});

test("retry_wait due and ineligible releases the claim", () => {
  const result = reconcileOrchestratorState(
    retryWaitSnapshot(),
    observedIssue({
      eligible: false,
      labels: [BLOCKED_LABEL],
      workpadState: "blocked"
    }),
    { now: NOW }
  );
  const decision = onlyDecision(result);

  assert.equal(decision.event.type, EVENT_RETRY_DUE);
  assert.equal(decision.transition.from, STATE_RETRY_WAIT);
  assert.equal(decision.transition.to, STATE_RELEASED);
  assert.equal(decision.transition.terminal, true);
  assert.equal(decision.reason, "retry_due_ineligible");
});

test("retry_wait not yet due produces no transition", () => {
  const result = reconcileOrchestratorState(
    retryWaitSnapshot({
      retry: {
        attempt: 1,
        maxAttempts: 3,
        delayMs: 60000,
        dueAt: "2026-05-02T20:01:00.000Z",
        reason: "read_timeout"
      }
    }),
    observedIssue({
      labels: [],
      workpadState: "retry_wait"
    }),
    { now: NOW }
  );
  const decision = onlyDecision(result);

  assert.equal(decision.status, "no_transition");
  assert.equal(decision.reason, "retry_not_due");
});

test("running stale by workpad heartbeat threshold moves to stale", () => {
  const result = reconcileOrchestratorState(
    runningSnapshot(),
    observedIssue({
      workpadUpdatedAt: "2026-05-02T15:00:00.000Z"
    }),
    {
      now: NOW,
      staleThresholdMs: 4 * 60 * 60 * 1000
    }
  );
  const decision = onlyDecision(result);

  assert.equal(decision.event.type, EVENT_STALE_DETECTED);
  assert.equal(decision.transition.from, STATE_RUNNING);
  assert.equal(decision.transition.to, STATE_STALE);
  assert.equal(decision.reason, "running_stale_by_heartbeat");
  assert.deepEqual(decision.durableWrites, ["recovery_manifest_stale", "state_snapshot_stale"]);
});

test("stale recovery with safe evidence still blocks conservatively under current reducer semantics", () => {
  const result = reconcileOrchestratorState(
    staleSnapshot(),
    observedIssue({
      labels: [RUNNING_LABEL],
      workpadState: "running",
      safeAutoRelease: true
    }),
    { now: NOW }
  );
  const decision = onlyDecision(result);

  assert.equal(decision.event.type, EVENT_STALE_RECOVERY_BLOCKED);
  assert.equal(decision.transition.from, STATE_STALE);
  assert.equal(decision.transition.to, STATE_BLOCKED);
  assert.equal(decision.transition.terminal, true);
  assert.equal(decision.reason, "stale_recovery_blocked_safe_evidence_requires_human_review");
});

test("workflow hash or version drift while running cancels instead of silently continuing", () => {
  const result = reconcileOrchestratorState(
    runningSnapshot(),
    observedIssue({
      workflow: {
        workflow_hash: "sha256:changed",
        workflow_version: "v1"
      }
    }),
    { now: NOW }
  );
  const decision = onlyDecision(result);

  assert.equal(decision.event.type, EVENT_RECONCILIATION_INELIGIBLE);
  assert.equal(decision.transition.to, STATE_CANCELLED);
  assert.equal(decision.reason, "workflow_policy_drift");
});

test("label or workpad mismatch while running blocks with explicit reason", () => {
  const result = reconcileOrchestratorState(
    runningSnapshot(),
    observedIssue({
      labels: [BLOCKED_LABEL],
      workpadState: "blocked"
    }),
    { now: NOW }
  );
  const decision = onlyDecision(result);

  assert.equal(decision.event.type, EVENT_ADAPTER_TERMINAL_NONRETRYABLE_FAILURE);
  assert.equal(decision.transition.from, STATE_RUNNING);
  assert.equal(decision.transition.to, STATE_BLOCKED);
  assert.equal(decision.reason, "label_workpad_mismatch");
  assert.deepEqual(decision.durableWrites, [
    "github_blocked_label",
    "workpad_blocked",
    "manifest_terminal_failure"
  ]);
});

test("missing snapshot fails closed without transitions", () => {
  const result = reconcileOrchestratorState(null, observedIssue(), { now: NOW });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_orchestrator_state_snapshot");
  assert.match(result.error, /missing orchestrator state snapshot/);
  assert.deepEqual(result.decisions, []);
  assert.deepEqual(result.actions, ["stop_reconciliation", "require_manual_review"]);
});

test("malformed snapshot fails closed through manifest validation", () => {
  const snapshot = runningSnapshot();
  const result = reconcileOrchestratorState({
    ...snapshot,
    issues: {
      42: {
        ...snapshot.issues["42"],
        state: "not_a_state"
      }
    }
  }, observedIssue(), { now: NOW });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_orchestrator_state_snapshot");
  assert.match(result.error, /unknown orchestrator state: not_a_state/);
});

test("missing observed issue evidence fails closed per issue", () => {
  const result = reconcileOrchestratorState(
    runningSnapshot(),
    {
      now: NOW,
      issues: {}
    },
    { now: NOW }
  );
  const decision = onlyDecision(result);

  assert.equal(result.ok, false);
  assert.equal(decision.status, "fail_closed");
  assert.equal(decision.reason, "missing_observed_issue_snapshot");
  assert.match(decision.error, /missing observed evidence/);
});
