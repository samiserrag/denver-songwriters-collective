import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";

export class RunnerLockError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "RunnerLockError";
    this.detail = detail;
  }
}

async function readExistingLock(lockPath, now, staleMs) {
  try {
    const lock = JSON.parse(await readFile(lockPath, "utf8"));
    const createdAt = new Date(lock.createdAt);
    const ageMs = Number.isNaN(createdAt.valueOf()) ? null : now.valueOf() - createdAt.valueOf();
    return {
      ...lock,
      path: lockPath,
      ageMs,
      stale: ageMs !== null && ageMs >= staleMs
    };
  } catch {
    return {
      path: lockPath,
      ageMs: null,
      stale: false
    };
  }
}

export async function acquireRunnerLock({ lockPath, command, mode, runId, staleMs, now = new Date() }) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  const lock = {
    runId,
    command,
    mode,
    pid: process.pid,
    createdAt: now.toISOString(),
    path: lockPath
  };

  let handle;
  try {
    handle = await open(lockPath, "wx");
    await handle.writeFile(`${JSON.stringify(lock, null, 2)}\n`, "utf8");
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }
    const existing = await readExistingLock(lockPath, now, staleMs);
    const staleDetail = existing.stale ? " stale" : "";
    throw new RunnerLockError(`Symphony runner lock is already held${staleDetail}: ${lockPath}`, existing);
  } finally {
    await handle?.close();
  }

  return {
    ...lock,
    async release() {
      try {
        const current = JSON.parse(await readFile(lockPath, "utf8"));
        if (current.runId === runId) {
          await rm(lockPath, { force: true });
        }
      } catch {
        // Lock was already removed or is unreadable. Nothing else to release.
      }
    }
  };
}
