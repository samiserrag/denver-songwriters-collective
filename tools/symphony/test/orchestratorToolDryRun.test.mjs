import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CAPABILITY_CATEGORIES,
  buildCapabilitySnapshot
} from "../lib/orchestratorCapabilitySnapshot.mjs";
import {
  createOrchestratorStateSnapshot,
  validateOrchestratorStateSnapshot
} from "../lib/orchestratorStateManifest.mjs";
import { buildOrchestratorStatusSnapshot } from "../lib/orchestratorStatusSnapshot.mjs";
import { runToolPolicyDryRun } from "../lib/orchestratorToolDryRun.mjs";
import { STATE_RUNNING } from "../lib/orchestratorState.mjs";

const NOW = "2026-05-03T04:45:00.000Z";

function tool(overrides = {}) {
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

function capabilitySnapshot(tools = [tool()]) {
  const result = buildCapabilitySnapshot({
    catalog_version: "codex-tools-v1",
    source: "codex_tool_catalog",
    tools
  }, { now: NOW });
  assert.equal(result.ok, true, JSON.stringify(result.errors ?? []));
  return result;
}

function request(overrides = {}) {
  return {
    tool_id: "repo-reader",
    action: "read_file",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    ...overrides
  };
}

function githubMutationTool(overrides = {}) {
  return tool({
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

function approval(overrides = {}) {
  return {
    approved: true,
    tool_id: "github-plugin",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    operation: "comment_issue",
    target_environment: "local",
    reason: "tool_approval_required",
    ...overrides
  };
}

test("allows safe fake read-only tool request", () => {
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot(),
    requests: [request()]
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.summary, {
    total: 1,
    allowed: 1,
    blocked: 0,
    approval_required: 0,
    unavailable: 0,
    malformed: 0
  });
  assert.equal(result.results[0].allowed, true);
  assert.equal(result.results[0].reason, "tool_allowed");
  assert.equal(result.results[0].result_summary.mode, "dry_run_only");
  assert.equal(result.results[0].result_summary.executed, false);
  assert.equal(result.tool_policy_decisions.length, 1);
  assert.deepEqual(result.tool_policy_decisions[0].result_summary, {
    executed: false,
    mode: "dry_run_only"
  });
});

test("blocks missing and unavailable tools", () => {
  const snapshot = capabilitySnapshot([
    tool({
      available: false,
      availability_reason: "tool_runtime_unavailable"
    })
  ]);
  const result = runToolPolicyDryRun({
    capabilitySnapshot: snapshot,
    requests: [
      request(),
      request({
        tool_id: "missing-tool",
        action: "read_file"
      })
    ]
  });

  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.allowed, 0);
  assert.equal(result.summary.blocked, 2);
  assert.equal(result.summary.unavailable, 2);
  assert.deepEqual(result.results.map((entry) => entry.reason), [
    "tool_not_in_accepted_snapshot",
    "tool_runtime_unavailable"
  ]);
});

test("blocks high-risk fake mutation without approval", () => {
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot([githubMutationTool()]),
    requests: [request({
      tool_id: "github-plugin",
      action: "comment_issue",
      category: CAPABILITY_CATEGORIES.githubMutation,
      context: {
        operation: "comment_issue",
        target_environment: "local"
      }
    })]
  });

  assert.equal(result.summary.allowed, 0);
  assert.equal(result.summary.blocked, 1);
  assert.equal(result.summary.approval_required, 1);
  assert.equal(result.results[0].reason, "tool_approval_required");
  assert.equal(result.results[0].requires_explicit_approval, true);
  assert.equal(result.results[0].approval_satisfied, false);
});

test("allows high-risk fake request only with exact approval context", () => {
  const exactRequest = request({
    tool_id: "github-plugin",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    context: {
      operation: "comment_issue",
      target_environment: "local"
    }
  });
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot([githubMutationTool()]),
    requests: [exactRequest],
    approvalContexts: [approval()]
  });

  assert.equal(result.summary.allowed, 1);
  assert.equal(result.summary.blocked, 0);
  assert.equal(result.summary.approval_required, 1);
  assert.equal(result.results[0].reason, "tool_allowed");
  assert.equal(result.results[0].approval_satisfied, true);

  const mismatched = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot([githubMutationTool()]),
    requests: [exactRequest],
    approvalContexts: [approval({ action: "merge_pr" })]
  });
  assert.equal(mismatched.summary.allowed, 0);
  assert.equal(mismatched.results[0].reason, "tool_approval_required");
});

test("malformed request fails closed but batch continues", () => {
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot(),
    requests: [
      request(),
      {
        tool_id: "repo-reader",
        action: "read_file"
      },
      null
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.allowed, 1);
  assert.equal(result.summary.blocked, 2);
  assert.equal(result.summary.malformed, 2);
  assert.equal(result.tool_policy_decisions.length, 1);
  assert.deepEqual(result.errors.map((error) => error.reason), [
    "missing_tool_policy_required_field",
    "tool_dry_run_evidence_unavailable",
    "malformed_tool_request"
  ]);
});

test("secret-like input is rejected and not emitted", () => {
  const secret = "Bearer abcdefghijklmnopqrstuvwxyz123456";
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot(),
    requests: [
      {
        ...request(),
        note: secret
      }
    ]
  });

  assert.equal(result.summary.allowed, 0);
  assert.equal(result.summary.blocked, 1);
  assert.equal(result.summary.malformed, 1);
  assert.equal(result.results[0].reason, "tool_dry_run_secret_input_denied");
  assert.equal(result.tool_policy_decisions.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /Bearer abcdefghijklmnopqrstuvwxyz123456/);
});

test("batch output is deterministic across request ordering", () => {
  const snapshot = capabilitySnapshot([
    tool(),
    githubMutationTool()
  ]);
  const readRequest = request();
  const mutationRequest = request({
    tool_id: "github-plugin",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    context: {
      operation: "comment_issue",
      target_environment: "local"
    }
  });

  const first = runToolPolicyDryRun({
    capabilitySnapshot: snapshot,
    requests: [mutationRequest, readRequest]
  });
  const second = runToolPolicyDryRun({
    capabilitySnapshot: snapshot,
    requests: [readRequest, mutationRequest]
  });

  assert.deepEqual(first.results, second.results);
  assert.deepEqual(first.tool_policy_decisions, second.tool_policy_decisions);
});

test("evidence can be consumed by manifest and status helpers", () => {
  const capabilities = capabilitySnapshot([
    tool(),
    githubMutationTool()
  ]);
  const dryRun = runToolPolicyDryRun({
    capabilitySnapshot: capabilities,
    requests: [
      request(),
      request({
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

  const snapshot = createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_RUNNING,
    title: "Tool dry-run evidence integration",
    branchName: "symphony/issue-42-tool-dry-run",
    worktreePath: ".symphony/worktrees/issue-42-tool-dry-run",
    logPath: ".symphony/logs/issue-42.jsonl",
    manifestPath: ".symphony/state/manifests/issue-42.json",
    attempt: 1,
    reason: "tool_dry_run_evidence",
    capabilitySnapshot: capabilities,
    toolPolicyDecisions: dryRun.tool_policy_decisions
  });
  const validated = validateOrchestratorStateSnapshot(snapshot);
  const status = buildOrchestratorStatusSnapshot(validated, { now: NOW });

  assert.equal(validated.tool_policy_decisions.length, 2);
  assert.equal(status.ok, true);
  assert.equal(status.tooling.capability_snapshot.present, true);
  assert.equal(status.tooling.tool_policy.decision_count, 2);
  assert.equal(status.tooling.tool_policy.allowed_count, 1);
  assert.equal(status.tooling.tool_policy.blocked_count, 1);
  assert.deepEqual(status.tooling.tool_policy.recent_blocked_reasons, [{
    tool_id: "github-plugin",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    reason: "tool_approval_required"
  }]);
});

test("helper stays pure and does not import execution modules", () => {
  const source = readFileSync(new URL("../lib/orchestratorToolDryRun.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(source, /node:fs|node:child_process|node:net|node:http|node:https/);
  assert.doesNotMatch(source, /runner\.mjs|cli\.mjs|github\.mjs|codexAdapter\.mjs|codexAppServerAdapter\.mjs/);
  assert.doesNotMatch(source, /mcp__|connector|pluginClient|toolClient/);
});
