import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCodexPrompt, formatIssueComments, runCodexExecAdapter } from "../lib/codexAdapter.mjs";

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.killSignals = [];
  }

  kill(signal) {
    this.killSignals.push(signal);
    return true;
  }
}

function makeTimerHarness() {
  const timers = [];
  return {
    timers,
    setTimeoutFn(fn, milliseconds) {
      const timer = { fn, milliseconds, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn(timer) {
      timer.cleared = true;
    }
  };
}

test("formatIssueComments includes user comments and excludes workpad", () => {
  const formatted = formatIssueComments([
    {
      user: { login: "sami" },
      created_at: "2026-04-30T06:00:00.000Z",
      body: "Please keep this docs-only."
    },
    {
      user: { login: "runner" },
      created_at: "2026-04-30T06:01:00.000Z",
      body: "<!-- symphony-workpad -->\ninternal state"
    }
  ]);

  assert.match(formatted, /Please keep this docs-only/);
  assert.doesNotMatch(formatted, /internal state/);
});

test("buildCodexPrompt includes issue comments", () => {
  const prompt = buildCodexPrompt({
    workflowText: "# Workflow",
    issue: {
      number: 7,
      title: "Prompt context",
      body: "Main issue body.",
      approvedWriteSet: ["tools/symphony/**"],
      acceptanceCriteria: ["Tests pass"],
      comments: [
        {
          user: { login: "coordinator" },
          created_at: "2026-04-30T06:00:00.000Z",
          body: "Approved write set is tools/symphony/**."
        }
      ]
    }
  });

  assert.match(prompt, /GitHub issue comments:/);
  assert.match(prompt, /Approved write set:\n- tools\/symphony\/\*\*/);
  assert.match(prompt, /Acceptance criteria \/ done condition:\n- Tests pass/);
  assert.match(prompt, /Stop immediately if the issue's approved write set is missing/);
  assert.match(prompt, /Approved write set is tools\/symphony\/\*\*\./);
});

test("runCodexExecAdapter terminates timed-out child and writes line-safe timeout marker", async () => {
  const child = new FakeChild();
  const timerHarness = makeTimerHarness();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "symphony-codex-adapter-"));
  const logPath = path.join(tempRoot, "issue-1.jsonl");
  const times = [
    new Date("2026-05-01T00:00:00.000Z"),
    new Date("2026-05-01T00:30:00.000Z")
  ];
  let resolveSpawned;
  const spawned = new Promise((resolve) => {
    resolveSpawned = resolve;
  });

  const resultPromise = runCodexExecAdapter({
    codexBin: "codex",
    worktreePath: tempRoot,
    prompt: "do work",
    logPath,
    executionTimeoutMs: 30 * 60 * 1000,
    executionTimeoutKillGraceMs: 15 * 1000,
    spawnFn: () => {
      resolveSpawned();
      return child;
    },
    setTimeoutFn: timerHarness.setTimeoutFn,
    clearTimeoutFn: timerHarness.clearTimeoutFn,
    nowFn: () => times.shift() || new Date("2026-05-01T00:30:15.000Z")
  });

  await spawned;
  child.stdout.emit("data", "partial stdout without newline");
  child.stderr.emit("data", "stderr chunk");
  assert.equal(timerHarness.timers[0].milliseconds, 30 * 60 * 1000);
  timerHarness.timers[0].fn();
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assert.equal(timerHarness.timers[1].milliseconds, 15 * 1000);
  timerHarness.timers[1].fn();
  assert.deepEqual(child.killSignals, ["SIGTERM", "SIGKILL"]);
  child.emit("close", null, "SIGKILL");

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "outer_timeout");
  assert.equal(result.timedOut, true);
  assert.equal(result.timeout.forcedKill, true);
  assert.equal(result.timeout.exitSignal, "SIGKILL");

  const log = await readFile(logPath, "utf8");
  assert.match(log, /partial stdout without newlinestderr chunk\n\{"event":"symphony_outer_timeout"/);
});

test("runCodexExecAdapter preserves successful output and clears timeout timer", async () => {
  const child = new FakeChild();
  const timerHarness = makeTimerHarness();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "symphony-codex-adapter-"));
  const logPath = path.join(tempRoot, "issue-2.jsonl");
  let resolveSpawned;
  const spawned = new Promise((resolve) => {
    resolveSpawned = resolve;
  });

  const resultPromise = runCodexExecAdapter({
    codexBin: "codex",
    worktreePath: tempRoot,
    prompt: "do work",
    logPath,
    executionTimeoutMs: 30 * 60 * 1000,
    executionTimeoutKillGraceMs: 15 * 1000,
    spawnFn: () => {
      resolveSpawned();
      return child;
    },
    setTimeoutFn: timerHarness.setTimeoutFn,
    clearTimeoutFn: timerHarness.clearTimeoutFn,
    nowFn: () => new Date("2026-05-01T00:00:00.000Z")
  });

  await spawned;
  child.stdout.emit("data", "stdout\n");
  child.stderr.emit("data", "stderr\n");
  child.emit("close", 0, null);

  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.equal(result.timedOut, false);
  assert.deepEqual(child.killSignals, []);
  assert.equal(timerHarness.timers[0].cleared, true);
  assert.equal(await readFile(logPath, "utf8"), "stdout\nstderr\n");
});
