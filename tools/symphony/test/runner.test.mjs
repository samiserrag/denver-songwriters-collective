import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveConfig } from "../lib/config.mjs";
import { mergeIssuesByNumber, planIssues, recoverStaleRunningIssues, runDaemon, runOnce } from "../lib/runner.mjs";

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

function approvedBody(writeSet = "docs/runbooks/symphony.md") {
  return [
    "## Approved write set",
    `- ${writeSet}`,
    "",
    "## Acceptance criteria",
    "- The requested change is complete.",
    "- Tests pass."
  ].join("\n");
}

async function makeRepoRoot() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "symphony-runner-"));
  await writeFile(path.join(repoRoot, "WORKFLOW.md"), await readFile("WORKFLOW.md", "utf8"), "utf8");
  return repoRoot;
}

function cleanGitSnapshot() {
  return {
    head: "control-head",
    originMain: "origin-main",
    clean: true,
    dirtyFiles: [],
    statusError: ""
  };
}

function makeExecuteClient({
  issueBody = [
    approvedBody("tools/symphony/**"),
    "",
    "Explicitly approved high-risk scope: tools/symphony self-edit. Required to test lock-release path."
  ].join("\n"),
  comments = [],
  calls = []
} = {}) {
  const issue = {
    number: 41,
    title: "Ready execute",
    state: "open",
    body: issueBody,
    labels: [{ name: "symphony:ready" }]
  };
  return {
    calls,
    async listIssuesByLabel(_repo, label) {
      return label === "symphony:ready" ? [issue] : [];
    },
    async getLabel() {
      return { ok: true };
    },
    async listComments() {
      return { ok: true, data: comments };
    },
    async addLabels(_repo, issueNumber, labels) {
      calls.push(["addLabels", issueNumber, labels]);
      return { ok: true };
    },
    async removeLabel(_repo, issueNumber, label) {
      calls.push(["removeLabel", issueNumber, label]);
      return { ok: true };
    },
    async createComment(_repo, issueNumber, body) {
      calls.push(["createComment", issueNumber, body]);
      return { ok: true, data: { id: 100, body } };
    },
    async updateComment(_repo, commentId, body) {
      calls.push(["updateComment", commentId, body]);
      return { ok: true, data: { id: commentId, body } };
    },
    async deleteComment(_repo, commentId) {
      calls.push(["deleteComment", commentId]);
      return { ok: true };
    }
  };
}

function mutatingCalls(calls) {
  return calls.filter(([name]) => (
    name === "addLabels" ||
    name === "removeLabel" ||
    name === "createComment" ||
    name === "updateComment" ||
    name === "deleteComment"
  ));
}

test("planIssues plans only one eligible issue", () => {
  const result = planIssues({
    config,
    issues: [
      {
        number: 9,
        title: "Second ready",
        state: "open",
        body: approvedBody(),
        labels: [{ name: "symphony:ready" }]
      },
      {
        number: 8,
        title: "First ready",
        state: "open",
        body: approvedBody(),
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
        body: approvedBody(),
        labels: [{ name: "symphony:running" }]
      },
      {
        number: 2,
        title: "Ready",
        state: "open",
        body: approvedBody(),
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
        body: approvedBody(),
        labels: [{ name: "symphony:ready" }]
      }
    ],
    [
      {
        number: 1,
        title: "Running",
        state: "open",
        body: approvedBody(),
        labels: [{ name: "symphony:running" }]
      }
    ]
  );

  const result = planIssues({ config, issues });

  assert.equal(result.runningCount, 1);
  assert.equal(result.plans.length, 0);
  assert.match(result.reason, /already reached/);
});

test("planIssues reports ineligible ready issue reasons", () => {
  const result = planIssues({
    config,
    issues: [
      {
        number: 4,
        title: "No criteria",
        state: "open",
        body: "Missing required sections.",
        labels: [{ name: "symphony:ready" }]
      }
    ]
  });

  assert.equal(result.plans.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.deepEqual(result.skipped[0].reasons, ["missing approved write set", "missing acceptance criteria"]);
});

test("runOnce dry-run writes a manifest with planned and skipped issue reasons", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "symphony-fixture-"));
  const fixturePath = path.join(fixtureRoot, "issues.json");
  await writeFile(fixturePath, JSON.stringify([
    {
      number: 1,
      title: "Ready",
      state: "open",
      body: approvedBody(),
      labels: [{ name: "symphony:ready" }]
    },
    {
      number: 2,
      title: "Missing metadata",
      state: "open",
      body: "No required sections.",
      labels: [{ name: "symphony:ready" }]
    }
  ]), "utf8");

  const result = await runOnce({
    repoRoot: process.cwd(),
    dryRun: true,
    execute: false,
    mockIssuesPath: fixturePath,
    env: {},
    skipLock: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.plans.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reasons.join("\n"), /missing approved write set/);
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  assert.equal(manifest.command, "once");
  assert.equal(manifest.mode, "dry-run");
  assert.equal(manifest.plannedIssues[0].number, 1);
  assert.equal(manifest.skippedIssues[0].number, 2);
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

test("runOnce execute fails closed without mutation when preflight fails", async () => {
  const repoRoot = await makeRepoRoot();
  const calls = [];
  const client = makeExecuteClient({ calls });
  const result = await runOnce({
    repoRoot,
    dryRun: false,
    execute: true,
    env: { SYMPHONY_EXECUTION_APPROVED: "1" },
    client,
    repo: "owner/repo",
    tokenInfo: { token: "test-token" },
    gitSnapshot: {
      ...cleanGitSnapshot(),
      clean: false
    },
    skipLock: true
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /execute preflight failed/);
  assert.deepEqual(mutatingCalls(calls), []);
});

test("runOnce execute writes manifest before mutation and fails closed if it cannot", async () => {
  const repoRoot = await makeRepoRoot();
  const calls = [];
  const client = makeExecuteClient({ calls });
  const result = await runOnce({
    repoRoot,
    dryRun: false,
    execute: true,
    env: { SYMPHONY_EXECUTION_APPROVED: "1" },
    client,
    repo: "owner/repo",
    tokenInfo: { token: "test-token" },
    gitSnapshot: cleanGitSnapshot(),
    writeManifest: async () => {
      throw new Error("read-only manifest root");
    },
    createWorktreeFn: async () => {
      throw new Error("worktree should not be created");
    },
    runCodexAdapter: async () => {
      throw new Error("codex should not run");
    },
    skipLock: true
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /manifest write failed: read-only manifest root/);
  assert.deepEqual(mutatingCalls(calls), []);
});

test("runOnce releases runner lock when execution fails", async () => {
  const repoRoot = await makeRepoRoot();
  const calls = [];
  const client = makeExecuteClient({ calls });
  const result = await runOnce({
    repoRoot,
    dryRun: false,
    execute: true,
    env: { SYMPHONY_EXECUTION_APPROVED: "1" },
    client,
    repo: "owner/repo",
    tokenInfo: { token: "test-token" },
    gitSnapshot: cleanGitSnapshot(),
    createWorktreeFn: async () => {
      throw new Error("worktree failed");
    },
    runCodexAdapter: async () => {
      throw new Error("codex should not run");
    }
  });

  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result.plans), /worktree failed/);
  await assert.rejects(() => access(path.join(repoRoot, ".symphony/state/runner.lock")), /ENOENT/);
});

test("runDaemon handles SIGINT after active cycle and releases runner lock", async () => {
  const repoRoot = await makeRepoRoot();
  const processLike = new EventEmitter();
  let cycleCount = 0;
  const result = await runDaemon({
    repoRoot,
    dryRun: false,
    intervalSeconds: 300,
    env: {
      SYMPHONY_ENABLE_DAEMON: "1",
      SYMPHONY_EXECUTION_APPROVED: "1"
    },
    processLike,
    runOnceFn: async () => {
      cycleCount += 1;
      processLike.emit("SIGINT");
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { ok: true };
    },
    sleepFn: async () => {
      throw new Error("daemon should not sleep after SIGINT");
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.iterations, 1);
  assert.equal(cycleCount, 1);
  assert.equal(result.reason, "daemon stopped by SIGINT");
  assert.equal(processLike.listenerCount("SIGINT"), 0);
  assert.equal(processLike.listenerCount("SIGTERM"), 0);
  await assert.rejects(() => access(path.join(repoRoot, ".symphony/state/runner.lock")), /ENOENT/);
});

test("runDaemon stops during interval sleep and releases runner lock", async () => {
  const repoRoot = await makeRepoRoot();
  const controller = new AbortController();
  let cycleCount = 0;
  const result = await runDaemon({
    repoRoot,
    dryRun: true,
    intervalSeconds: 300,
    env: {
      SYMPHONY_ENABLE_DAEMON: "1"
    },
    signal: controller.signal,
    runOnceFn: async () => {
      cycleCount += 1;
      return { ok: true };
    },
    sleepFn: async (_milliseconds, signal) => {
      assert.equal(signal.aborted, false);
      controller.abort("test stop");
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.iterations, 1);
  assert.equal(cycleCount, 1);
  assert.equal(result.reason, "daemon stopped by test stop");
  await assert.rejects(() => access(path.join(repoRoot, ".symphony/state/runner.lock")), /ENOENT/);
});

test("runDaemon removes signal handlers when lock acquisition fails", async () => {
  const repoRoot = await makeRepoRoot();
  const processLike = new EventEmitter();
  await mkdir(path.join(repoRoot, ".symphony/state"), { recursive: true });
  await writeFile(
    path.join(repoRoot, ".symphony/state/runner.lock"),
    JSON.stringify({
      runId: "existing",
      command: "daemon",
      mode: "execute",
      pid: 12345,
      createdAt: new Date().toISOString(),
      path: path.join(repoRoot, ".symphony/state/runner.lock")
    }),
    "utf8"
  );

  const result = await runDaemon({
    repoRoot,
    dryRun: false,
    env: {
      SYMPHONY_ENABLE_DAEMON: "1",
      SYMPHONY_EXECUTION_APPROVED: "1"
    },
    processLike,
    runOnceFn: async () => {
      throw new Error("runOnce should not start when daemon lock is held");
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /lock is already held/);
  assert.equal(processLike.listenerCount("SIGINT"), 0);
  assert.equal(processLike.listenerCount("SIGTERM"), 0);
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
    repo: "owner/repo",
    skipLock: true
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

test("recoverStaleRunningIssues removes duplicate workpad comments on update", async () => {
  const calls = [];
  const client = {
    async listIssuesByLabel(_repo, label) {
      assert.equal(label, "symphony:running");
      return [
        {
          number: 34,
          title: "Duplicate workpads",
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
            id: 101,
            body: "<!-- symphony-workpad -->\n- Last Updated: 2026-04-30T00:00:00.000Z",
            updated_at: "2026-04-30T00:00:00.000Z"
          },
          {
            id: 102,
            body: "<!-- symphony-workpad -->\n- Last Updated: 2026-04-30T00:10:00.000Z",
            updated_at: "2026-04-30T00:10:00.000Z"
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
    },
    async deleteComment(_repo, commentId) {
      calls.push(["deleteComment", commentId]);
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
    repo: "owner/repo",
    skipLock: true
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.find((call) => call[0] === "updateComment").slice(0, 2), ["updateComment", 101]);
  assert.deepEqual(calls.find((call) => call[0] === "deleteComment"), ["deleteComment", 102]);
});

test("recoverStaleRunningIssues execute proves manifest writable before mutation", async () => {
  const calls = [];
  const client = {
    async listIssuesByLabel(_repo, label) {
      assert.equal(label, "symphony:running");
      return [
        {
          number: 35,
          title: "Stale runner without manifest",
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
            id: 103,
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
    repo: "owner/repo",
    skipLock: true,
    writeManifest: async () => {
      throw new Error("read-only manifest root");
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /manifest write failed: read-only manifest root/);
  assert.deepEqual(mutatingCalls(calls), []);
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
    repo: "owner/repo",
    skipLock: true
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "stale recovery requires SYMPHONY_EXECUTION_APPROVED=1");
});
