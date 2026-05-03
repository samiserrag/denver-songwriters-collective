import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CAPABILITY_CATEGORIES,
  buildCapabilitySnapshot
} from "../lib/orchestratorCapabilitySnapshot.mjs";
import {
  EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
  EVENT_RETRY_DUE,
  reduceOrchestratorState,
  STATE_BLOCKED,
  STATE_CLAIMED,
  STATE_RETRY_WAIT,
  STATE_RUNNING
} from "../lib/orchestratorState.mjs";
import {
  createOrchestratorStateSnapshot,
  ORCHESTRATOR_STATE_MANIFEST_KIND,
  ORCHESTRATOR_STATE_MANIFEST_VERSION,
  readOrchestratorStateManifest,
  validateOrchestratorStateSnapshot,
  writeOrchestratorStateManifest
} from "../lib/orchestratorStateManifest.mjs";
import { decideToolPolicy } from "../lib/orchestratorToolPolicy.mjs";

const NOW = "2026-05-02T19:45:00.000Z";

async function tempManifestPath() {
  const root = await mkdtemp(path.join(os.tmpdir(), "symphony-orchestrator-state-"));
  return path.join(root, "state", "orchestrator-state.json");
}

function makeRunningSnapshot(overrides = {}) {
  return createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_RUNNING,
    title: "State persistence test",
    branchName: "symphony/issue-42-state-persistence-test",
    worktreePath: ".symphony/worktrees/issue-42-state-persistence-test",
    logPath: ".symphony/logs/issue-42.jsonl",
    manifestPath: ".symphony/state/manifests/run.json",
    attempt: 1,
    reason: "adapter_started",
    repo: {
      head: "head-sha",
      origin_main: "origin-sha",
      clean: true
    },
    lock: {
      held: true,
      run_id: "run-1"
    },
    ...overrides
  });
}

function tool(overrides = {}) {
  return {
    tool_id: "repo-reader",
    display_name: "Repo Reader",
    provider: "filesystem",
    source: "codex_builtin",
    category: CAPABILITY_CATEGORIES.repoFileRead,
    available: true,
    credential_state: "none",
    approved_actions: ["read_file"],
    denied_actions: ["write_file"],
    ...overrides
  };
}

function capabilitySnapshot() {
  const result = buildCapabilitySnapshot({
    catalog_version: "codex-tools-v1",
    source: "codex_tool_catalog",
    tools: [
      tool(),
      tool({
        tool_id: "github-mutation",
        display_name: "GitHub mutation",
        provider: "github",
        category: CAPABILITY_CATEGORIES.githubMutation,
        approved_actions: ["comment_issue"],
        denied_actions: []
      }),
      tool({
        tool_id: "revoked-gmail",
        display_name: "Gmail",
        provider: "gmail",
        category: CAPABILITY_CATEGORIES.credentialConnectorWrite,
        available: false,
        availability_reason: "tool_auth_revoked",
        credential_state: "revoked",
        approved_actions: ["send_email"],
        denied_actions: []
      })
    ]
  }, { now: NOW });
  assert.equal(result.ok, true, JSON.stringify(result.errors ?? []));
  return result;
}

test("writes and reads a valid orchestrator state manifest round trip", async () => {
  const manifestPath = await tempManifestPath();
  const snapshot = makeRunningSnapshot();

  await writeOrchestratorStateManifest(manifestPath, snapshot);
  const raw = await readFile(manifestPath, "utf8");
  assert.match(raw, /\n$/);

  const readBack = await readOrchestratorStateManifest(manifestPath);

  assert.deepEqual(readBack, snapshot);
  assert.equal(readBack.manifest_kind, ORCHESTRATOR_STATE_MANIFEST_KIND);
  assert.equal(readBack.orchestrator_state_version, ORCHESTRATOR_STATE_MANIFEST_VERSION);
  assert.equal(readBack.issues["42"].issue_number, 42);
  assert.equal(readBack.issues["42"].state, STATE_RUNNING);
  assert.equal(readBack.issues["42"].branch_name, "symphony/issue-42-state-persistence-test");
  assert.equal(readBack.issues["42"].worktree_path, ".symphony/worktrees/issue-42-state-persistence-test");
  assert.equal(readBack.issues["42"].updated_at, NOW);
});

test("readOrchestratorStateManifest returns null for a missing file", async () => {
  const manifestPath = path.join(await mkdtemp(path.join(os.tmpdir(), "symphony-missing-state-")), "missing.json");

  assert.equal(await readOrchestratorStateManifest(manifestPath), null);
});

test("rejects unknown schema version", () => {
  const snapshot = makeRunningSnapshot({
    generatedAt: NOW
  });

  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      orchestrator_state_version: 999
    }),
    /unknown orchestrator state manifest version: 999/
  );
});

test("rejects unknown state", () => {
  const snapshot = makeRunningSnapshot();

  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      issues: {
        "42": {
          ...snapshot.issues["42"],
          state: "not_a_state"
        }
      }
    }),
    /issues\.42\.state is unknown orchestrator state: not_a_state/
  );
});

test("rejects malformed retry_attempts", () => {
  const snapshot = makeRunningSnapshot({
    retryAttempts: {
      42: {
        issue_number: 42,
        state: STATE_RETRY_WAIT,
        attempt: 1,
        max_attempts: 3,
        delay_ms: 10000,
        due_at: "2026-05-02T19:45:10.000Z",
        reason: "read_timeout",
        updated_at: NOW
      }
    }
  });

  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      retry_attempts: []
    }),
    /retry_attempts must be an object/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      retry_attempts: {
        "42": {
          ...snapshot.retry_attempts["42"],
          attempt: 0
        }
      }
    }),
    /retry_attempts\.42\.attempt must be a positive integer/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      retry_attempts: {
        "42": {
          ...snapshot.retry_attempts["42"],
          state: STATE_RUNNING
        }
      }
    }),
    /retry_attempts\.42\.state must be retry_wait/
  );
});

test("rejects missing required identifiers and timestamps", () => {
  const snapshot = makeRunningSnapshot();

  assert.throws(
    () => createOrchestratorStateSnapshot({
      generatedAt: NOW,
      state: STATE_RUNNING
    }),
    /issue\.issue_number must be a positive integer/
  );
  assert.throws(
    () => createOrchestratorStateSnapshot({
      generatedAt: "not-a-date",
      issueNumber: 42,
      state: STATE_RUNNING
    }),
    /generated_at must be a valid timestamp/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      generated_at: null
    }),
    /generated_at must be a valid timestamp/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...snapshot,
      issues: {
        "42": {
          ...snapshot.issues["42"],
          updated_at: "not-a-date"
        }
      }
    }),
    /issues\.42\.updated_at must be a valid timestamp/
  );
});

test("preserves retry attempts across retry_wait to claimed scenario", () => {
  const retryTransition = reduceOrchestratorState(
    STATE_RUNNING,
    EVENT_ADAPTER_TERMINAL_RETRYABLE_FAILURE,
    {
      reason: "read_timeout",
      retryAttempt: 1
    }
  );
  const retrySnapshot = createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_RETRY_WAIT,
    branchName: "symphony/issue-42-state-persistence-test",
    worktreePath: ".symphony/worktrees/issue-42-state-persistence-test",
    manifestPath: ".symphony/state/manifests/retry.json",
    reason: retryTransition.reason,
    retry: retryTransition.retry,
    transition: retryTransition
  });

  assert.deepEqual(retrySnapshot.retry_attempts["42"], {
    issue_number: 42,
    state: STATE_RETRY_WAIT,
    attempt: 1,
    max_attempts: 3,
    delay_ms: 10000,
    due_at: "2026-05-02T19:45:10.000Z",
    reason: "read_timeout",
    last_error: "read_timeout",
    branch_name: "symphony/issue-42-state-persistence-test",
    worktree_path: ".symphony/worktrees/issue-42-state-persistence-test",
    manifest_path: ".symphony/state/manifests/retry.json",
    updated_at: NOW
  });

  const claimTransition = reduceOrchestratorState(STATE_RETRY_WAIT, EVENT_RETRY_DUE, {
    issueEligible: true
  });
  const claimedSnapshot = createOrchestratorStateSnapshot({
    generatedAt: "2026-05-02T19:45:10.000Z",
    issueNumber: 42,
    state: STATE_CLAIMED,
    reason: claimTransition.reason,
    retryAttempts: retrySnapshot.retry_attempts,
    transition: claimTransition
  });

  assert.deepEqual(claimedSnapshot.retry_attempts["42"], retrySnapshot.retry_attempts["42"]);
  assert.equal(claimedSnapshot.issues["42"].state, STATE_CLAIMED);
  assert.equal(claimedSnapshot.state_transitions.at(-1).from, STATE_RETRY_WAIT);
  assert.equal(claimedSnapshot.state_transitions.at(-1).to, STATE_CLAIMED);
});

test("persists terminal status/reason and adapter_state_snapshot without interpreting them", () => {
  const adapterStateSnapshot = {
    pid: 123,
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    terminal_status: "failure",
    terminal_reason: "future_adapter_reason",
    token_usage: {
      total_tokens: 12
    }
  };
  const snapshot = createOrchestratorStateSnapshot({
    generatedAt: NOW,
    issueNumber: 42,
    state: STATE_BLOCKED,
    reason: "future_adapter_reason",
    terminalStatus: "failure",
    terminalReason: "future_adapter_reason",
    adapterStateSnapshot
  });

  assert.equal(snapshot.issues["42"].terminal_status, "failure");
  assert.equal(snapshot.issues["42"].terminal_reason, "future_adapter_reason");
  assert.deepEqual(snapshot.issues["42"].adapter_state_snapshot, adapterStateSnapshot);
});

test("manifest includes capability snapshot summary from plain data", () => {
  const capabilities = capabilitySnapshot();
  const snapshot = makeRunningSnapshot({
    capabilitySnapshot: capabilities
  });

  assert.equal(snapshot.capability_snapshot.fingerprint, capabilities.fingerprint);
  assert.equal(snapshot.capability_snapshot.catalog_version, "codex-tools-v1");
  assert.equal(snapshot.capability_snapshot.generated_at, NOW);
  assert.equal(snapshot.capability_snapshot.counts_by_category.github_mutation, 1);
  assert.equal(snapshot.capability_snapshot.counts_by_risk.high, 2);
  assert.equal(snapshot.capability_snapshot.unavailable_tool_count, 1);
  assert.deepEqual(snapshot.capability_snapshot.unavailable_tools, [{
    tool_id: "revoked-gmail",
    display_name: "Gmail",
    category: CAPABILITY_CATEGORIES.credentialConnectorWrite,
    availability_reason: "tool_auth_revoked",
    credential_state: "revoked"
  }]);
  assert.equal(snapshot.capability_snapshot.approval_required_tool_count, 2);
  assert.deepEqual(snapshot.capability_snapshot.approval_required_tools.map((entry) => entry.tool_id), [
    "revoked-gmail",
    "github-mutation"
  ]);
});

test("manifest includes allowed and blocked tool-policy evidence", () => {
  const capabilities = capabilitySnapshot();
  const allowed = decideToolPolicy(capabilities, {
    tool_id: "repo-reader",
    action: "read_file",
    category: CAPABILITY_CATEGORIES.repoFileRead
  });
  const blocked = decideToolPolicy(capabilities, {
    tool_id: "github-mutation",
    action: "comment_issue",
    category: CAPABILITY_CATEGORIES.githubMutation,
    context: {
      operation: "comment_issue",
      target_environment: "local"
    }
  });

  const snapshot = makeRunningSnapshot({
    capabilitySnapshot: capabilities,
    toolPolicyDecisions: [blocked, allowed]
  });

  assert.deepEqual(snapshot.tool_policy_decisions.map((decision) => [
    decision.tool_id,
    decision.action,
    decision.allowed,
    decision.reason
  ]), [
    ["github-mutation", "comment_issue", false, "tool_approval_required"],
    ["repo-reader", "read_file", true, "tool_allowed"]
  ]);
  assert.deepEqual(snapshot.tool_policy_decisions[0].matched_tool, {
    tool_id: "github-mutation",
    display_name: "GitHub mutation",
    provider: "github",
    source: "codex_builtin"
  });
  assert.equal(snapshot.tool_policy_decisions[0].requires_explicit_approval, true);
  assert.equal(snapshot.tool_policy_decisions[0].approval_satisfied, false);
});

test("secret-like capability and tool-policy evidence is rejected", () => {
  const capabilities = capabilitySnapshot();
  const allowed = decideToolPolicy(capabilities, {
    tool_id: "repo-reader",
    action: "read_file",
    category: CAPABILITY_CATEGORIES.repoFileRead
  });
  const base = makeRunningSnapshot();

  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...base,
      capability_snapshot: {
        ...capabilities,
        token: "ghp_abcdefghijklmnopqrstuvwxyz123456"
      }
    }),
    /tool_evidence_secret_field_denied/
  );
  assert.throws(
    () => validateOrchestratorStateSnapshot({
      ...base,
      tool_policy_decisions: [{
        ...allowed,
        result_summary: {
          note: "Bearer abcdefghijklmnopqrstuvwxyz123456"
        }
      }]
    }),
    /tool_evidence_secret_value_denied/
  );
});

test("readOrchestratorStateManifest rejects invalid JSON with a useful error", async () => {
  const manifestPath = await tempManifestPath();
  await writeOrchestratorStateManifest(manifestPath, makeRunningSnapshot());
  const invalidPath = path.join(path.dirname(manifestPath), "invalid.json");
  await writeFile(invalidPath, "{not-json", "utf8");

  await assert.rejects(
    () => readOrchestratorStateManifest(invalidPath),
    /invalid orchestrator state manifest JSON/
  );
});

test("supports injected filesystem functions for local-file tests", async () => {
  const calls = [];
  const snapshot = makeRunningSnapshot();
  const filePath = "/fake/orchestrator-state.json";
  let writtenText = "";

  await writeOrchestratorStateManifest(filePath, snapshot, {
    mkdirFn: async (directory, options) => {
      calls.push(["mkdir", directory, options]);
    },
    writeFileFn: async (target, text, encoding) => {
      calls.push(["writeFile", target, encoding]);
      writtenText = text;
    }
  });

  assert.deepEqual(calls, [
    ["mkdir", "/fake", { recursive: true }],
    ["writeFile", filePath, "utf8"]
  ]);

  const readBack = await readOrchestratorStateManifest(filePath, {
    readFileFn: async (target, encoding) => {
      calls.push(["readFile", target, encoding]);
      return writtenText;
    }
  });

  assert.deepEqual(readBack, snapshot);
});
