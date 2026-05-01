import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { redactSecrets, writeRunManifest } from "../lib/manifest.mjs";

test("redactSecrets removes token-like keys and values", () => {
  const redacted = redactSecrets({
    token: "github_pat_1234567890SECRET",
    nested: {
      value: "prefix sk-abcdefghijklmnopqrstuvwxyz suffix"
    }
  });

  assert.equal(redacted.token, "[redacted]");
  assert.equal(redacted.nested.value, "prefix [redacted] suffix");
});

test("writeRunManifest writes redacted structured JSON", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "symphony-manifest-"));
  const manifestPath = path.join(root, "manifest.json");
  await writeRunManifest({
    context: {
      manifestPath,
      manifest: {
        runId: "run-1",
        command: "once",
        mode: "dry-run",
        startedAt: "2026-04-30T00:00:00.000Z",
        outcome: {}
      }
    },
    updates: {
      outcome: {
        ok: true,
        reason: "token github_pat_1234567890SECRET should not leak"
      }
    },
    now: new Date("2026-04-30T00:01:00.000Z")
  });

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.outcome.ok, true);
  assert.equal(manifest.completedAt, "2026-04-30T00:01:00.000Z");
  assert.doesNotMatch(JSON.stringify(manifest), /github_pat_/);
});
