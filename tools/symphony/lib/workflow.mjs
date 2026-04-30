import { readFile } from "node:fs/promises";

const CONFIG_PATTERN = /<!--\s*symphony-config\s*([\s\S]*?)-->/m;

export function parseWorkflowMarkdown(markdown) {
  const match = markdown.match(CONFIG_PATTERN);
  if (!match) {
    throw new Error("missing symphony-config JSON block");
  }

  let config;
  try {
    config = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`invalid symphony-config JSON: ${error.message}`);
  }

  validateWorkflowConfig(config);
  return {
    markdown,
    config
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
  if (config.codex?.adapter !== "codex-exec") {
    throw new Error("Phase 1 supports only the codex-exec adapter");
  }
}
