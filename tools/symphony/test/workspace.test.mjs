import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { assertInsideRoot, branchNameForIssue, slugifyTitle, workspacePathForIssue } from "../lib/workspace.mjs";

test("slugifyTitle creates stable safe slugs", () => {
  assert.equal(slugifyTitle("../Add AI: edit route!!"), "add-ai-edit-route");
  assert.equal(slugifyTitle(""), "issue");
});

test("workspacePathForIssue stays under root", () => {
  const root = path.resolve("/tmp/symphony-root");
  const target = workspacePathForIssue(root, {
    number: 44,
    title: "../../Bad Path"
  });
  assert.ok(target.startsWith(root));
  assert.equal(path.basename(target), "issue-44-bad-path");
});

test("assertInsideRoot rejects path escapes", () => {
  assert.throws(() => assertInsideRoot("/tmp/root", "/tmp/elsewhere"), /escapes/);
});

test("branchNameForIssue is deterministic", () => {
  assert.equal(
    branchNameForIssue({ number: 12, title: "Ship Symphony Phase 1" }),
    "symphony/issue-12-ship-symphony-phase-1"
  );
});
