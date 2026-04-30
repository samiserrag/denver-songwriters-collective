import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectRepositorySlug } from "./github.mjs";
import { readGitSnapshot } from "./gitState.mjs";

const SECRET_KEY_PATTERN = /token|secret|password|authorization|api[_-]?key|private[_-]?key/i;
const SECRET_VALUE_PATTERN = /\b(ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{16,})\b/g;

function timestampForId(date) {
  return date.toISOString().replace(/[-:.]/g, "").replace("T", "t").replace("Z", "z");
}

export function createRunId({ command, now = new Date(), pid = process.pid } = {}) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestampForId(now)}-${pid}-${command || "run"}-${random}`;
}

export function redactSecrets(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redactSecrets(item)
      ])
    );
  }
  if (typeof value === "string") {
    return value.replace(SECRET_VALUE_PATTERN, "[redacted]");
  }
  return value;
}

export async function createRunManifestContext({ repoRoot, config, command, mode, now = new Date() }) {
  await mkdir(config.manifestRoot, { recursive: true });
  const runId = createRunId({ command, now });
  const manifestPath = path.join(config.manifestRoot, `${runId}.json`);
  const git = await readGitSnapshot(repoRoot);
  let repoSlug = null;
  try {
    repoSlug = await detectRepositorySlug(repoRoot);
  } catch {
    repoSlug = null;
  }

  return {
    runId,
    manifestPath,
    manifest: {
      runId,
      command,
      mode,
      startedAt: now.toISOString(),
      completedAt: null,
      repo: {
        slug: repoSlug,
        head: git.head,
        originMain: git.originMain,
        clean: git.clean,
        dirtyFiles: git.dirtyFiles,
        statusError: git.statusError
      },
      plannedIssues: [],
      skippedIssues: [],
      labelTransitions: [],
      worktrees: [],
      logs: [],
      lock: null,
      outcome: {
        ok: false,
        reason: "run did not complete"
      }
    }
  };
}

export async function writeRunManifest({ context, updates = {}, now = new Date() }) {
  const manifest = {
    ...context.manifest,
    ...updates,
    completedAt: updates.completedAt || now.toISOString()
  };
  await writeFile(context.manifestPath, `${JSON.stringify(redactSecrets(manifest), null, 2)}\n`, "utf8");
  context.manifest = manifest;
  return context.manifestPath;
}

export function manifestIssuePlan(plan) {
  return {
    number: plan.issue.number,
    title: plan.issue.title,
    approvedWriteSet: plan.issue.approvedWriteSet || [],
    acceptanceCriteria: plan.issue.acceptanceCriteria || [],
    branchName: plan.branchName,
    worktreePath: plan.worktreePath,
    logPath: plan.logPath || null,
    transition: plan.transition
  };
}

export function manifestSkippedIssue(item) {
  return {
    number: item.issue.number,
    title: item.issue.title,
    reasons: item.reasons,
    labels: item.labels
  };
}
