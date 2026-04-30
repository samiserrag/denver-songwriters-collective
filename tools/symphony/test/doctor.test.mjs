import assert from "node:assert/strict";
import test from "node:test";
import { summarizePorcelainStatus } from "../lib/doctor.mjs";

test("summarizePorcelainStatus reports a clean worktree as empty", () => {
  assert.equal(summarizePorcelainStatus(""), "");
});

test("summarizePorcelainStatus summarizes dirty paths without hiding count", () => {
  const summary = summarizePorcelainStatus(" M tools/symphony/lib/runner.mjs\n?? .symphony/logs/issue-1.jsonl\n");

  assert.match(summary, /^2 dirty path\(s\):/);
  assert.match(summary, /tools\/symphony\/lib\/runner\.mjs/);
  assert.match(summary, /\.symphony\/logs\/issue-1\.jsonl/);
});
