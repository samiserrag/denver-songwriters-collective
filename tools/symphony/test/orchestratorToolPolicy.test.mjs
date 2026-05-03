import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CAPABILITY_CATEGORIES,
  buildCapabilitySnapshot
} from "../lib/orchestratorCapabilitySnapshot.mjs";
import {
  decideToolPolicy,
  isHighRiskToolCategory
} from "../lib/orchestratorToolPolicy.mjs";

const NOW = "2026-05-03T03:00:00.000Z";

function capability(overrides = {}) {
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

function snapshot(tools) {
  const result = buildCapabilitySnapshot({ tools }, { now: NOW });
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

function approve(overrides = {}) {
  return {
    approved: true,
    tool_id: overrides.tool_id ?? "github-plugin",
    category: overrides.category ?? CAPABILITY_CATEGORIES.githubMutation,
    action: overrides.action ?? "comment_issue",
    operation: overrides.operation ?? "comment_issue",
    target_environment: overrides.target_environment ?? "local",
    reason: overrides.reason ?? "tool_approval_required"
  };
}

function reasons(result) {
  return result.errors.map((error) => error.reason);
}

test("allows repo_file_read with available approved tool", () => {
  const result = decideToolPolicy(snapshot([
    capability()
  ]), request());

  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "tool_allowed");
  assert.equal(result.tool_id, "repo-reader");
  assert.equal(result.category, CAPABILITY_CATEGORIES.repoFileRead);
  assert.equal(result.requires_explicit_approval, false);
  assert.equal(result.approval_satisfied, false);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.evidence.requested, {
    tool_id: "repo-reader",
    action: "read_file",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    operation: null,
    target_environment: null,
    production: false,
    credential_bearing: false
  });
  assert.deepEqual(result.evidence.matched_tool, {
    tool_id: "repo-reader",
    display_name: "Repo Reader",
    provider: "filesystem",
    source: "codex_builtin"
  });
});

test("blocks missing tool", () => {
  const result = decideToolPolicy(snapshot([]), request());

  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "tool_not_in_accepted_snapshot");
  assert.deepEqual(reasons(result), ["tool_not_in_accepted_snapshot"]);
  assert.equal(result.evidence.matched_tool, null);
});

test("blocks unavailable, revoked, and expired tools", () => {
  const unavailable = decideToolPolicy(snapshot([
    capability({
      available: false,
      availability_reason: "tool_runtime_unavailable"
    })
  ]), request());
  const revoked = decideToolPolicy(snapshot([
    capability({
      credential_state: "revoked"
    })
  ]), request());
  const expired = decideToolPolicy(snapshot([
    capability({
      credential_state: "expired"
    })
  ]), request());

  assert.equal(unavailable.reason, "tool_runtime_unavailable");
  assert.deepEqual(reasons(unavailable), ["tool_runtime_unavailable"]);
  assert.equal(revoked.reason, "tool_auth_revoked");
  assert.deepEqual(reasons(revoked), ["tool_auth_revoked"]);
  assert.equal(expired.reason, "tool_auth_expired");
  assert.deepEqual(reasons(expired), ["tool_auth_expired"]);
});

test("blocks category mismatch", () => {
  const result = decideToolPolicy(snapshot([
    capability()
  ]), request({
    category: CAPABILITY_CATEGORIES.githubRead
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, "tool_category_mismatch");
  assert.deepEqual(reasons(result), ["tool_category_mismatch"]);
});

test("blocks denied action", () => {
  const result = decideToolPolicy(snapshot([
    capability()
  ]), request({
    action: "write_file"
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, "tool_action_denied");
  assert.deepEqual(reasons(result), ["tool_action_denied"]);
});

test("blocks unapproved action", () => {
  const result = decideToolPolicy(snapshot([
    capability()
  ]), request({
    action: "read_secret_file"
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, "tool_action_not_approved");
  assert.deepEqual(reasons(result), ["tool_action_not_approved"]);
});

test("blocks github_mutation without explicit approval", () => {
  const result = decideToolPolicy(snapshot([
    capability({
      tool_id: "github-plugin",
      display_name: "GitHub",
      provider: "github",
      source: "github_plugin",
      category: CAPABILITY_CATEGORIES.githubMutation,
      approved_actions: ["comment_issue"],
      denied_actions: []
    })
  ]), request({
    tool_id: "github-plugin",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    context: {
      operation: "comment_issue",
      target_environment: "local"
    }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, "tool_approval_required");
  assert.equal(result.requires_explicit_approval, true);
  assert.equal(result.approval_satisfied, false);
  assert.equal(result.evidence.approval.required, true);
});

test("blocks supabase_write migration apply without explicit approval", () => {
  const result = decideToolPolicy(snapshot([
    capability({
      tool_id: "supabase-cli",
      provider: "supabase",
      category: CAPABILITY_CATEGORIES.supabaseWrite,
      approved_actions: ["migration_apply"],
      denied_actions: []
    })
  ]), request({
    tool_id: "supabase-cli",
    action: "migration_apply",
    category: CAPABILITY_CATEGORIES.supabaseWrite,
    context: {
      operation: "migration_apply",
      target_environment: "production"
    }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, "production_mutation_approval_required");
  assert.equal(result.evidence.approval.requirement, "production_mutation_approval_required");
});

test("blocks browser production form submission without explicit approval", () => {
  const result = decideToolPolicy(snapshot([
    capability({
      tool_id: "browser-use",
      provider: "browser",
      category: CAPABILITY_CATEGORIES.browserProductionMutation,
      approved_actions: ["submit_form"],
      denied_actions: []
    })
  ]), request({
    tool_id: "browser-use",
    action: "submit_form",
    category: CAPABILITY_CATEGORIES.browserProductionMutation,
    context: {
      operation: "submit_form",
      production: true,
      target_environment: "production"
    }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, "production_mutation_approval_required");
});

test("blocks credential_connector_write without explicit approval", () => {
  const result = decideToolPolicy(snapshot([
    capability({
      tool_id: "gmail-connector",
      provider: "gmail",
      source: "codex_connector",
      category: CAPABILITY_CATEGORIES.credentialConnectorWrite,
      approved_actions: ["send_email"],
      denied_actions: []
    })
  ]), request({
    tool_id: "gmail-connector",
    action: "send_email",
    category: CAPABILITY_CATEGORIES.credentialConnectorWrite,
    context: {
      operation: "send_email",
      credential_bearing: true
    }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, "credential_write_approval_required");
});

test("allows high-risk action only with exact explicit approval context", () => {
  const acceptedSnapshot = snapshot([
    capability({
      tool_id: "github-plugin",
      display_name: "GitHub",
      provider: "github",
      source: "github_plugin",
      category: CAPABILITY_CATEGORIES.githubMutation,
      approved_actions: ["comment_issue"],
      denied_actions: []
    })
  ]);
  const baseRequest = request({
    tool_id: "github-plugin",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    context: {
      operation: "comment_issue",
      target_environment: "local",
      approval: approve()
    }
  });
  const allowed = decideToolPolicy(acceptedSnapshot, baseRequest);
  const mismatched = decideToolPolicy(acceptedSnapshot, {
    ...baseRequest,
    context: {
      ...baseRequest.context,
      approval: approve({ action: "edit_issue" })
    }
  });

  assert.equal(allowed.ok, true);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.requires_explicit_approval, true);
  assert.equal(allowed.approval_satisfied, true);
  assert.equal(allowed.evidence.approval.satisfied, true);
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.reason, "tool_approval_required");
});

test("malformed snapshot and request inputs fail closed", () => {
  const malformedSnapshot = decideToolPolicy({}, request());
  const secretSnapshot = decideToolPolicy({
    ...snapshot([
      capability()
    ]),
    token: "ghp_abcdefghijklmnopqrstuvwxyz123456"
  }, request());
  const malformedRequest = decideToolPolicy(snapshot([
    capability()
  ]), {
    tool_id: "repo-reader",
    action: "read_file",
    category: "unknown"
  });
  const secretInput = decideToolPolicy(snapshot([
    capability()
  ]), request({
    context: {
      approval: {
        approved: true,
        token: "ghp_abcdefghijklmnopqrstuvwxyz123456"
      }
    }
  }));

  assert.equal(malformedSnapshot.ok, false);
  assert.equal(malformedSnapshot.reason, "capability_snapshot_invalid");
  assert.equal(secretSnapshot.ok, false);
  assert.equal(secretSnapshot.reason, "capability_snapshot_invalid");
  assert.deepEqual(reasons(secretSnapshot).sort(), [
    "tool_policy_secret_field_denied",
    "tool_policy_secret_value_denied"
  ].sort());
  assert.equal(malformedRequest.ok, false);
  assert.equal(malformedRequest.reason, "tool_policy_invalid");
  assert.deepEqual(reasons(malformedRequest), ["unknown_capability_category"]);
  assert.equal(secretInput.ok, false);
  assert.equal(secretInput.reason, "tool_policy_invalid");
  assert.deepEqual(reasons(secretInput).sort(), [
    "tool_policy_secret_field_denied",
    "tool_policy_secret_value_denied"
  ].sort());
});

test("evidence shape is stable and secret-free", () => {
  const result = decideToolPolicy(snapshot([
    capability()
  ]), request());
  const json = JSON.stringify(result.evidence);

  assert.deepEqual(Object.keys(result.evidence), [
    "policy_version",
    "requested",
    "matched_tool",
    "allowed",
    "reason",
    "approval",
    "availability_reason",
    "risk_class"
  ]);
  assert.doesNotMatch(json, /secret|token|password|ghp_|Bearer/i);
});

test("high-risk category helper covers ADR tool policy categories", () => {
  assert.equal(isHighRiskToolCategory(CAPABILITY_CATEGORIES.githubMutation), true);
  assert.equal(isHighRiskToolCategory(CAPABILITY_CATEGORIES.supabaseWrite), true);
  assert.equal(isHighRiskToolCategory(CAPABILITY_CATEGORIES.credentialConnectorWrite), true);
  assert.equal(isHighRiskToolCategory(CAPABILITY_CATEGORIES.repoFileRead), false);
  assert.equal(isHighRiskToolCategory(CAPABILITY_CATEGORIES.githubRead), false);
});

test("helper stays pure and does not import execution modules", () => {
  const source = readFileSync(
    new URL("../lib/orchestratorToolPolicy.mjs", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /node:fs|node:child_process|node:net|node:http|node:https/);
  assert.doesNotMatch(source, /runner\.mjs|cli\.mjs|github\.mjs|codexAdapter\.mjs|codexAppServerAdapter\.mjs/);
});
