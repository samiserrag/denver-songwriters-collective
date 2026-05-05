import assert from "node:assert/strict";
import test from "node:test";
import { buildOperatorSummary } from "../lib/orchestratorOperatorSummary.mjs";

const SUCCESS_KEYS = [
  "attention",
  "blocked",
  "counts",
  "generated_at",
  "mode",
  "ok",
  "reason",
  "retry_due",
  "retrying",
  "transitions"
];

const FAILURE_KEYS = ["errors", "generated_at", "ok", "reason"];

function makeStatus() {
  return {
    ok: true,
    mode: "snapshot",
    generated_at: "2026-05-05T00:00:00.000Z",
    counts: { total: 3, running: 1, blocked: 1, retry_wait: 1 },
    blocked: [{ issue_number: 11, state: "blocked", reason: "needs_human", updated_at: "2026-05-05T00:00:00.000Z" }],
    retry_due: [{ issue_number: 12, state: "retry_wait", due: true, due_at: "2026-05-05T00:01:00.000Z" }],
    retrying: [{ issue_number: 12, state: "retry_wait", due: true }],
    running: [{ issue_number: 13, state: "running", updated_at: "2026-05-05T00:02:00.000Z" }],
    state_transitions: [
      { at: "2026-05-05T00:02:00.000Z", issue_number: 13, from: "claimed", to: "running", reason: "started" },
      { at: "2026-05-05T00:00:00.000Z", issue_number: 11, from: "running", to: "blocked", reason: "failure" }
    ]
  };
}

test("operator summary returns stable envelope and condensed attention lists", () => {
  const summary = buildOperatorSummary(makeStatus(), { recent_limit: 1 });
  assert.deepEqual(Object.keys(summary).sort(), SUCCESS_KEYS);
  assert.equal(summary.ok, true);
  assert.equal(summary.reason, null);
  assert.equal(summary.attention.blocked_count, 1);
  assert.equal(summary.attention.retry_due_count, 1);
  assert.equal(summary.attention.running_count, 1);
  assert.equal(summary.blocked.length, 1);
  assert.equal(summary.retry_due.length, 1);
  assert.equal(summary.retrying.length, 1);
  assert.equal(summary.transitions.length, 1);
  assert.deepEqual(Object.keys(summary.blocked[0]).sort(), ["due", "due_at", "issue_number", "reason", "state", "updated_at"]);
});

test("operator summary fails closed for malformed top-level input", () => {
  const summary = buildOperatorSummary(null);
  assert.deepEqual(Object.keys(summary).sort(), FAILURE_KEYS);
  assert.equal(summary.ok, false);
  assert.equal(summary.reason, "operator_summary_invalid_status");
  assert.deepEqual(summary.errors, [{ path: "status", reason: "malformed_status_snapshot" }]);
});

test("operator summary tolerates malformed optional sections without throwing", () => {
  const summary = buildOperatorSummary({ generated_at: "2026-05-05T00:00:00.000Z", blocked: {}, retry_due: "bad", retrying: null, running: ["x"] });
  assert.equal(summary.ok, true);
  assert.deepEqual(summary.blocked, []);
  assert.deepEqual(summary.retry_due, []);
  assert.deepEqual(summary.retrying, []);
  assert.equal(summary.attention.running_count, 1);
});
