import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LABELS } from "../lib/config.mjs";
import {
  countRunningIssues,
  filterEligibleIssues,
  isEligibleIssue,
  labelTransitionFor
} from "../lib/issues.mjs";

test("eligible issues require explicit ready label and no terminal runner state", () => {
  const ready = {
    number: 1,
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }]
  };
  const running = {
    number: 2,
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }, { name: DEFAULT_LABELS.running }]
  };
  const blocked = {
    number: 3,
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }, { name: DEFAULT_LABELS.blocked }]
  };
  const pr = {
    number: 4,
    state: "open",
    pull_request: {},
    labels: [{ name: DEFAULT_LABELS.ready }]
  };

  assert.equal(isEligibleIssue(ready, DEFAULT_LABELS), true);
  assert.equal(isEligibleIssue(running, DEFAULT_LABELS), false);
  assert.equal(isEligibleIssue(blocked, DEFAULT_LABELS), false);
  assert.equal(isEligibleIssue(pr, DEFAULT_LABELS), false);
  assert.deepEqual(filterEligibleIssues([running, blocked, pr, ready], DEFAULT_LABELS), [ready]);
});

test("label transitions are deterministic", () => {
  assert.deepEqual(labelTransitionFor("claim", DEFAULT_LABELS), {
    add: [DEFAULT_LABELS.general, DEFAULT_LABELS.running],
    remove: [DEFAULT_LABELS.ready, DEFAULT_LABELS.blocked, DEFAULT_LABELS.humanReview]
  });
  assert.deepEqual(labelTransitionFor("human-review", DEFAULT_LABELS), {
    add: [DEFAULT_LABELS.general, DEFAULT_LABELS.humanReview],
    remove: [DEFAULT_LABELS.ready, DEFAULT_LABELS.running, DEFAULT_LABELS.blocked]
  });
});

test("running issue count respects current label state", () => {
  const issues = [
    { state: "open", labels: [{ name: DEFAULT_LABELS.running }] },
    { state: "closed", labels: [{ name: DEFAULT_LABELS.running }] },
    { state: "open", labels: [{ name: DEFAULT_LABELS.ready }] }
  ];
  assert.equal(countRunningIssues(issues, DEFAULT_LABELS), 1);
});
