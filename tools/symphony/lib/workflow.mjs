import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";

const CONFIG_PATTERN = /<!--\s*symphony-config\s*([\s\S]*?)-->/m;
const CONFIG_BLOCK_PATTERN = /<!--\s*symphony-config\s*[\s\S]*?-->\s*/gm;

function assertPositiveNumber(value, name) {
  if (value === undefined) {
    return;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

export function parseWorkflowMarkdown(markdown) {
  if (markdown.startsWith("---")) {
    return parseYamlFrontMatterWorkflow(markdown);
  }

  return parseLegacyJsonCommentWorkflow(markdown);
}

function parseYamlFrontMatterWorkflow(markdown) {
  const split = splitYamlFrontMatter(markdown);
  const config = parseYamlConfig(split.frontMatter);
  validateWorkflowConfig(config);
  const promptTemplate = stripLegacyConfigBlocks(split.body).trim();

  return {
    config,
    prompt_template: promptTemplate,
    markdown: promptTemplate,
    format: "yaml-front-matter",
    warnings: []
  };
}

function splitYamlFrontMatter(markdown) {
  const lines = markdown.split(/\r?\n/);
  if (lines[0].trim() !== "---") {
    throw new Error("workflow_parse_error: YAML front matter must start with ---");
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex === -1) {
    throw new Error("workflow_parse_error: missing closing YAML front matter delimiter");
  }

  return {
    frontMatter: lines.slice(1, closingIndex).join("\n"),
    body: lines.slice(closingIndex + 1).join("\n")
  };
}

function parseYamlConfig(frontMatter) {
  let document;
  try {
    document = parseDocument(frontMatter);
  } catch (error) {
    throw new Error(`workflow_parse_error: invalid YAML front matter: ${error.message}`);
  }

  if (document.errors.length > 0) {
    throw new Error(`workflow_parse_error: invalid YAML front matter: ${document.errors[0].message}`);
  }

  const config = document.toJSON();
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("workflow_front_matter_not_a_map: YAML front matter must be a map");
  }
  return config;
}

function stripLegacyConfigBlocks(markdown) {
  return markdown.replace(CONFIG_BLOCK_PATTERN, "");
}

function parseLegacyJsonCommentWorkflow(markdown) {
  const match = markdown.match(CONFIG_PATTERN);
  if (!match) {
    throw new Error("missing YAML front matter or symphony-config JSON block");
  }

  let config;
  try {
    config = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`invalid symphony-config JSON: ${error.message}`);
  }

  validateWorkflowConfig(config);
  return {
    config,
    prompt_template: markdown,
    markdown,
    format: "legacy-json-comment",
    warnings: ["legacy symphony-config JSON comment format is deprecated; use YAML front matter"]
  };
}

export async function loadWorkflow(filePath) {
  return parseWorkflowMarkdown(await readFile(filePath, "utf8"));
}

export function validateWorkflowConfig(config) {
  if (config.version !== 1) {
    throw new Error("version must be 1");
  }
  if (config.max_concurrent_agents !== 1) {
    throw new Error("max_concurrent_agents must be 1 for Phase 1");
  }
  for (const key of ["ready", "running", "humanReview", "blocked", "general"]) {
    if (!config.labels?.[key]) {
      throw new Error(`labels.${key} is required`);
    }
  }
  if (!config.workspace?.root || !config.workspace?.logs || !config.workspace?.state) {
    throw new Error("workspace.root, workspace.logs, and workspace.state are required");
  }
  if (
    config.recovery?.stale_running_minutes !== undefined &&
    (!Number.isInteger(config.recovery.stale_running_minutes) || config.recovery.stale_running_minutes < 1)
  ) {
    throw new Error("recovery.stale_running_minutes must be a positive integer");
  }
  if (
    config.lock?.stale_minutes !== undefined &&
    (!Number.isInteger(config.lock.stale_minutes) || config.lock.stale_minutes < 1)
  ) {
    throw new Error("lock.stale_minutes must be a positive integer");
  }
  if (config.codex?.adapter !== "codex-exec") {
    throw new Error("Phase 1 supports only the codex-exec adapter");
  }
  assertPositiveNumber(config.codex?.execution_timeout_minutes, "codex.execution_timeout_minutes");
  assertPositiveNumber(
    config.codex?.execution_timeout_kill_grace_seconds,
    "codex.execution_timeout_kill_grace_seconds"
  );
}
