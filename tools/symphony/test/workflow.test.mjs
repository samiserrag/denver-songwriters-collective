import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkflowMarkdown } from "../lib/workflow.mjs";

const yamlFrontMatter = `---
version: 1
max_concurrent_agents: 1
labels:
  ready: "symphony:ready"
  running: "symphony:running"
  humanReview: "symphony:human-review"
  blocked: "symphony:blocked"
  general: "symphony"
workspace:
  root: ".symphony/worktrees"
  logs: ".symphony/logs"
  state: ".symphony/state"
recovery:
  stale_running_minutes: 240
lock:
  stale_minutes: 240
codex:
  adapter: "codex-exec"
  fallback: "codex exec --json"
  execution_timeout_minutes: 30
  execution_timeout_kill_grace_seconds: 15
future_extension:
  keep: true
---`;

const promptBody = `# Symphony Workflow

## Purpose

Symphony lets Sami manage repo-agent work from GitHub Issues.

## Hard Safety Rules

- no auto-merge`;

const legacyConfig = `<!-- symphony-config
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
  "lock": {
    "stale_minutes": 240
  },
  "codex": {
    "adapter": "codex-exec",
    "fallback": "codex exec --json",
    "execution_timeout_minutes": 30,
    "execution_timeout_kill_grace_seconds": 15
  }
}
-->`;

function yamlWorkflow(overrides = "") {
  return `${yamlFrontMatter.replace("max_concurrent_agents: 1", `max_concurrent_agents: 1${overrides}`)}

${promptBody}`;
}

test("parseWorkflowMarkdown extracts YAML front matter and prompt_template", () => {
  const workflow = parseWorkflowMarkdown(yamlWorkflow());

  assert.equal(workflow.format, "yaml-front-matter");
  assert.equal(workflow.config.version, 1);
  assert.equal(workflow.config.max_concurrent_agents, 1);
  assert.equal(workflow.config.labels.ready, "symphony:ready");
  assert.equal(workflow.config.future_extension.keep, true);
  assert.equal(workflow.prompt_template, promptBody);
  assert.equal(workflow.markdown, workflow.prompt_template);
  assert.doesNotMatch(workflow.prompt_template, /^---/);
});

test("parseWorkflowMarkdown preserves legacy JSON comment prompt behavior", () => {
  const markdown = `# Workflow\n\n${legacyConfig}\n\n${promptBody}`;
  const workflow = parseWorkflowMarkdown(markdown);

  assert.equal(workflow.format, "legacy-json-comment");
  assert.equal(workflow.config.version, 1);
  assert.equal(workflow.config.codex.execution_timeout_minutes, 30);
  assert.equal(workflow.prompt_template, markdown);
  assert.equal(workflow.markdown, markdown);
  assert.deepEqual(workflow.warnings, [
    "legacy symphony-config JSON comment format is deprecated; use YAML front matter"
  ]);
});

test("YAML mode strips stray legacy config block from prompt body", () => {
  const workflow = parseWorkflowMarkdown(`${yamlFrontMatter}

${legacyConfig}

${promptBody}`);

  assert.equal(workflow.format, "yaml-front-matter");
  assert.equal(workflow.prompt_template, promptBody);
  assert.doesNotMatch(workflow.prompt_template, /symphony-config/);
});

test("YAML prompt_template preserves expected policy headings", () => {
  const workflow = parseWorkflowMarkdown(yamlWorkflow());

  assert.match(workflow.prompt_template, /^# Symphony Workflow/);
  assert.match(workflow.prompt_template, /## Purpose/);
  assert.match(workflow.prompt_template, /## Hard Safety Rules/);
});

test("YAML config round-trips Phase 2.H timeout keys", () => {
  const workflow = parseWorkflowMarkdown(yamlWorkflow());

  assert.equal(workflow.config.codex.execution_timeout_minutes, 30);
  assert.equal(workflow.config.codex.execution_timeout_kill_grace_seconds, 15);
});

test("parseWorkflowMarkdown rejects unsafe concurrency in YAML", () => {
  assert.throws(
    () => parseWorkflowMarkdown(yamlWorkflow().replace("max_concurrent_agents: 1", "max_concurrent_agents: 2")),
    /max_concurrent_agents/
  );
});

test("parseWorkflowMarkdown rejects unsafe stale recovery threshold in YAML", () => {
  assert.throws(
    () => parseWorkflowMarkdown(yamlWorkflow().replace("stale_running_minutes: 240", "stale_running_minutes: 0")),
    /stale_running_minutes/
  );
});

test("parseWorkflowMarkdown rejects unsafe lock stale threshold in YAML", () => {
  assert.throws(
    () => parseWorkflowMarkdown(yamlWorkflow().replace("stale_minutes: 240", "stale_minutes: 0")),
    /lock\.stale_minutes/
  );
});

test("parseWorkflowMarkdown rejects unsafe Codex execution timeout config in YAML", () => {
  assert.throws(
    () => parseWorkflowMarkdown(yamlWorkflow().replace("execution_timeout_minutes: 30", "execution_timeout_minutes: 0")),
    /codex\.execution_timeout_minutes/
  );
  assert.throws(
    () => parseWorkflowMarkdown(yamlWorkflow().replace(
      "execution_timeout_kill_grace_seconds: 15",
      "execution_timeout_kill_grace_seconds: -1"
    )),
    /codex\.execution_timeout_kill_grace_seconds/
  );
});

test("parseWorkflowMarkdown rejects invalid YAML front matter", () => {
  assert.throws(
    () => parseWorkflowMarkdown("---\nversion: [\n---\n# Workflow"),
    /workflow_parse_error: invalid YAML front matter/
  );
});

test("parseWorkflowMarkdown rejects YAML front matter that is not a map", () => {
  assert.throws(
    () => parseWorkflowMarkdown("---\n- one\n- two\n---\n# Workflow"),
    /workflow_front_matter_not_a_map/
  );
});

test("parseWorkflowMarkdown rejects files with no config format", () => {
  assert.throws(
    () => parseWorkflowMarkdown("# Workflow\n\nNo config."),
    /missing YAML front matter or symphony-config JSON block/
  );
});

test("legacy parser still validates JSON comment config", () => {
  assert.throws(
    () => parseWorkflowMarkdown(legacyConfig.replace('"max_concurrent_agents": 1', '"max_concurrent_agents": 2')),
    /max_concurrent_agents/
  );
  assert.throws(
    () => parseWorkflowMarkdown(legacyConfig.replace(
      '"execution_timeout_minutes": 30',
      '"execution_timeout_minutes": 0'
    )),
    /codex\.execution_timeout_minutes/
  );
});
