import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkflowMarkdown } from "../lib/workflow.mjs";

const validConfig = `<!-- symphony-config
{
  "version": 1,
  "max_concurrent_agents": 1,
  "labels": {
    "ready": "symphony:ready",
    "running": "symphony:running",
    "humanReview": "symphony:human-review",
    "blocked": "symphony:blocked",
    "general": "symphony"
  },
  "workspace": {
    "root": ".symphony/worktrees",
    "logs": ".symphony/logs",
    "state": ".symphony/state"
  },
  "recovery": {
    "stale_running_minutes": 240
  },
  "codex": {
    "adapter": "codex-exec"
  }
}
-->`;

test("parseWorkflowMarkdown extracts and validates config", () => {
  const workflow = parseWorkflowMarkdown(`# Workflow\n\n${validConfig}`);
  assert.equal(workflow.config.version, 1);
  assert.equal(workflow.config.max_concurrent_agents, 1);
  assert.equal(workflow.config.labels.ready, "symphony:ready");
});

test("parseWorkflowMarkdown rejects unsafe concurrency", () => {
  assert.throws(
    () => parseWorkflowMarkdown(validConfig.replace('"max_concurrent_agents": 1', '"max_concurrent_agents": 2')),
    /max_concurrent_agents/
  );
});

test("parseWorkflowMarkdown rejects unsafe stale recovery threshold", () => {
  assert.throws(
    () => parseWorkflowMarkdown(validConfig.replace('"stale_running_minutes": 240', '"stale_running_minutes": 0')),
    /stale_running_minutes/
  );
});
