import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveConfig } from "../lib/config.mjs";
import { mergeIssuesByNumber, planIssues, recoverStaleRunningIssues, runOnce } from "../lib/runner.mjs";

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

test("recoverStaleRunningIssues moves stale running issues to blocked when executed", async () => {
  const calls = [];
  const client = {
    async listIssuesByLabel(_repo, label) {
      assert.equal(label, "symphony:running");
      return [
        {
          number: 33,
          title: "Stale runner",
          state: "open",
          body: "Runner died.",
          created_at: "2026-04-30T00:00:00.000Z",
          updated_at: "2026-04-30T00:00:00.000Z",
          labels: [{ name: "symphony:running" }]
        }
      ];
    },
    async listComments() {
      return {
        ok: true,
        data: [
          {
            id: 77,
            body: "<!-- symphony-workpad -->\n- Last Updated: 2026-04-30T00:00:00.000Z",
            updated_at: "2026-04-30T00:00:00.000Z"
          }
        ]
      };
    },
    async addLabels(_repo, issueNumber, labels) {
      calls.push(["addLabels", issueNumber, labels]);
      return { ok: true };
    },
    async removeLabel(_repo, issueNumber, label) {
      calls.push(["removeLabel", issueNumber, label]);
      return { ok: true };
    },
    async updateComment(_repo, commentId, body) {
      calls.push(["updateComment", commentId, body]);
      return { ok: true };
    }
  };

  const result = await recoverStaleRunningIssues({
    repoRoot: process.cwd(),
    dryRun: false,
    execute: true,
    env: { SYMPHONY_EXECUTION_APPROVED: "1" },
    now: new Date("2026-04-30T06:00:00.000Z"),
    client,
    repo: "owner/repo"
  });

  assert.equal(result.ok, true);
  assert.equal(result.stale.length, 1);
  assert.equal(result.stale[0].finalState, "blocked");
  assert.deepEqual(calls[0], ["addLabels", 33, ["symphony", "symphony:blocked"]]);
  assert.deepEqual(calls[1], ["removeLabel", 33, "symphony:ready"]);
  assert.deepEqual(calls[2], ["removeLabel", 33, "symphony:running"]);
  assert.deepEqual(calls[3], ["removeLabel", 33, "symphony:human-review"]);
  assert.equal(calls[4][0], "updateComment");
  assert.match(calls[4][2], /stale running recovery/);
});

test("recoverStaleRunningIssues execute mode requires approval gate before GitHub access", async () => {
  const result = await recoverStaleRunningIssues({
    repoRoot: process.cwd(),
    dryRun: false,
    execute: true,
    env: {},
    client: {
      async listIssuesByLabel() {
        throw new Error("should not be called");
      }
    },
    repo: "owner/repo"
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "stale recovery requires SYMPHONY_EXECUTION_APPROVED=1");
});
