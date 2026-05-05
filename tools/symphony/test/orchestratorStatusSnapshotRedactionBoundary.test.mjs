import assert from "node:assert/strict";
import test from "node:test";
import {
  ORCHESTRATOR_STATE_MANIFEST_KIND,
  ORCHESTRATOR_STATE_MANIFEST_VERSION,
  validateOrchestratorStateSnapshot
} from "../lib/orchestratorStateManifest.mjs";
import { buildOrchestratorStatusSnapshot } from "../lib/orchestratorStatusSnapshot.mjs";

const NOW = "2026-05-05T00:00:00.000Z";

function snapshotWithSecrets() {
  return validateOrchestratorStateSnapshot({
    manifest_kind: ORCHESTRATOR_STATE_MANIFEST_KIND,
    orchestrator_state_version: ORCHESTRATOR_STATE_MANIFEST_VERSION,
    generated_at: NOW,
    repo: {
      head: "ghp_abcdefghijklmnopqrstuvwxyz123456",
      origin_main: "safe-sha",
      clean: true
    },
    lock: {
      held: false,
      path: "postgresql://user:secretpass@example.com/db"
    },
    issues: {},
    retry_attempts: {},
    state_transitions: [],
    codex_totals: {
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      seconds_running: 1
    },
    codex_rate_limits: { requests_remaining: 1 },
    last_outcome: null,
    codex_runs: {
      "1": {
        issue_number: 1,
        session_id: "s1",
        token_usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
          raw_total_token_usage: {
            provider_payload: "Bearer this-is-a-secret-token-value"
          }
        }
      }
    }
  });
}

test("status snapshot redacts secret-like values from output surfaces", () => {
  const status = buildOrchestratorStatusSnapshot(snapshotWithSecrets(), { now: NOW });
  assert.equal(status.ok, true);
  const serialized = JSON.stringify(status);
  assert.doesNotMatch(serialized, /ghp_[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(serialized, /Bearer\s+[A-Za-z0-9._~+/-]+=*/i);
  assert.doesNotMatch(serialized, /(postgres|postgresql):\/\/[^/\s:@]+:[^@\s]+@/i);
});
