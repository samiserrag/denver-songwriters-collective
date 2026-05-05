import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITY_CATEGORIES,
  buildCapabilitySnapshot
} from "../lib/orchestratorCapabilitySnapshot.mjs";

const NOW = "2026-05-04T00:00:00.000Z";
const FAILURE_KEYS = ["errors", "generated_at", "ok", "reason"];

function baseTool(overrides = {}) {
  return {
    tool_id: "github-read",
    category: CAPABILITY_CATEGORIES.githubRead,
    display_name: "GitHub read",
    source: "codex_plugin",
    provider: "github",
    approved_actions: ["read_pr"],
    denied_actions: [],
    credential_state: "connected",
    ...overrides
  };
}

function assertFailureEnvelope(result) {
  assert.deepEqual(Object.keys(result).sort(), FAILURE_KEYS);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "capability_snapshot_invalid");
  assert.equal(result.generated_at, NOW);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length > 0);
}

test("boundary: malformed catalog/tool envelope shape fails closed", () => {
  const malformedCatalog = buildCapabilitySnapshot([], { now: NOW });
  const malformedTools = buildCapabilitySnapshot({ tools: {} }, { now: NOW });
  const malformedActions = buildCapabilitySnapshot({
    tools: [baseTool({ approved_actions: "read_pr", denied_actions: { blocked: true } })]
  }, { now: NOW });

  assertFailureEnvelope(malformedCatalog);
  assert.deepEqual(malformedCatalog.errors.map((entry) => entry.reason), ["malformed_capability_catalog"]);
  assertFailureEnvelope(malformedTools);
  assert.deepEqual(malformedTools.errors.map((entry) => entry.reason), ["malformed_capability_tools"]);

  assertFailureEnvelope(malformedActions);
  assert.deepEqual(malformedActions.errors.map((entry) => entry.reason).sort(), [
    "invalid_capability_string_array",
    "invalid_capability_string_array"
  ]);
});

test("boundary: malformed tool entries fail closed", () => {
  const missingToolId = buildCapabilitySnapshot({
    tools: [baseTool({ tool_id: null })]
  }, { now: NOW });
  const unknownCategory = buildCapabilitySnapshot({
    tools: [baseTool({ category: "unknown" })]
  }, { now: NOW });
  const malformedCatalogVersion = buildCapabilitySnapshot({
    catalog_version: {},
    tools: [baseTool()]
  }, { now: NOW });

  assertFailureEnvelope(missingToolId);
  assert.deepEqual(missingToolId.errors.map((entry) => entry.reason), ["missing_capability_required_field"]);

  assertFailureEnvelope(unknownCategory);
  assert.deepEqual(unknownCategory.errors.map((entry) => entry.reason), ["unknown_capability_category"]);

  assertFailureEnvelope(malformedCatalogVersion);
  assert.deepEqual(malformedCatalogVersion.errors.map((entry) => entry.reason), ["invalid_catalog_version"]);
});

test("boundary: approved/denied overlap is preserved and deterministic", () => {
  const left = buildCapabilitySnapshot({
    source: "codex_tool_catalog",
    catalog_version: "v1",
    tools: [baseTool({ approved_actions: ["mutate_issue", "read_pr"], denied_actions: ["mutate_issue"] })]
  }, { now: NOW });
  const right = buildCapabilitySnapshot({
    catalog_version: "v1",
    tools: [{
      denied_actions: ["mutate_issue"],
      approved_actions: ["mutate_issue", "read_pr"],
      provider: "github",
      source: "codex_plugin",
      display_name: "GitHub read",
      category: CAPABILITY_CATEGORIES.githubRead,
      credential_state: "connected",
      tool_id: "github-read"
    }],
    source: "codex_tool_catalog"
  }, { now: "2026-05-04T01:00:00.000Z" });

  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  assert.deepEqual(left.tools[0].approved_actions, ["mutate_issue", "read_pr"]);
  assert.deepEqual(left.tools[0].denied_actions, ["mutate_issue"]);
  assert.equal(left.fingerprint, right.fingerprint);
});
