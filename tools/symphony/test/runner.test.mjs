import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveConfig } from "../lib/config.mjs";
import { mergeIssuesByNumber, planIssues, runOnce } from "../lib/runner.mjs";

const config = resolveConfig("/repo", {
  version: 1,
  max_concurrent_agents: 1,
  labels: {
    ready: "symphony:ready",
    running: "symphony:running",
    humanReview: "symphony:human-review",
    blocked: "symphony:blocked",
    general: "symphony"
  },
  workspace: {
    root: ".symphony/worktrees",
    logs: ".symphony/logs",
    state: ".symphony/state"
  },
  codex: {
    adapter: "codex-exec"
  }
});

test("planIssues plans only one eligible issue", () => {
  const result = planIssues({
    config,
    issues: [
      {
        number: 9,
        title: "Second ready",
        state: "open",
        labels: [{ name: "symphony:ready" }]
      },
      {
        number: 8,
        title: "First ready",
        state: "open",
        labels: [{ name: "symphony:ready" }]
      }
    ]
  });

  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].issue.number, 8);
  assert.match(result.plans[0].branchName, /^symphony\/issue-8-first-ready$/);
});

test("planIssues does not plan when concurrency is occupied", () => {
  const result = planIssues({
    config,
    issues: [
      {
        number: 1,
        title: "Running",
        state: "open",
        labels: [{ name: "symphony:running" }]
      },
      {
        number: 2,
        title: "Ready",
        state: "open",
        labels: [{ name: "symphony:ready" }]
      }
    ]
  });

  assert.equal(result.runningCount, 1);
  assert.equal(result.plans.length, 0);
  assert.match(result.reason, /already reached/);
});

test("mergeIssuesByNumber keeps ready and running issues visible to planning", () => {
  const issues = mergeIssuesByNumber(
    [
      {
        number: 2,
        title: "Ready",
        state: "open",
        labels: [{ name: "symphony:ready" }]
      }
    ],
    [
      {
        number: 1,
        title: "Running",
        state: "open",
        labels: [{ name: "symphony:running" }]
      }
    ]
  );

  const result = planIssues({ config, issues });

  assert.equal(result.runningCount, 1);
  assert.equal(result.plans.length, 0);
  assert.match(result.reason, /already reached/);
});

test("runOnce rejects execute with mock issues before reading workflow or GitHub auth", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "symphony-runner-"));
  const result = await runOnce({
    repoRoot,
    dryRun: false,
    execute: true,
    mockIssuesPath: "mock.json",
    env: {}
  });

  assert.equal(result.ok, false);
  assert.equal(result.mode, "execute");
  assert.match(result.reason, /mock mode is dry-run only/);
});
