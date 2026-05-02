import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildCodexPrompt, runCodexExecAdapter } from "./codexAdapter.mjs";
import { resolveConfig } from "./config.mjs";
import { readGitSnapshot } from "./gitState.mjs";
import { detectRepositorySlug, GitHubClient, resolveGitHubToken, runCommand } from "./github.mjs";
import {
  assessRunningIssue,
  buildWorkpadBody,
  countRunningIssues,
  labelTransitionFor,
  WORKPAD_MARKER
} from "./issues.mjs";
import { acquireRunnerLock, RunnerLockError } from "./lock.mjs";
import {
  createRunManifestContext,
  manifestIssuePlan,
  manifestSkippedIssue,
  writeRunManifest
} from "./manifest.mjs";
import { diagnoseIssueEligibility, runExecutePreflight } from "./preflight.mjs";
import { branchNameForIssue, workspacePathForIssue } from "./workspace.mjs";
import { loadWorkflow } from "./workflow.mjs";

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function mergeIssuesByNumber(...issueLists) {
  const issuesByNumber = new Map();
  for (const issues of issueLists) {
    for (const issue of issues) {
      issuesByNumber.set(issue.number, issue);
    }
  }
  return [...issuesByNumber.values()];
}

async function loadCandidateIssues({
  repoRoot,
  config,
  mockIssuesPath,
  env,
  client: providedClient = null,
  repo: providedRepo = null,
  tokenInfo: providedTokenInfo = null
}) {
  if (mockIssuesPath) {
    const absolute = path.resolve(repoRoot, mockIssuesPath);
    return readJsonFile(absolute);
  }

  const tokenInfo = providedTokenInfo || (providedClient ? null : await resolveGitHubToken(env));
  const repo = providedRepo || await detectRepositorySlug(repoRoot);
  const client = providedClient || new GitHubClient({ token: tokenInfo.token });
  const [readyIssues, runningIssues] = await Promise.all([
    client.listIssuesByLabel(repo, config.labels.ready),
    client.listIssuesByLabel(repo, config.labels.running)
  ]);
  return mergeIssuesByNumber(readyIssues, runningIssues);
}

export function planIssues({ issues, config }) {
  const runningCount = countRunningIssues(issues, config.labels);
  const diagnostics = issues.map((issue) => diagnoseIssueEligibility(issue, config.labels));
  const eligibleDiagnostics = diagnostics
    .filter((item) => item.eligible)
    .sort((left, right) => left.issue.number - right.issue.number);
  const selectedDiagnostics = runningCount >= config.maxConcurrentAgents
    ? []
    : eligibleDiagnostics.slice(0, config.maxConcurrentAgents - runningCount);
  const selectedIssueNumbers = new Set(selectedDiagnostics.map((item) => item.issue.number));
  const skipped = diagnostics
    .filter((item) => !selectedIssueNumbers.has(item.issue.number))
    .map((item) => ({
      ...item,
      reasons: item.reasons.length > 0 ? item.reasons : ["not selected: concurrency limit"]
    }));

  if (runningCount >= config.maxConcurrentAgents) {
    return {
      runningCount,
      eligibleCount: eligibleDiagnostics.length,
      plans: [],
      skipped,
      reason: `max_concurrent_agents=${config.maxConcurrentAgents} already reached`
    };
  }

  return {
    runningCount,
    eligibleCount: eligibleDiagnostics.length,
    reason: selectedDiagnostics.length === 0 ? "no issue has the required ready label state and issue metadata" : "",
    skipped,
    plans: selectedDiagnostics.map((diagnostic) => {
      const issue = diagnostic.issue;
      const branchName = branchNameForIssue(issue);
      const worktreePath = workspacePathForIssue(config.workspaceRoot, issue);
      return {
        issue: {
          number: issue.number,
          title: issue.title,
          body: issue.body || "",
          approvedWriteSet: diagnostic.approvedWriteSet,
          acceptanceCriteria: diagnostic.acceptanceCriteria
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
  const fetchResult = await runCommand("git", ["fetch", "origin", "main:refs/remotes/origin/main"], {
    cwd: repoRoot,
    timeout: 60000
  });
  if (!fetchResult.ok) {
    throw new Error(fetchResult.stderr || fetchResult.stdout || "failed to fetch origin/main");
  }

  const verifyResult = await runCommand("git", ["rev-parse", "--verify", "origin/main^{commit}"], {
    cwd: repoRoot
  });
  if (!verifyResult.ok) {
    throw new Error(verifyResult.stderr || verifyResult.stdout || "origin/main is not resolvable");
  }

  const result = await runCommand("git", ["worktree", "add", "-b", branchName, worktreePath, "origin/main"], {
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
  const existingWorkpads = comments.data.filter((comment) => String(comment.body || "").includes(WORKPAD_MARKER));
  const existing = existingWorkpads[0];
  if (existing) {
    const updated = await client.updateComment(repo, existing.id, body);
    if (!updated.ok) {
      throw new Error(updated.detail);
    }
    for (const duplicate of existingWorkpads.slice(1)) {
      if (typeof client.deleteComment !== "function") {
        throw new Error("GitHub client cannot delete duplicate Symphony workpad comments");
      }
      const deleted = await client.deleteComment(repo, duplicate.id);
      if (!deleted.ok) {
        throw new Error(deleted.detail);
      }
    }
    return updated;
  }
  const created = await client.createComment(repo, issueNumber, body);
  if (!created.ok) {
    throw new Error(created.detail);
  }
  return created;
}

async function loadIssueComments({ client, repo, issueNumber }) {
  const comments = await client.listComments(repo, issueNumber);
  if (!comments.ok) {
    throw new Error(comments.detail);
  }
  return comments.data;
}

function plannedManifestData(planned) {
  return {
    plannedIssues: planned.plans.map(manifestIssuePlan),
    skippedIssues: planned.skipped.map(manifestSkippedIssue),
    labelTransitions: planned.plans.map((plan) => ({
      issueNumber: plan.issue.number,
      transition: plan.transition
    })),
    worktrees: planned.plans.map((plan) => ({
      issueNumber: plan.issue.number,
      path: plan.worktreePath,
      branchName: plan.branchName
    })),
    logs: planned.plans
      .filter((plan) => plan.logPath)
      .map((plan) => ({ issueNumber: plan.issue.number, path: plan.logPath }))
  };
}

async function writeManifestSafely({ writeManifest, context, updates, now }) {
  try {
    const manifestPath = await writeManifest({ context, updates, now });
    return { ok: true, manifestPath };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: `manifest write failed: ${detail}`
    };
  }
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "the configured timeout";
  }
  if (milliseconds % 60000 === 0) {
    const minutes = milliseconds / 60000;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (milliseconds % 1000 === 0) {
    const seconds = milliseconds / 1000;
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  return `${milliseconds} ms`;
}

function isOuterTimeout(codexResult) {
  return codexResult?.reason === "outer_timeout" || codexResult?.timedOut === true;
}

function codexBlockedReason(codexResult) {
  if (isOuterTimeout(codexResult)) {
    return `outer Codex execution timeout after ${formatDuration(codexResult.timeout?.timeoutMs)}`;
  }
  if (codexResult?.error) {
    return codexResult.error;
  }
  if (codexResult?.signal && codexResult.code === null) {
    return `Codex failed with signal ${codexResult.signal}`;
  }
  return `Codex failed with exit ${codexResult?.code}`;
}

function codexResultDetail(codexResult) {
  if (isOuterTimeout(codexResult)) {
    const timeoutDuration = formatDuration(codexResult.timeout?.timeoutMs);
    const graceDuration = formatDuration(codexResult.timeout?.graceMs);
    const termination = codexResult.timeout?.forcedKill
      ? `sent SIGTERM, then SIGKILL after ${graceDuration}`
      : `sent SIGTERM and exited before the ${graceDuration} grace period elapsed`;
    return `Codex exceeded Symphony outer execution timeout after ${timeoutDuration}; ${termination}. Local log: ${codexResult.logPath}`;
  }
  return `${codexBlockedReason(codexResult)}. Local log: ${codexResult?.logPath}`;
}

function codexNextAction(codexResult) {
  if (isOuterTimeout(codexResult)) {
    return "Review the timeout log and worktree, then decide whether to retry with a narrower issue or a longer approved timeout.";
  }
  return "Read the local log and decide whether to retry, recover, or edit the issue.";
}

function executionOutcomeReason({ plannedReason, results }) {
  if (results.some((result) => isOuterTimeout(result.codexResult))) {
    return "outer_timeout";
  }
  return plannedReason || "execute completed";
}

function executionOutcomeTimeout(results) {
  const timedOut = results.find((result) => isOuterTimeout(result.codexResult));
  if (!timedOut) {
    return undefined;
  }
  return {
    issueNumber: timedOut.issue.number,
    title: timedOut.issue.title,
    ...timedOut.codexResult.timeout
  };
}

function recoveryDetail(assessment, staleRunningMinutes) {
  const ageMinutes = assessment.ageMs === null ? "unknown" : Math.floor(assessment.ageMs / 60000);
  return `stale running recovery after ${ageMinutes} minutes; threshold is ${staleRunningMinutes} minutes`;
}

async function loadRunningIssueAssessments({ client, repo, config, now = new Date() }) {
  const issues = await client.listIssuesByLabel(repo, config.labels.running);
  const assessments = [];
  for (const issue of issues) {
    const comments = await loadIssueComments({ client, repo, issueNumber: issue.number });
    assessments.push({
      issue,
      comments,
      assessment: assessRunningIssue({
        issue,
        comments,
        labels: config.labels,
        now,
        staleMs: config.staleRunningMs
      })
    });
  }
  return assessments;
}

export async function recoverStaleRunningIssues({
  repoRoot,
  dryRun = true,
  execute = false,
  env = process.env,
  now = new Date(),
  client: providedClient = null,
  repo: providedRepo = null,
  skipLock = false,
  writeManifest = writeRunManifest
}) {
  const mode = execute && !dryRun ? "execute" : "dry-run";
  const workflow = await loadWorkflow(path.join(repoRoot, "WORKFLOW.md"));
  const config = resolveConfig(repoRoot, workflow.config, env);
  const manifestContext = await createRunManifestContext({ repoRoot, config, command: "recover-stale", mode, now });
  let lock = null;

  try {
    if (!skipLock) {
      lock = await acquireRunnerLock({
        lockPath: config.lockPath,
        command: "recover-stale",
        mode,
        runId: manifestContext.runId,
        staleMs: config.lockStaleMs,
        now
      });
      manifestContext.manifest.lock = { ...lock, release: undefined };
    }

    if (mode === "execute" && env.SYMPHONY_EXECUTION_APPROVED !== "1") {
      const result = {
        ok: false,
        mode,
        stale: [],
        active: [],
        manifestPath: manifestContext.manifestPath,
        reason: "stale recovery requires SYMPHONY_EXECUTION_APPROVED=1"
      };
      await writeManifest({
        context: manifestContext,
        updates: {
          outcome: {
            ok: false,
            reason: result.reason
          }
        },
        now
      });
      return result;
    }

    const tokenInfo = providedClient ? null : await resolveGitHubToken(env);
    const repo = providedRepo || await detectRepositorySlug(repoRoot);
    const client = providedClient || new GitHubClient({ token: tokenInfo.token });
    const assessments = await loadRunningIssueAssessments({ client, repo, config, now });
    const stale = assessments.filter((item) => item.assessment.isStale);
    const active = assessments.filter((item) => !item.assessment.isStale);

    if (mode === "dry-run") {
      const result = {
        ok: true,
        mode,
        stale: stale.map((item) => item.assessment),
        active: active.map((item) => item.assessment),
        manifestPath: manifestContext.manifestPath,
        reason: stale.length === 0 ? "no stale running issues found" : ""
      };
      await writeManifest({
        context: manifestContext,
        updates: {
          plannedIssues: result.stale.map((item) => ({ number: item.issueNumber, title: item.title })),
          skippedIssues: result.active.map((item) => ({
            number: item.issueNumber,
            title: item.title,
            reasons: ["running issue is not stale"]
          })),
          outcome: {
            ok: true,
            reason: result.reason || "stale running issues found"
          }
        },
        now
      });
      return result;
    }

    const initialManifestWrite = await writeManifestSafely({
      writeManifest,
      context: manifestContext,
      updates: {
        plannedIssues: stale.map((item) => ({
          number: item.assessment.issueNumber,
          title: item.assessment.title
        })),
        skippedIssues: active.map((item) => ({
          number: item.assessment.issueNumber,
          title: item.assessment.title,
          reasons: ["running issue is not stale"]
        })),
        outcome: {
          ok: false,
          reason: "stale recovery preflight passed; external mutations starting"
        }
      },
      now
    });
    if (!initialManifestWrite.ok) {
      return {
        ok: false,
        mode,
        stale: stale.map((item) => item.assessment),
        active: active.map((item) => item.assessment),
        manifestPath: manifestContext.manifestPath,
        reason: initialManifestWrite.reason
      };
    }

    const recovered = [];
    for (const item of stale) {
      const branchName = branchNameForIssue(item.issue);
      const worktreePath = workspacePathForIssue(config.workspaceRoot, item.issue);
      const detail = recoveryDetail(item.assessment, config.staleRunningMinutes);
      const transition = labelTransitionFor("blocked", config.labels);
      await applyLabelTransition({
        client,
        repo,
        issueNumber: item.issue.number,
        transition
      });
      await upsertWorkpadComment({
        client,
        repo,
        issueNumber: item.issue.number,
        body: buildWorkpadBody({
          state: "blocked",
          issue: item.issue,
          branchName,
          worktreePath,
          manifestPath: manifestContext.manifestPath,
          command: "recover-stale",
          mode,
          blockedReason: detail,
          nextAction: "Review the blocked issue and clear labels manually if recovery was expected.",
          detail
        })
      });
      recovered.push({
        ...item.assessment,
        finalState: "blocked",
        transition
      });
    }

    const result = {
      ok: true,
      mode,
      stale: recovered,
      active: active.map((item) => item.assessment),
      manifestPath: manifestContext.manifestPath,
      reason: recovered.length === 0 ? "no stale running issues found" : ""
    };
    await writeManifest({
      context: manifestContext,
      updates: {
        plannedIssues: recovered.map((item) => ({ number: item.issueNumber, title: item.title })),
        skippedIssues: result.active.map((item) => ({
          number: item.issueNumber,
          title: item.title,
          reasons: ["running issue is not stale"]
        })),
        labelTransitions: recovered.map((item) => ({
          issueNumber: item.issueNumber,
          transition: item.transition
        })),
        outcome: {
          ok: true,
          reason: result.reason || "stale running issues recovered"
        }
      },
      now
    });
    return result;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const result = {
      ok: false,
      mode,
      stale: [],
      active: [],
      manifestPath: manifestContext.manifestPath,
      reason: detail,
      lock: error instanceof RunnerLockError ? error.detail : undefined
    };
    await writeManifest({
      context: manifestContext,
      updates: {
        lock: result.lock || manifestContext.manifest.lock,
        outcome: {
          ok: false,
          reason: detail
        }
      },
      now
    });
    return result;
  } finally {
    await lock?.release();
  }
}

export async function runOnce({
  repoRoot,
  dryRun = true,
  execute = false,
  mockIssuesPath = null,
  env = process.env,
  skipLock = false,
  client: providedClient = null,
  repo: providedRepo = null,
  tokenInfo: providedTokenInfo = null,
  gitSnapshot: providedGitSnapshot = null,
  writeManifest = writeRunManifest,
  createWorktreeFn = createWorktree,
  runCodexAdapter = runCodexExecAdapter
}) {
  const mode = execute && !dryRun ? "execute" : "dry-run";
  if (mode === "execute" && mockIssuesPath) {
    return {
      ok: false,
      mode,
      runningCount: 0,
      plans: [],
      reason: "--execute cannot be combined with --mock-issues; mock mode is dry-run only"
    };
  }

  const workflow = await loadWorkflow(path.join(repoRoot, "WORKFLOW.md"));
  const config = resolveConfig(repoRoot, workflow.config, env);
  const manifestContext = await createRunManifestContext({ repoRoot, config, command: "once", mode });
  let lock = null;
  let planned = {
    runningCount: 0,
    eligibleCount: 0,
    plans: [],
    skipped: [],
    reason: ""
  };

  try {
    if (!skipLock) {
      lock = await acquireRunnerLock({
        lockPath: config.lockPath,
        command: "once",
        mode,
        runId: manifestContext.runId,
        staleMs: config.lockStaleMs
      });
      manifestContext.manifest.lock = { ...lock, release: undefined };
    }

    const issues = await loadCandidateIssues({
      repoRoot,
      config,
      mockIssuesPath,
      env,
      client: providedClient,
      repo: providedRepo,
      tokenInfo: providedTokenInfo
    });
    planned = planIssues({ issues, config });
    for (const plan of planned.plans) {
      plan.logPath = path.join(config.logRoot, `issue-${plan.issue.number}.jsonl`);
    }

    if (mode === "dry-run") {
      const manifestWrite = await writeManifestSafely({
        writeManifest,
        context: manifestContext,
        updates: {
          ...plannedManifestData(planned),
          outcome: {
            ok: true,
            reason: planned.reason || "dry-run planned eligible issues"
          }
        }
      });
      if (!manifestWrite.ok) {
        return {
          ok: false,
          mode,
          ...planned,
          manifestPath: manifestContext.manifestPath,
          reason: manifestWrite.reason
        };
      }
      return {
        ok: true,
        mode,
        ...planned,
        manifestPath: manifestContext.manifestPath
      };
    }

    if (env.SYMPHONY_EXECUTION_APPROVED !== "1") {
      const result = {
        ok: false,
        mode,
        runningCount: planned.runningCount,
        plans: planned.plans,
        skipped: planned.skipped,
        manifestPath: manifestContext.manifestPath,
        reason: "real execution requires SYMPHONY_EXECUTION_APPROVED=1"
      };
      const manifestWrite = await writeManifestSafely({
        writeManifest,
        context: manifestContext,
        updates: {
          ...plannedManifestData(planned),
          outcome: {
            ok: false,
            reason: result.reason
          }
        }
      });
      return manifestWrite.ok ? result : { ...result, reason: manifestWrite.reason };
    }

    const tokenInfo = providedTokenInfo || (providedClient ? null : await resolveGitHubToken(env));
    const repo = providedRepo || await detectRepositorySlug(repoRoot);
    const client = providedClient || new GitHubClient({ token: tokenInfo.token });
    const gitSnapshot = providedGitSnapshot || await readGitSnapshot(repoRoot);
    const preflight = await runExecutePreflight({ repoRoot, config, client, repo, tokenInfo, planned, gitSnapshot });
    if (!preflight.ok) {
      const result = {
        ok: false,
        mode,
        runningCount: planned.runningCount,
        plans: planned.plans,
        skipped: planned.skipped,
        manifestPath: manifestContext.manifestPath,
        preflight,
        reason: `execute preflight failed: ${preflight.failures.join("; ")}`
      };
      const manifestWrite = await writeManifestSafely({
        writeManifest,
        context: manifestContext,
        updates: {
          ...plannedManifestData(planned),
          outcome: {
            ok: false,
            reason: result.reason,
            preflight
          }
        }
      });
      return manifestWrite.ok ? result : { ...result, reason: manifestWrite.reason };
    }

    const initialManifestWrite = await writeManifestSafely({
      writeManifest,
      context: manifestContext,
      updates: {
        ...plannedManifestData(planned),
        outcome: {
          ok: false,
          reason: "execute preflight passed; external mutations starting",
          preflight
        }
      }
    });
    if (!initialManifestWrite.ok) {
      return {
        ok: false,
        mode,
        runningCount: planned.runningCount,
        plans: planned.plans,
        skipped: planned.skipped,
        manifestPath: manifestContext.manifestPath,
        preflight,
        reason: initialManifestWrite.reason
      };
    }

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
            logPath: plan.logPath,
            manifestPath: manifestContext.manifestPath,
            command: "once",
            mode,
            nextAction: "Wait for Codex to finish, then review the issue workpad and resulting branch.",
            detail: "claimed by Symphony runner"
          })
        });
        const issueComments = await loadIssueComments({ client, repo, issueNumber: plan.issue.number });
        await createWorktreeFn({ repoRoot, worktreePath: plan.worktreePath, branchName: plan.branchName });
        const prompt = buildCodexPrompt({
          workflowText: workflow.markdown,
          issue: {
            ...plan.issue,
            comments: issueComments
          }
        });
        const codexResult = await runCodexAdapter({
          worktreePath: plan.worktreePath,
          prompt,
          logPath: plan.logPath,
          executionTimeoutMs: config.codexExecutionTimeoutMs,
          executionTimeoutKillGraceMs: config.codexExecutionTimeoutKillGraceMs
        });
        const finalState = codexResult.ok ? "human-review" : "blocked";
        const blockedReason = codexResult.ok ? "" : codexBlockedReason(codexResult);
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
            logPath: plan.logPath,
            manifestPath: manifestContext.manifestPath,
            command: "once",
            mode,
            blockedReason,
            nextAction: codexResult.ok
              ? "Review the local branch/worktree and open a PR only after normal quality gates pass."
              : codexNextAction(codexResult),
            detail: codexResult.ok
              ? `Codex finished. Local log: ${codexResult.logPath}`
              : codexResultDetail(codexResult)
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
              logPath: plan.logPath,
              manifestPath: manifestContext.manifestPath,
              command: "once",
              mode,
              blockedReason: detail,
              nextAction: "Read the blocked reason and decide whether to retry after fixing the cause.",
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

    const result = {
      ok: results.every((result) => result.codexResult.ok),
      mode,
      runningCount: planned.runningCount,
      plans: results,
      skipped: planned.skipped,
      manifestPath: manifestContext.manifestPath,
      reason: planned.reason
    };
    const manifestWrite = await writeManifestSafely({
      writeManifest,
      context: manifestContext,
      updates: {
        ...plannedManifestData({ ...planned, plans: results }),
        outcome: {
          ok: result.ok,
          reason: executionOutcomeReason({ plannedReason: result.reason, results }),
          timeout: executionOutcomeTimeout(results)
        }
      }
    });
    return manifestWrite.ok
      ? result
      : { ...result, ok: false, reason: manifestWrite.reason };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const result = {
      ok: false,
      mode,
      runningCount: planned.runningCount,
      plans: planned.plans,
      skipped: planned.skipped,
      manifestPath: manifestContext.manifestPath,
      reason: detail,
      lock: error instanceof RunnerLockError ? error.detail : undefined
    };
    const manifestWrite = await writeManifestSafely({
      writeManifest,
      context: manifestContext,
      updates: {
        lock: result.lock || manifestContext.manifest.lock,
        ...plannedManifestData(planned),
        outcome: {
          ok: false,
          reason: detail
        }
      }
    });
    return manifestWrite.ok ? result : { ...result, reason: manifestWrite.reason };
  } finally {
    await lock?.release();
  }
}

function installDaemonSignalHandlers({ controller, processLike = process }) {
  if (!processLike || typeof processLike.once !== "function" || typeof processLike.off !== "function") {
    return () => {};
  }
  const stopOnSignal = (signalName) => {
    if (!controller.signal.aborted) {
      controller.abort(signalName);
    }
  };
  const onSigint = () => stopOnSignal("SIGINT");
  const onSigterm = () => stopOnSignal("SIGTERM");
  processLike.once("SIGINT", onSigint);
  processLike.once("SIGTERM", onSigterm);
  return () => {
    processLike.off("SIGINT", onSigint);
    processLike.off("SIGTERM", onSigterm);
  };
}

function daemonStopReason(signal) {
  const reason = signal?.reason;
  return typeof reason === "string" ? `daemon stopped by ${reason}` : "daemon stopped";
}

async function waitForNextDaemonCycle(milliseconds, signal) {
  if (signal?.aborted) {
    return;
  }
  await new Promise((resolve) => {
    let timeout;
    const stop = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", stop);
      resolve();
    };
    timeout = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", stop, { once: true });
  });
}

export async function runDaemon({
  repoRoot,
  dryRun = true,
  intervalSeconds = 120,
  env = process.env,
  signal = null,
  processLike = process,
  runOnceFn = runOnce,
  sleepFn = waitForNextDaemonCycle
}) {
  if (env.SYMPHONY_ENABLE_DAEMON !== "1") {
    return {
      ok: false,
      mode: "daemon",
      reason: "daemon requires SYMPHONY_ENABLE_DAEMON=1"
    };
  }

  const workflow = await loadWorkflow(path.join(repoRoot, "WORKFLOW.md"));
  const config = resolveConfig(repoRoot, workflow.config, env);
  const controller = signal ? null : new AbortController();
  const stopSignal = signal || controller.signal;
  const removeSignalHandlers = controller
    ? installDaemonSignalHandlers({ controller, processLike })
    : () => {};
  let lock;
  try {
    lock = await acquireRunnerLock({
      lockPath: config.lockPath,
      command: "daemon",
      mode: dryRun ? "dry-run" : "execute",
      runId: `daemon-${process.pid}-${Date.now()}`,
      staleMs: config.lockStaleMs
    });
  } catch (error) {
    removeSignalHandlers();
    return {
      ok: false,
      mode: "daemon",
      reason: error instanceof Error ? error.message : String(error),
      lock: error instanceof RunnerLockError ? error.detail : undefined
    };
  }

  try {
    let iterations = 0;
    while (!stopSignal.aborted) {
      await runOnceFn({ repoRoot, dryRun, execute: !dryRun, env, skipLock: true });
      iterations += 1;
      if (stopSignal.aborted) {
        break;
      }
      await sleepFn(intervalSeconds * 1000, stopSignal);
    }
    return {
      ok: true,
      mode: "daemon",
      iterations,
      reason: daemonStopReason(stopSignal)
    };
  } finally {
    removeSignalHandlers();
    await lock.release();
  }
}
