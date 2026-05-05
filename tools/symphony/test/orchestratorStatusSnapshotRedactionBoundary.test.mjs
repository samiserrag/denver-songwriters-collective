import assert from "node:assert/strict";
import test from "node:test";

import {
  ORCHESTRATOR_STATE_MANIFEST_KIND,
  ORCHESTRATOR_STATE_MANIFEST_VERSION,
  validateOrchestratorStateSnapshot
} from "../lib/orchestratorStateManifest.mjs";
import { buildOrchestratorStatusSnapshot } from "../lib/orchestratorStatusSnapshot.mjs";

const NOW = "2026-05-05T12:00:00.000Z";

function baseSnapshot(overrides = {}) {
  return validateOrchestratorStateSnapshot({
    manifest_kind: ORCHESTRATOR_STATE_MANIFEST_KIND,
    orchestrator_state_version: ORCHESTRATOR_STATE_MANIFEST_VERSION,
    generated_at: "2026-05-05T11:59:00.000Z",
    repo: {
      head: "main-ghp_abcdefghijklmnopqrstuvwxyz123456",
      origin_main: "origin-sha",
      clean: true
    },
    lock: {
      held: false,
      path: "postgresql://symphony:super-secret@db.internal/symphony"
    },
    issues: {},
    retry_attempts: {},
    state_transitions: [
      {
        issue_number: 11,
        from: "running",
        to: "blocked",
        at: "2026-05-05T11:59:30.000Z",
        reason: "Bearer top.secret.token.value"
      }
    ],
    codex_runs: [
      {
        issue_number: 11,
        token_usage: {
          raw_total_token_usage: {
            provider_payload: "Bearer sk-super-secret-provider-token-value"
          }
        }
      }
    ],
    codex_totals: {
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      seconds_running: 1
    },
    codex_rate_limits: {
      requests_remaining: 5
    },
    last_outcome: {
      action: "notify",
      metadata: {
        token: "github_pat_abcdefghijklmnopqrstuvwxyz123456"
      }
    },
    ...overrides
  });
}

test("status snapshot redacts secret-like strings in nested and top-level fields", () => {
  const status = buildOrchestratorStatusSnapshot(baseSnapshot(), { now: NOW });
  const serialized = JSON.stringify(status);

  assert.doesNotMatch(serialized, /ghp_[A-Za-z0-9_]{20,}/);
  assert.doesNotMatch(serialized, /postgresql:\/\/[^/\s:@]+:[^@\s]+@/);
  assert.doesNotMatch(serialized, /\bBearer\s+[A-Za-z0-9._~+/-]+=*/);
  assert.doesNotMatch(serialized, /github_pat_[A-Za-z0-9_]{20,}/);
  assert.match(serialized, /\[REDACTED\]/);
});
