import { constants as fsConstants } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveConfig, requiredLabelNames } from "./config.mjs";
import { detectRepositorySlug, GitHubClient, resolveGitHubToken, runCommand } from "./github.mjs";
import { loadWorkflow } from "./workflow.mjs";

function check(status, name, detail = "") {
  return { status, name, detail };
}

async function checkCommand(command, args) {
  const result = await runCommand(command, args);
  if (result.ok) {
    return check("pass", `${command} ${args.join(" ")}`, result.stdout.split("\n")[0] || "available");
  }
  return check("fail", `${command} ${args.join(" ")}`, result.stderr || result.stdout || "not available");
}

async function checkWritableDirectory(directory) {
  await mkdir(directory, { recursive: true });
  await access(directory, fsConstants.W_OK);
  const probe = path.join(directory, `.doctor-${process.pid}.tmp`);
  await writeFile(probe, "ok", "utf8");
  await rm(probe, { force: true });
}

async function checkLabels({ tokenInfo, repo, labels, createLabels }) {
  if (!tokenInfo?.token) {
    return [check("fail", "GitHub labels", "skipped because GitHub auth/token is not valid")];
  }

  const client = new GitHubClient({ token: tokenInfo.token });
  const checks = [];
  for (const label of requiredLabelNames(labels)) {
    const result = await client.getLabel(repo, label);
    if (result.ok) {
      checks.push(check("pass", `GitHub label ${label}`, "exists"));
      continue;
    }
    if (result.status === 404 && createLabels) {
      const created = await client.createLabel(repo, label);
      checks.push(
        created.ok
          ? check("pass", `GitHub label ${label}`, "created")
          : check("fail", `GitHub label ${label}`, created.detail)
      );
      continue;
    }
    checks.push(check("fail", `GitHub label ${label}`, result.status === 404 ? "missing" : result.detail));
  }
  return checks;
}

export async function runDoctor({ repoRoot, createLabels = false, env = process.env }) {
  const checks = [];
  let workflow;
  let config;

  try {
    workflow = await loadWorkflow(path.join(repoRoot, "WORKFLOW.md"));
    config = resolveConfig(repoRoot, workflow.config, env);
    checks.push(check("pass", "WORKFLOW.md", `version ${workflow.config.version}`));
  } catch (error) {
    checks.push(check("fail", "WORKFLOW.md", error.message));
  }

  try {
    if (config?.maxConcurrentAgents !== 1) {
      throw new Error("max_concurrent_agents must remain 1 in Phase 1");
    }
    checks.push(check("pass", "max_concurrent_agents", "1"));
  } catch (error) {
    checks.push(check("fail", "max_concurrent_agents", error.message));
  }

  if (config) {
    for (const [name, directory] of [
      ["workspace root", config.workspaceRoot],
      ["log root", config.logRoot],
      ["state root", config.stateRoot]
    ]) {
      try {
        await checkWritableDirectory(directory);
        checks.push(check("pass", name, directory));
      } catch (error) {
        checks.push(check("fail", name, error.message));
      }
    }
  }

  checks.push(await checkCommand("codex", ["--version"]));
  checks.push(await checkCommand("codex", ["app-server", "--help"]));
  checks.push(await checkCommand("codex", ["exec", "--help"]));

  let repo = null;
  try {
    repo = await detectRepositorySlug(repoRoot);
    checks.push(check("pass", "GitHub repository", repo));
  } catch (error) {
    checks.push(check("fail", "GitHub repository", error.message));
  }

  let tokenInfo = null;
  try {
    tokenInfo = await resolveGitHubToken(env);
    checks.push(check("pass", "GitHub auth/token", tokenInfo.source));
  } catch (error) {
    checks.push(check("fail", "GitHub auth/token", error.message));
  }

  if (repo && config) {
    try {
      checks.push(...(await checkLabels({
        tokenInfo,
        repo,
        labels: config.labels,
        createLabels
      })));
    } catch (error) {
      checks.push(check("fail", "GitHub labels", error.message));
    }
  }

  return {
    ok: checks.every((item) => item.status === "pass"),
    checks
  };
}
