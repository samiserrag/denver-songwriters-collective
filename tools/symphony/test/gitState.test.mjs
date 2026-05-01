import assert from "node:assert/strict";
import test from "node:test";
import { parsePorcelainDirtyFiles } from "../lib/gitState.mjs";

test("parsePorcelainDirtyFiles preserves first path character", () => {
  assert.deepEqual(parsePorcelainDirtyFiles(" M WORKFLOW.md\n?? tools/symphony/lib/gitState.mjs\n"), [
    "WORKFLOW.md",
    "tools/symphony/lib/gitState.mjs"
  ]);
});
