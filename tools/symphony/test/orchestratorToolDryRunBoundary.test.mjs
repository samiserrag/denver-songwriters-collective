import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITY_CATEGORIES,
  buildCapabilitySnapshot
} from "../lib/orchestratorCapabilitySnapshot.mjs";
import { runToolPolicyDryRun } from "../lib/orchestratorToolDryRun.mjs";

const NOW = "2026-05-03T04:45:00.000Z";
const RESULT_SUMMARY = Object.freeze({
  mode: "dry_run_only",
  executed: false
});
const TOP_LEVEL_KEYS = Object.freeze([
  "dry_run",
  "dry_run_version",
  "errors",
  "ok",
  "reason",
  "results",
  "summary",
  "tool_policy_decisions"
]);
const RESULT_KEYS = Object.freeze([
  "action",
  "allowed",
  "approval_satisfied",
  "availability_reason",
  "category",
  "decision",
  "errors",
  "evidence",
  "ok",
  "reason",
  "requires_explicit_approval",
  "result_summary",
  "risk_class",
  "tool_id"
]);

function tool(overrides = {}) {
  return {
    tool_id: "repo-reader",
    display_name: "Repo Reader",
    provider: "filesystem",
    source: "codex_builtin",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    available: true,
    credential_state: "none",
    approved_actions: ["list_files", "read_file"],
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

function assertDryRunEnvelope(result, summary) {
  assert.deepEqual(Object.keys(result).sort(), TOP_LEVEL_KEYS);
  assert.equal(result.ok, true);
  assert.equal(result.reason, "tool_dry_run_completed");
  assert.equal(result.dry_run, true);
  assert.equal(result.dry_run_version, 1);
  assert.deepEqual(result.summary, summary);
}

function assertFailureEnvelope(result, expected) {
  assert.deepEqual(Object.keys(result).sort(), TOP_LEVEL_KEYS);
  assert.equal(result.ok, false);
  assert.equal(result.reason, expected.reason);
  assert.equal(result.dry_run, true);
  assert.equal(result.dry_run_version, 1);
  assert.deepEqual(result.summary, {
    total: 0,
    allowed: 0,
    blocked: 0,
    approval_required: 0,
    unavailable: 0,
    malformed: 0
  });
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.tool_policy_decisions, []);
  assert.deepEqual(result.errors.map((error) => error.reason), expected.errorReasons);
}

function assertBlockedResult(result, expected) {
  assert.deepEqual(Object.keys(result).sort(), RESULT_KEYS);
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.decision, "block");
  assert.equal(result.reason, expected.reason);
  assert.equal(result.tool_id, expected.tool_id);
  assert.equal(result.action, expected.action);
  assert.equal(result.category, expected.category);
  assert.deepEqual(result.result_summary, RESULT_SUMMARY);
  assert.deepEqual(result.errors.map((error) => error.reason), expected.errorReasons);
  assert.equal(result.evidence === null, expected.evidenceNull);
}

test("malformed capability snapshot input fails closed per request without crashing the batch", () => {
  const result = runToolPolicyDryRun({
    capabilitySnapshot: {
      ok: true,
      schema_version: 1,
      tools: [],
      fingerprint: "not-a-sha"
    },
    requests: [request()]
  });

  assertDryRunEnvelope(result, {
    total: 1,
    allowed: 0,
    blocked: 1,
    approval_required: 0,
    unavailable: 0,
    malformed: 1
  });
  assertBlockedResult(result.results[0], {
    reason: "capability_snapshot_invalid",
    tool_id: "repo-reader",
    action: "read_file",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    errorReasons: ["capability_snapshot_fingerprint_missing"],
    evidenceNull: false
  });
  assert.equal(result.tool_policy_decisions.length, 1);
  assert.equal(result.tool_policy_decisions[0].reason, "capability_snapshot_invalid");
});

test("request required-field failures pin null evidence and stable malformed counts", () => {
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot(),
    requests: [
      { action: "read_file", category: CAPABILITY_CATEGORIES.repoFileRead },
      { tool_id: "repo-reader", category: CAPABILITY_CATEGORIES.repoFileRead },
      { tool_id: "repo-reader", action: "read_file" }
    ]
  });

  assertDryRunEnvelope(result, {
    total: 3,
    allowed: 0,
    blocked: 3,
    approval_required: 0,
    unavailable: 0,
    malformed: 3
  });
  assert.deepEqual(result.results.map((entry) => entry.reason), [
    "tool_policy_invalid",
    "tool_policy_invalid",
    "tool_policy_invalid"
  ]);
  assert.deepEqual(result.results.map((entry) => entry.evidence), [null, null, null]);
  assert.deepEqual(result.tool_policy_decisions, []);
  assert.deepEqual(result.errors.map((error) => error.reason), [
    "missing_tool_policy_required_field",
    "tool_dry_run_evidence_unavailable",
    "missing_tool_policy_required_field",
    "tool_dry_run_evidence_unavailable",
    "missing_tool_policy_required_field",
    "tool_dry_run_evidence_unavailable"
  ]);
});

test("unknown request category fails closed before any fake allow decision", () => {
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot(),
    requests: [request({ category: "future_connector_write" })]
  });

  assertDryRunEnvelope(result, {
    total: 1,
    allowed: 0,
    blocked: 1,
    approval_required: 0,
    unavailable: 0,
    malformed: 1
  });
  assertBlockedResult(result.results[0], {
    reason: "tool_policy_invalid",
    tool_id: "repo-reader",
    action: "read_file",
    category: "future_connector_write",
    errorReasons: [
      "unknown_capability_category",
      "tool_dry_run_evidence_unavailable"
    ],
    evidenceNull: true
  });
  assert.deepEqual(result.tool_policy_decisions, []);
});

test("denied action wins even when capability input also approved that action", () => {
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot([
      tool({
        approved_actions: ["read_file", "write_file"],
        denied_actions: ["write_file"]
      })
    ]),
    requests: [request({ action: "write_file" })]
  });

  assertDryRunEnvelope(result, {
    total: 1,
    allowed: 0,
    blocked: 1,
    approval_required: 0,
    unavailable: 0,
    malformed: 0
  });
  assertBlockedResult(result.results[0], {
    reason: "tool_action_denied",
    tool_id: "repo-reader",
    action: "write_file",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    errorReasons: ["tool_action_denied"],
    evidenceNull: false
  });
  assert.equal(result.tool_policy_decisions.length, 1);
  assert.equal(result.tool_policy_decisions[0].reason, "tool_action_denied");
  assert.equal(result.tool_policy_decisions[0].allowed, false);
});

test("request for a different snapshot tool stays unavailable and deterministic", () => {
  const result = runToolPolicyDryRun({
    capabilitySnapshot: capabilitySnapshot([
      tool({ tool_id: "repo-reader" }),
      tool({
        tool_id: "github-reader",
        provider: "github",
        source: "github_plugin",
        category: CAPABILITY_CATEGORIES.githubRead,
        approved_actions: ["read_pr"],
        denied_actions: ["comment_issue"]
      })
    ]),
    requests: [
      request({
        tool_id: "github-reader",
        action: "comment_issue",
        category: CAPABILITY_CATEGORIES.githubRead
      }),
      request({ tool_id: "not-in-snapshot" })
    ]
  });

  assertDryRunEnvelope(result, {
    total: 2,
    allowed: 0,
    blocked: 2,
    approval_required: 0,
    unavailable: 1,
    malformed: 0
  });
  assert.deepEqual(result.results.map((entry) => [
    entry.tool_id,
    entry.reason
  ]), [
    ["github-reader", "tool_action_denied"],
    ["not-in-snapshot", "tool_not_in_accepted_snapshot"]
  ]);
  assert.deepEqual(result.tool_policy_decisions.map((entry) => [
    entry.tool_id,
    entry.reason
  ]), [
    ["github-reader", "tool_action_denied"],
    ["not-in-snapshot", "tool_not_in_accepted_snapshot"]
  ]);
});

test("malformed top-level dry-run inputs use the fixed fail-closed envelope", () => {
  assertFailureEnvelope(runToolPolicyDryRun(null), {
    reason: "tool_dry_run_invalid",
    errorReasons: ["malformed_tool_dry_run_input"]
  });
  assertFailureEnvelope(runToolPolicyDryRun({ requests: {} }), {
    reason: "tool_dry_run_invalid",
    errorReasons: ["malformed_tool_dry_run_requests"]
  });
  assertFailureEnvelope(runToolPolicyDryRun({
    requests: [],
    approvalContexts: {}
  }), {
    reason: "tool_dry_run_invalid",
    errorReasons: ["malformed_tool_dry_run_approvals"]
  });
});
