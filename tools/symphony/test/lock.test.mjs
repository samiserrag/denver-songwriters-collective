import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { acquireRunnerLock, RunnerLockError } from "../lib/lock.mjs";

test("acquireRunnerLock refuses an existing lock and reports stale state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "symphony-lock-"));
  const lockPath = path.join(root, "runner.lock");
  await writeFile(lockPath, JSON.stringify({
    runId: "old-run",
    command: "once",
    mode: "execute",
    pid: 123,
    createdAt: "2026-04-30T00:00:00.000Z"
  }), "utf8");

  await assert.rejects(
    () => acquireRunnerLock({
      lockPath,
      command: "once",
      mode: "execute",
      runId: "new-run",
      staleMs: 60 * 60 * 1000,
      now: new Date("2026-04-30T02:00:00.000Z")
    }),
    (error) => {
      assert.equal(error instanceof RunnerLockError, true);
      assert.equal(error.detail.stale, true);
      assert.equal(error.detail.runId, "old-run");
      return true;
    }
  );
});

test("acquireRunnerLock releases only its own lock", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "symphony-lock-"));
  const lockPath = path.join(root, "runner.lock");
  const lock = await acquireRunnerLock({
    lockPath,
    command: "once",
    mode: "dry-run",
    runId: "run-1",
    staleMs: 60 * 60 * 1000,
    now: new Date("2026-04-30T02:00:00.000Z")
  });

  await lock.release();
  const next = await acquireRunnerLock({
    lockPath,
    command: "once",
    mode: "dry-run",
    runId: "run-2",
    staleMs: 60 * 60 * 1000,
    now: new Date("2026-04-30T02:00:01.000Z")
  });
  await next.release();
});
