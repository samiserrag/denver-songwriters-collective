import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildCodexPrompt, runCodexExecAdapter } from "./codexAdapter.mjs";
import { resolveConfig } from "./config.mjs";
import { detectRepositorySlug, GitHubClient, resolveGitHubToken, runCommand } from "./github.mjs";
import {
  buildWorkpadBody,
  countRunningIssues,
  filterEligibleIssues,
  labelTransitionFor,
  WORKPAD_MARKER
} from "./issues.mjs";
import { branchNameForIssue, workspacePathForIssue } from "./workspace.mjs";
import { loadWorkflow } from "./workflow.mjs";

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadCandidateIssues({ repoRoot, config, mockIssuesPath, env }) {
  if (mockIssuesPath) {
    const absolute = path.resolve(repoRoot, mockIssuesPath);
    return readJsonFile(absolute);
  }

  const tokenInfo = await resolveGitHubToken(env);
  const repo = await detectRepositorySlug(repoRoot);
  const client = new GitHubClient({ token: tokenInfo.token });
  return client.listIssuesByLabel(repo, config.labels.ready);
}

export function planIssues({ issues, config }) {
  const runningCount = countRunningIssues(issues, config.labels);
  if (runningCount >= config.maxConcurrentAgents) {
    return {
      runningCount,
      plans: [],
      reason: `max_concurrent_agents=${config.maxConcurrentAgents} already reached`
    };
  }

  const eligible = filterEligibleIssues(issues, config.labels)
    .sort((left, right) => left.number - right.number)
    .slice(0, config.maxConcurrentAgents - runningCount);

  return {
    runningCount,
    reason: eligible.length === 0 ? "no issue has the required ready-only label state" : "",
    plans: eligible.map((issue) => {
      const branchName = branchNameForIssue(issue);
      const worktreePath = workspacePathForIssue(config.workspaceRoot, issue);
      return {
        issue: {
          number: issue.number,
          title: issue.title,
          body: issue.body || ""
        },
        branchName,
        worktreePath,
        transition: labelTransitionFor("claim", config.labels),
        adapter: config.codexAdapter
      };
    })
  };
}

async function createWorktree({ repoRoot, worktreePath, branchName }) {
  await mkdir(path.dirname(worktreePath), { recursive: true });
  const result = await runCommand("git", ["worktree", "add", "-b", branchName, worktreePath, "HEAD"], {
    cwd: repoRoot,
    timeout: 60000
  });
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || "git worktree add failed");
  }
}

async function applyLabelTransition({ client, repo, issueNumber, transition }) {
  if (transition.add.length > 0) {
    const added = await client.addLabels(repo, issueNumber, transition.add);
    if (!added.ok) {
      throw new Error(added.detail);
    }
  }
  for (const label of transition.remove) {
    const removed = await client.removeLabel(repo, issueNumber, label);
    if (!removed.ok && removed.status !== 404) {
      throw new Error(removed.detail);
    }
  }
}

async function upsertWorkpadComment({ client, repo, issueNumber, body }) {
  const comments = await client.listComments(repo, issueNumber);
  if (!comments.ok) {
    throw new Error(comments.detail);
  }
  const existing = comments.data.find((comment) => String(comment.body || "").includes(WORKPAD_MARKER));
  if (existing) {
    const updated = await client.updateComment(repo, existing.id, body);
    if (!updated.ok) {
      throw new Error(updated.detail);
    }
    return updated;
  }
  const created = await client.createComment(repo, issueNumber, body);
  if (!created.ok) {
    throw new Error(created.detail);
  }
  return created;
}

export async function runOnce({
  repoRoot,
  dryRun = true,
  execute = false,
  mockIssuesPath = null,
  env = process.env
}) {
  const workflow = await loadWorkflow(path.join(repoRoot, "WORKFLOW.md"));
  const config = resolveConfig(repoRoot, workflow.config, env);
  let issues;
  try {
    issues = await loadCandidateIssues({ repoRoot, config, mockIssuesPath, env });
  } catch (error) {
    return {
      ok: false,
      mode: execute && !dryRun ? "execute" : "dry-run",
      runningCount: 0,
      plans: [],
      reason: error.message
    };
  }
  const planned = planIssues({ issues, config });
  const mode = execute && !dryRun ? "execute" : "dry-run";

  if (mode === "dry-run") {
    return {
      ok: true,
      mode,
      ...planned
    };
  }

  if (env.SYMPHONY_EXECUTION_APPROVED !== "1") {
    return {
      ok: false,
      mode,
      runningCount: planned.runningCount,
      plans: planned.plans,
      reason: "real execution requires SYMPHONY_EXECUTION_APPROVED=1"
    };
  }

  const tokenInfo = await resolveGitHubToken(env);
  const repo = await detectRepositorySlug(repoRoot);
  const client = new GitHubClient({ token: tokenInfo.token });
  const results = [];

  for (const plan of planned.plans) {
    try {
      await applyLabelTransition({
        client,
        repo,
        issueNumber: plan.issue.number,
        transition: plan.transition
      });
      await upsertWorkpadComment({
        client,
        repo,
        issueNumber: plan.issue.number,
        body: buildWorkpadBody({
          state: "running",
          issue: plan.issue,
          branchName: plan.branchName,
          worktreePath: plan.worktreePath,
          detail: "claimed by Symphony runner"
        })
      });
      await createWorktree({ repoRoot, worktreePath: plan.worktreePath, branchName: plan.branchName });
      const logPath = path.join(config.logRoot, `issue-${plan.issue.number}.jsonl`);
      const prompt = buildCodexPrompt({ workflowText: workflow.markdown, issue: plan.issue });
      const codexResult = await runCodexExecAdapter({
        worktreePath: plan.worktreePath,
        prompt,
        logPath
      });
      const finalState = codexResult.ok ? "human-review" : "blocked";
      await applyLabelTransition({
        client,
        repo,
        issueNumber: plan.issue.number,
        transition: labelTransitionFor(finalState, config.labels)
      });
      await upsertWorkpadComment({
        client,
        repo,
        issueNumber: plan.issue.number,
        body: buildWorkpadBody({
          state: finalState,
          issue: plan.issue,
          branchName: plan.branchName,
          worktreePath: plan.worktreePath,
          detail: codexResult.ok
            ? `Codex finished. Local log: ${codexResult.logPath}`
            : `Codex failed with exit ${codexResult.code}. Local log: ${codexResult.logPath}`
        })
      });
      results.push({ ...plan, finalState, codexResult });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      try {
        await applyLabelTransition({
          client,
          repo,
          issueNumber: plan.issue.number,
          transition: labelTransitionFor("blocked", config.labels)
        });
        await upsertWorkpadComment({
          client,
          repo,
          issueNumber: plan.issue.number,
          body: buildWorkpadBody({
            state: "blocked",
            issue: plan.issue,
            branchName: plan.branchName,
            worktreePath: plan.worktreePath,
            detail
          })
        });
      } catch {
        // Preserve the original failure. The local result still records that the issue is blocked.
      }
      results.push({
        ...plan,
        finalState: "blocked",
        codexResult: {
          ok: false,
          error: detail
        }
      });
    }
  }

  return {
    ok: results.every((result) => result.codexResult.ok),
    mode,
    runningCount: planned.runningCount,
    plans: results,
    reason: planned.reason
  };
}

export async function runDaemon({ repoRoot, dryRun = true, intervalSeconds = 120, env = process.env }) {
  if (env.SYMPHONY_ENABLE_DAEMON !== "1") {
    return {
      ok: false,
      mode: "daemon",
      reason: "daemon requires SYMPHONY_ENABLE_DAEMON=1"
    };
  }

  while (true) {
    await runOnce({ repoRoot, dryRun, execute: !dryRun, env });
    await new Promise((resolve) => {
      setTimeout(resolve, intervalSeconds * 1000);
    });
  }
}
