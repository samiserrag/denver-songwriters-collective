import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITY_CATEGORIES,
  buildCapabilitySnapshot
} from "../lib/orchestratorCapabilitySnapshot.mjs";
import {
  HOOK_EXECUTION_MODES,
  validateHookPolicy
} from "../lib/orchestratorHookPolicy.mjs";
import { runOrchestratorHarness } from "../lib/orchestratorHarness.mjs";
import {
  STATE_CANCELLED,
  STATE_CLAIMED,
  STATE_HUMAN_REVIEW,
  STATE_RETRY_WAIT,
  STATE_RUNNING
} from "../lib/orchestratorState.mjs";
import {
  ORCHESTRATOR_STATE_MANIFEST_KIND,
  ORCHESTRATOR_STATE_MANIFEST_VERSION,
  createOrchestratorStateSnapshot
} from "../lib/orchestratorStateManifest.mjs";
import { buildOrchestratorStatusSnapshot } from "../lib/orchestratorStatusSnapshot.mjs";
import { runToolPolicyDryRun } from "../lib/orchestratorToolDryRun.mjs";
import { buildWorkflowPolicySnapshot } from "../lib/orchestratorWorkflowPolicy.mjs";

const NOW = "2026-05-03T16:30:00.000Z";
const LATER = "2026-05-03T16:30:10.000Z";
const RUNNING_LABEL = "symphony:running";

function workflowPolicy(overrides = {}) {
  return {
    format: "yaml-front-matter",
    prompt_template: "# Symphony Workflow\n\nPrototype-only integration test.",
    config: {
      version: 1,
      max_concurrent_agents: 1,
      labels: {
        ready: "symphony:ready",
        running: RUNNING_LABEL,
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
        execution_timeout_minutes: 30,
        execution_timeout_kill_grace_seconds: 15
      }
    },
    ...overrides
  };
}

function workflowSnapshot(overrides = {}) {
  const result = buildWorkflowPolicySnapshot(workflowPolicy(overrides), { now: NOW });
  assert.equal(result.ok, true, JSON.stringify(result.errors ?? []));
  return result.snapshot;
}

function repoReadTool(overrides = {}) {
  return {
    tool_id: "repo-reader",
    display_name: "Repo Reader",
    provider: "filesystem",
    source: "codex_builtin",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    available: true,
    credential_state: "none",
    approved_actions: ["read_file", "list_files"],
    denied_actions: ["write_file"],
    ...overrides
  };
}

function githubMutationTool(overrides = {}) {
  return repoReadTool({
    tool_id: "github-plugin",
    display_name: "GitHub",
    provider: "github",
    source: "github_plugin",
    category: CAPABILITY_CATEGORIES.githubMutation,
    approved_actions: ["comment_issue"],
    denied_actions: [],
    ...overrides
  });
}

function capabilitySnapshot(tools = [repoReadTool(), githubMutationTool()]) {
  const result = buildCapabilitySnapshot({
    catalog_version: "codex-tools-v1",
    source: "codex_tool_catalog",
    tools
  }, { now: NOW });
  assert.equal(result.ok, true, JSON.stringify(result.errors ?? []));
  return result;
}

function toolRequest(overrides = {}) {
  return {
    tool_id: "repo-reader",
    action: "read_file",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    ...overrides
  };
}

function runningSnapshot({
  workflow = workflowSnapshot(),
  capabilities = capabilitySnapshot(),
  toolPolicyDecisions = [],
  reason = "adapter_started"
} = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_RUNNING,
    title: "Dry-run integration issue",
    branchName: "symphony/issue-42-dry-run-integration",
    worktreePath: ".symphony/worktrees/issue-42-dry-run-integration",
    logPath: ".symphony/logs/issue-42.jsonl",
    manifestPath: ".symphony/state/manifests/issue-42.json",
    attempt: 1,
    reason,
    workflow,
    capabilitySnapshot: capabilities,
    toolPolicyDecisions
  });
}

function observedRunning({ workflow = workflowSnapshot(), now = NOW, ...overrides } = {}) {
  return {
    now,
    issues: {
      42: {
        eligible: true,
        labels: [RUNNING_LABEL],
        workpadState: "running",
        workpadUpdatedAt: "2026-05-03T16:29:00.000Z",
        workflow,
        workspace: {
          lockHeld: false,
          worktreeExists: true
        },
        ...overrides
      }
    }
  };
}

function adapterSuccess() {
  return adapterResult({
    ok: true,
    reason: "turn_completed",
    terminal_status: "success",
    terminal_reason: "turn_completed",
    last_protocol_event: "turn/completed",
    token_usage: {
      input_tokens: 21,
      output_tokens: 8,
      total_tokens: 29
    },
    rate_limits: {
      requests_remaining: 77
    }
  });
}

function adapterReadTimeout() {
  return adapterResult({
    ok: false,
    reason: "read_timeout",
    terminal_status: "failure",
    terminal_reason: "read_timeout",
    last_protocol_event: "turn/start"
  });
}

function adapterResult(overrides = {}) {
  const result = {
    thread_id: "thread-42",
    turn_id: "turn-1",
    session_id: "thread-42-turn-1",
    turn_count: 1,
    adapter_events_count: 4,
    protocol_events_count: 3,
    last_protocol_event_at: NOW,
    ...overrides
  };
  return {
    ...result,
    now: LATER,
    adapter_state_snapshot: {
      pid: 4242,
      ...result
    }
  };
}

function issueState(result) {
  return result.final_snapshot.issues["42"].state;
}

test("accepted workflow, fake tool evidence, and adapter success produce human_review status", async () => {
  const acceptedWorkflow = workflowSnapshot();
  const capabilities = capabilitySnapshot();
  const toolDryRun = runToolPolicyDryRun({
    capabilitySnapshot: capabilities,
    requests: [
      toolRequest(),
      toolRequest({
        tool_id: "github-plugin",
        action: "comment_issue",
        category: CAPABILITY_CATEGORIES.githubMutation,
        context: {
          operation: "comment_issue",
          target_environment: "local"
        }
      })
    ]
  });
  assert.equal(toolDryRun.ok, true);
  assert.equal(toolDryRun.summary.allowed, 1);
  assert.equal(toolDryRun.summary.blocked, 1);

  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot({
      workflow: acceptedWorkflow,
      capabilities,
      toolPolicyDecisions: toolDryRun.tool_policy_decisions
    }),
    observedSequence: [observedRunning({ workflow: acceptedWorkflow })],
    adapterResults: [adapterSuccess()]
  });
  const status = buildOrchestratorStatusSnapshot(result.final_snapshot, { now: LATER });

  assert.equal(result.ok, true);
  assert.equal(issueState(result), STATE_HUMAN_REVIEW);
  assert.equal(status.ok, true);
  assert.equal(status.counts.human_review, 1);
  assert.equal(status.human_review[0].terminal_status, "success");
  assert.equal(status.tooling.capability_snapshot.present, true);
  assert.equal(status.tooling.capability_snapshot.fingerprint, capabilities.fingerprint);
  assert.equal(status.tooling.tool_policy.decision_count, 2);
  assert.equal(status.tooling.tool_policy.allowed_count, 1);
  assert.equal(status.tooling.tool_policy.blocked_count, 1);
  assert.deepEqual(status.tooling.tool_policy.recent_blocked_reasons, [{
    tool_id: "github-plugin",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    reason: "tool_approval_required"
  }]);
  assert.deepEqual(status.accounting.token_usage_by_issue[0].token_usage, {
    input_tokens: 21,
    output_tokens: 8,
    total_tokens: 29
  });
  assert.ok(result.durableWrites.includes("manifest_success"));
});

test("retryable adapter failure enters retry_wait and retry due eligible reclaims", async () => {
  const acceptedWorkflow = workflowSnapshot();
  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot({ workflow: acceptedWorkflow }),
    observedSequence: [
      observedRunning({ workflow: acceptedWorkflow }),
      observedRunning({
        workflow: acceptedWorkflow,
        now: "2026-05-03T16:30:20.000Z",
        labels: [],
        workpadState: "retry_wait"
      })
    ],
    adapterResults: [adapterReadTimeout()]
  });
  const retryStatus = buildOrchestratorStatusSnapshot(result.snapshots[1], {
    now: "2026-05-03T16:30:20.000Z"
  });

  assert.equal(result.ok, true);
  assert.equal(result.adapter_ingestion_decisions[0].transition.to, STATE_RETRY_WAIT);
  assert.equal(retryStatus.ok, true);
  assert.deepEqual(retryStatus.retry_due.map((entry) => entry.issue_number), [42]);
  assert.equal(issueState(result), STATE_CLAIMED);
  assert.deepEqual(result.final_snapshot.retry_attempts, {});
  assert.ok(result.durableWrites.includes("retry_entry"));
  assert.ok(result.durableWrites.includes("manifest_retry_fired"));
});

test("workflow policy drift cancels before adapter ingestion", async () => {
  const acceptedWorkflow = workflowSnapshot();
  const driftedWorkflow = workflowSnapshot({
    config: {
      ...workflowPolicy().config,
      labels: {
        ...workflowPolicy().config.labels,
        blocked: "symphony:blocked-v2"
      }
    }
  });
  const result = await runOrchestratorHarness({
    initialSnapshot: runningSnapshot({ workflow: acceptedWorkflow }),
    observedSequence: [observedRunning({ workflow: driftedWorkflow })],
    adapterResults: [adapterSuccess()]
  });

  assert.equal(result.ok, true);
  assert.equal(issueState(result), STATE_CANCELLED);
  assert.equal(result.adapter_ingestion_decisions.length, 0);
  assert.equal(result.transcript[0].adapter_ingestion_skipped.reason, "reconciliation_transition_prevented_adapter_ingest");
  assert.equal(result.transcript[0].reconciliation.decisions[0].reason, "workflow_policy_drift");
  assert.ok(result.durableWrites.includes("manifest_cancelled_by_reconciliation"));
});

test("invalid hook policy blocks before fake tool or adapter evaluation", () => {
  const hookPolicy = validateHookPolicy({
    mode: HOOK_EXECUTION_MODES.fake,
    hooks: {
      before_run: {
        command: ["gh", "issue", "edit", "42", "--add-label", "symphony:ready"],
        cwd: ".",
        timeout_ms: 60000,
        output_limit_bytes: 8192
      }
    }
  });

  assert.equal(hookPolicy.ok, false);
  assert.equal(hookPolicy.reason, "hook_policy_invalid");
  assert.deepEqual(hookPolicy.errors.map((error) => error.reason), [
    "github_mutation_command_denied"
  ]);
});

test("malformed capability and secret-like tool evidence fail closed without leaking secrets", () => {
  const secret = "Bearer abcdefghijklmnopqrstuvwxyz123456";
  const capability = buildCapabilitySnapshot({
    catalog_version: "codex-tools-v1",
    source: "codex_tool_catalog",
    tools: [
      repoReadTool({
        metadata: {
          auth_token: secret
        }
      })
    ]
  }, { now: NOW });
  const capabilities = capabilitySnapshot();
  const dryRun = runToolPolicyDryRun({
    capabilitySnapshot: capabilities,
    requests: [{
      ...toolRequest(),
      note: secret
    }]
  });
  const malformedStatus = buildOrchestratorStatusSnapshot({
    manifest_kind: ORCHESTRATOR_STATE_MANIFEST_KIND,
    orchestrator_state_version: ORCHESTRATOR_STATE_MANIFEST_VERSION,
    generated_at: NOW,
    repo: null,
    lock: null,
    issues: {},
    retry_attempts: {},
    state_transitions: [],
    codex_totals: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      seconds_running: 0
    },
    codex_rate_limits: null,
    last_outcome: null,
    capability_snapshot: capabilities,
    tool_policy_decisions: [{
      tool_id: "repo-reader",
      action: "read_file",
      category: CAPABILITY_CATEGORIES.repoFileRead,
      allowed: true,
      reason: "tool_allowed",
      result_summary: {
        token: secret
      }
    }]
  }, { now: NOW });

  assert.equal(capability.ok, false);
  assert.equal(dryRun.summary.malformed, 1);
  assert.equal(dryRun.results[0].reason, "tool_dry_run_secret_input_denied");
  assert.equal(malformedStatus.ok, false);
  assert.match(malformedStatus.error, /tool_evidence_secret_field_denied/);
  assert.doesNotMatch(JSON.stringify(capability), /abcdefghijklmnopqrstuvwxyz123456/);
  assert.doesNotMatch(JSON.stringify(dryRun), /abcdefghijklmnopqrstuvwxyz123456/);
  assert.doesNotMatch(JSON.stringify(malformedStatus), /abcdefghijklmnopqrstuvwxyz123456/);
});
