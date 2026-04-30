import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LABELS } from "../lib/config.mjs";
import {
  assessRunningIssue,
  buildWorkpadBody,
  countRunningIssues,
  filterEligibleIssues,
  isEligibleIssue,
  labelTransitionFor,
  parseWorkpadUpdatedAt
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

test("assessRunningIssue marks old running workpad state as stale", () => {
  const result = assessRunningIssue({
    issue: {
      number: 9,
      title: "Stale",
      state: "open",
      updated_at: "2026-04-30T08:00:00.000Z",
      labels: [{ name: DEFAULT_LABELS.running }]
    },
    comments: [
      {
        body: "<!-- symphony-workpad -->\n- Last Updated: 2026-04-30T01:00:00.000Z",
        updated_at: "2026-04-30T01:00:00.000Z"
      }
    ],
    labels: DEFAULT_LABELS,
    now: new Date("2026-04-30T06:00:00.000Z"),
    staleMs: 4 * 60 * 60 * 1000
  });

  assert.equal(result.isStale, true);
  assert.equal(result.lastUpdatedAt, "2026-04-30T01:00:00.000Z");
  assert.equal(result.source, "workpad");
});

test("assessRunningIssue keeps recent running state active", () => {
  const result = assessRunningIssue({
    issue: {
      number: 10,
      title: "Active",
      state: "open",
      updated_at: "2026-04-30T05:30:00.000Z",
      labels: [{ name: DEFAULT_LABELS.running }]
    },
    comments: [],
    labels: DEFAULT_LABELS,
    now: new Date("2026-04-30T06:00:00.000Z"),
    staleMs: 4 * 60 * 60 * 1000
  });

  assert.equal(result.isStale, false);
  assert.equal(result.source, "issue");
});

test("buildWorkpadBody includes a parseable last-updated marker", () => {
  const body = buildWorkpadBody({
    state: "running",
    issue: { number: 11, title: "Workpad" },
    branchName: "symphony/issue-11-workpad",
    worktreePath: "/tmp/workpad",
    logPath: "/tmp/log.jsonl",
    manifestPath: "/tmp/manifest.json",
    command: "once",
    mode: "dry-run",
    nextAction: "Review the dry-run.",
    detail: "claimed"
  });

  assert.ok(parseWorkpadUpdatedAt(body) instanceof Date);
  assert.match(body, /Run Manifest: `\/tmp\/manifest\.json`/);
  assert.match(body, /Next Human Action: Review the dry-run\./);
});
