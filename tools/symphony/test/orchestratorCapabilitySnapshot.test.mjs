import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_RISK_CLASSES,
  buildCapabilitySnapshot,
  isKnownCapabilityCategory
} from "../lib/orchestratorCapabilitySnapshot.mjs";

const NOW = "2026-05-03T01:00:00.000Z";

function tool(overrides = {}) {
  return {
    tool_id: "github-plugin-read",
    display_name: "GitHub plugin read",
    provider: "github",
    source: "codex_plugin",
    category: CAPABILITY_CATEGORIES.githubRead,
    available: true,
    credential_state: "connected",
    approved_actions: ["read_pr", "read_issue"],
    denied_actions: ["mutate_issue"],
    metadata: {
      scopes_summary: "repo metadata"
    },
    ...overrides
  };
}

function reasons(result) {
  return result.errors.map((error) => error.reason);
}

test("valid minimal empty catalog", () => {
  const result = buildCapabilitySnapshot({}, { now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.generated_at, NOW);
  assert.equal(result.catalog_version, null);
  assert.deepEqual(result.tools, []);
  assert.equal(result.counts_by_category[CAPABILITY_CATEGORIES.githubRead], 0);
  assert.equal(result.counts_by_risk[CAPABILITY_RISK_CLASSES.high], 0);
  assert.deepEqual(result.unavailable_tools, []);
  assert.deepEqual(result.approval_required_tools, []);
  assert.match(result.fingerprint, /^sha256:[a-f0-9]{64}$/);
});

test("valid multi-tool catalog has deterministic ordering", () => {
  const result = buildCapabilitySnapshot({
    catalog_version: "codex-tools-v1",
    source: "codex_tool_catalog",
    tools: [
      tool({
        tool_id: "supabase-write",
        display_name: "Supabase write",
        provider: "supabase",
        category: CAPABILITY_CATEGORIES.supabaseWrite
      }),
      tool({
        tool_id: "github-read",
        category: CAPABILITY_CATEGORIES.githubRead
      }),
      tool({
        tool_id: "axiom-read",
        provider: "axiom",
        category: CAPABILITY_CATEGORIES.axiomRead
      }),
      tool({
        tool_id: "github-mutate",
        category: CAPABILITY_CATEGORIES.githubMutation
      })
    ]
  }, { now: NOW });

  assert.equal(result.ok, true);
  assert.deepEqual(result.tools.map((entry) => `${entry.category}:${entry.tool_id}`), [
    "axiom_read:axiom-read",
    "github_mutation:github-mutate",
    "github_read:github-read",
    "supabase_write:supabase-write"
  ]);
  assert.equal(result.tools[0].display_name, "GitHub plugin read");
  assert.equal(result.tools[1].requires_explicit_approval, true);
  assert.equal(result.tools[2].requires_explicit_approval, false);
});

test("category counts and risk counts cover ADR categories", () => {
  const tools = Object.values(CAPABILITY_CATEGORIES).map((category) => tool({
    tool_id: `tool-${category}`,
    category
  }));
  const result = buildCapabilitySnapshot({ tools }, { now: NOW });

  assert.equal(result.ok, true);
  for (const category of Object.values(CAPABILITY_CATEGORIES)) {
    assert.equal(result.counts_by_category[category], 1, category);
    assert.equal(isKnownCapabilityCategory(category), true);
  }
  assert.equal(result.counts_by_risk.low, 1);
  assert.equal(result.counts_by_risk.medium, 6);
  assert.equal(result.counts_by_risk.high, 6);
});

test("unavailable, disconnected, revoked, and expired tools remain in snapshot", () => {
  const result = buildCapabilitySnapshot({
    tools: [
      tool({
        tool_id: "explicit-unavailable",
        available: false,
        availability_reason: "tool_runtime_unavailable"
      }),
      tool({
        tool_id: "disconnected-tool",
        connected: false
      }),
      tool({
        tool_id: "revoked-tool",
        credential_state: "revoked"
      }),
      tool({
        tool_id: "expired-tool",
        credential_state: "expired"
      })
    ]
  }, { now: NOW });

  assert.equal(result.ok, true);
  assert.deepEqual(result.unavailable_tools.map((entry) => [
    entry.tool_id,
    entry.availability_reason
  ]), [
    ["disconnected-tool", "tool_disconnected"],
    ["expired-tool", "tool_auth_expired"],
    ["explicit-unavailable", "tool_runtime_unavailable"],
    ["revoked-tool", "tool_auth_revoked"]
  ]);
  assert.equal(result.tools.find((entry) => entry.tool_id === "revoked-tool").available, false);
});

test("approval-required tool listing includes high-risk defaults and explicit approvals", () => {
  const result = buildCapabilitySnapshot({
    tools: [
      tool({
        tool_id: "github-read",
        category: CAPABILITY_CATEGORIES.githubRead
      }),
      tool({
        tool_id: "repo-write",
        category: CAPABILITY_CATEGORIES.repoFileWrite,
        requires_explicit_approval: true
      }),
      tool({
        tool_id: "browser-prod",
        category: CAPABILITY_CATEGORIES.browserProductionMutation
      }),
      tool({
        tool_id: "connector-write",
        category: CAPABILITY_CATEGORIES.credentialConnectorWrite
      })
    ]
  }, { now: NOW });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approval_required_tools.map((entry) => entry.tool_id), [
    "browser-prod",
    "connector-write",
    "repo-write"
  ]);
});

test("secret-like fields and values are rejected", () => {
  const secretField = buildCapabilitySnapshot({
    tools: [
      tool({
        metadata: {
          api_key: "redacted"
        }
      })
    ]
  }, { now: NOW });
  const secretValue = buildCapabilitySnapshot({
    tools: [
      tool({
        metadata: {
          note: "Bearer abcdefghijklmnopqrstuvwxyz123456"
        }
      })
    ]
  }, { now: NOW });
  const databaseUrl = buildCapabilitySnapshot({
    tools: [
      tool({
        metadata: {
          note: "postgres://user:password@example.com/db"
        }
      })
    ]
  }, { now: NOW });

  assert.equal(secretField.ok, false);
  assert.equal(secretField.reason, "capability_snapshot_invalid");
  assert.deepEqual(reasons(secretField), ["capability_secret_field_denied"]);
  assert.equal(secretValue.ok, false);
  assert.deepEqual(reasons(secretValue), ["capability_secret_value_denied"]);
  assert.equal(databaseUrl.ok, false);
  assert.deepEqual(reasons(databaseUrl), ["capability_secret_value_denied"]);
});

test("unknown future fields pass through without changing decisions", () => {
  const result = buildCapabilitySnapshot({
    catalog_version: "v1",
    future_catalog_flag: {
      beta: true
    },
    tools: [
      tool({
        future_tool_flag: {
          order: 1,
          enabled: true
        },
        metadata: {
          nested: {
            beta: true
          }
        }
      })
    ]
  }, { now: NOW });

  assert.equal(result.ok, true);
  assert.deepEqual(result.unknown_fields, {
    future_catalog_flag: {
      beta: true
    }
  });
  assert.deepEqual(result.tools[0].unknown_fields, {
    future_tool_flag: {
      enabled: true,
      order: 1
    }
  });
  assert.deepEqual(result.tools[0].metadata, {
    nested: {
      beta: true
    }
  });
});

test("malformed input fails closed", () => {
  const malformedCatalog = buildCapabilitySnapshot([], { now: NOW });
  const malformedTools = buildCapabilitySnapshot({ tools: {} }, { now: NOW });
  const missingRequired = buildCapabilitySnapshot({
    tools: [
      tool({
        tool_id: "",
        category: "unknown"
      })
    ]
  }, { now: NOW });
  const duplicate = buildCapabilitySnapshot({
    tools: [
      tool({ tool_id: "same", category: CAPABILITY_CATEGORIES.githubRead }),
      tool({ tool_id: "same", category: CAPABILITY_CATEGORIES.githubRead })
    ]
  }, { now: NOW });

  assert.equal(malformedCatalog.ok, false);
  assert.deepEqual(reasons(malformedCatalog), ["malformed_capability_catalog"]);
  assert.equal(malformedTools.ok, false);
  assert.deepEqual(reasons(malformedTools), ["malformed_capability_tools"]);
  assert.equal(missingRequired.ok, false);
  assert.deepEqual(reasons(missingRequired).sort(), [
    "missing_capability_required_field",
    "unknown_capability_category"
  ].sort());
  assert.equal(duplicate.ok, false);
  assert.deepEqual(reasons(duplicate), ["duplicate_capability_tool"]);
});

test("invalid injected clock fails closed", () => {
  const result = buildCapabilitySnapshot({}, { now: "not-a-date" });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "capability_snapshot_invalid");
  assert.match(result.errors[0].message, /now must be a valid timestamp/);
});

test("deterministic fingerprint is stable across object key order", () => {
  const left = buildCapabilitySnapshot({
    source: "codex_tool_catalog",
    catalog_version: "v1",
    tools: [
      tool({
        tool_id: "github-read",
        metadata: {
          b: 2,
          a: {
            y: true,
            x: false
          }
        }
      })
    ]
  }, { now: NOW });
  const right = buildCapabilitySnapshot({
    catalog_version: "v1",
    tools: [
      {
        metadata: {
          a: {
            x: false,
            y: true
          },
          b: 2
        },
        denied_actions: ["mutate_issue"],
        approved_actions: ["read_issue", "read_pr"],
        credential_state: "connected",
        available: true,
        category: CAPABILITY_CATEGORIES.githubRead,
        source: "codex_plugin",
        provider: "github",
        display_name: "GitHub plugin read",
        tool_id: "github-read"
      }
    ],
    source: "codex_tool_catalog"
  }, { now: "2026-05-03T02:00:00.000Z" });

  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  assert.equal(left.fingerprint, right.fingerprint);
});

test("fingerprint changes when material capability fields change", () => {
  const left = buildCapabilitySnapshot({
    tools: [
      tool({
        tool_id: "github-read",
        category: CAPABILITY_CATEGORIES.githubRead
      })
    ]
  }, { now: NOW });
  const right = buildCapabilitySnapshot({
    tools: [
      tool({
        tool_id: "github-read",
        category: CAPABILITY_CATEGORIES.githubMutation
      })
    ]
  }, { now: NOW });

  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  assert.notEqual(left.fingerprint, right.fingerprint);
});

test("helper stays pure and does not import runtime or execution modules", () => {
  const source = readFileSync(
    new URL("../lib/orchestratorCapabilitySnapshot.mjs", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /node:fs|node:child_process|node:net|node:http|node:https/);
  assert.doesNotMatch(source, /runner\.mjs|cli\.mjs|github\.mjs|codexAdapter\.mjs|codexAppServerAdapter\.mjs/);
});
