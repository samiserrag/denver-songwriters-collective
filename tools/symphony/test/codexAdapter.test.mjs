import assert from "node:assert/strict";
import test from "node:test";
import { buildCodexPrompt, formatIssueComments } from "../lib/codexAdapter.mjs";

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
