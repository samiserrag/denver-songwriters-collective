import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { WORKPAD_MARKER } from "./issues.mjs";

function truncateText(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n[truncated ${text.length - maxLength} chars]`;
}

export function formatIssueComments(comments = []) {
  const visibleComments = comments.filter((comment) => !String(comment.body || "").includes(WORKPAD_MARKER));
  if (visibleComments.length === 0) {
    return "(no issue comments)";
  }

  return visibleComments
    .map((comment, index) => {
      const author = comment.user?.login || "unknown";
      const createdAt = comment.created_at || "unknown time";
      return [
        `Comment ${index + 1} by ${author} at ${createdAt}:`,
        truncateText(comment.body || "(empty comment)", 6000)
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export function buildCodexPrompt({ workflowText, issue }) {
  const approvedWriteSet = issue.approvedWriteSet?.length
    ? issue.approvedWriteSet.map((item) => `- ${item}`).join("\n")
    : "(missing)";
  const acceptanceCriteria = issue.acceptanceCriteria?.length
    ? issue.acceptanceCriteria.map((item) => `- ${item}`).join("\n")
    : "(missing)";

  return [
    "You are running inside the repository's Symphony workflow.",
    "Follow WORKFLOW.md and all repo governance files before making changes.",
    "Stop immediately if the issue's approved write set is missing, ambiguous, or does not cover the requested edits.",
    "",
    "GitHub issue:",
    `#${issue.number} ${issue.title}`,
    "",
    "Approved write set:",
    approvedWriteSet,
    "",
    "Acceptance criteria / done condition:",
    acceptanceCriteria,
    "",
    "Issue body:",
    issue.body || "(no issue body)",
    "",
    "GitHub issue comments:",
    formatIssueComments(issue.comments),
    "",
    "Workflow policy:",
    workflowText
  ].join("\n");
}

export function buildCodexExecArgs({ worktreePath, prompt }) {
  return [
    "exec",
    "--json",
    "-C",
    worktreePath,
    "--sandbox",
    "workspace-write",
    prompt
  ];
}

function appendTimeoutMarker({ stdout, stderr, timeout }) {
  let output = stdout + stderr;
  if (!timeout) {
    return output;
  }
  if (output.length > 0 && !output.endsWith("\n")) {
    output += "\n";
  }
  return `${output}${JSON.stringify({
    event: "symphony_outer_timeout",
    reason: timeout.reason,
    timeoutMs: timeout.timeoutMs,
    graceMs: timeout.graceMs,
    forcedKill: timeout.forcedKill,
    timeout
  })}\n`;
}

export async function runCodexExecAdapter({
  codexBin = "codex",
  worktreePath,
  prompt,
  logPath,
  executionTimeoutMs,
  executionTimeoutKillGraceMs,
  spawnFn = spawn,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  nowFn = () => new Date()
}) {
  await mkdir(path.dirname(logPath), { recursive: true });
  const args = buildCodexExecArgs({ worktreePath, prompt });
  const startedAt = nowFn();
  const timeoutMs = Number(executionTimeoutMs);
  const killGraceMs = Number(executionTimeoutKillGraceMs);
  const timeoutEnabled = Number.isFinite(timeoutMs) && timeoutMs > 0;
  const killGraceEnabled = Number.isFinite(killGraceMs) && killGraceMs > 0;

  return new Promise((resolve, reject) => {
    const child = spawnFn(codexBin, args, {
      cwd: worktreePath,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timeoutTimer = null;
    let killGraceTimer = null;
    let timeout = null;
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    function clearTimers() {
      if (timeoutTimer) {
        clearTimeoutFn(timeoutTimer);
        timeoutTimer = null;
      }
      if (killGraceTimer) {
        clearTimeoutFn(killGraceTimer);
        killGraceTimer = null;
      }
    }

    function killChild(signal) {
      if (typeof child.kill === "function") {
        child.kill(signal);
      }
    }

    if (timeoutEnabled) {
      timeoutTimer = setTimeoutFn(() => {
        timedOut = true;
        timeout = {
          reason: "outer_timeout",
          timeoutMs,
          graceMs: killGraceEnabled ? killGraceMs : 0,
          startedAt: startedAt.toISOString(),
          deadlineAt: new Date(startedAt.getTime() + timeoutMs).toISOString(),
          firedAt: nowFn().toISOString(),
          gracefulSignal: "SIGTERM",
          forcedKill: false,
          exitCode: null,
          exitSignal: null
        };
        killChild("SIGTERM");
        if (killGraceEnabled) {
          killGraceTimer = setTimeoutFn(() => {
            timeout.forcedKill = true;
            killChild("SIGKILL");
          }, killGraceMs);
        }
      }, timeoutMs);
    }

    child.on("error", (error) => {
      clearTimers();
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
    child.on("close", async (code, signal) => {
      clearTimers();
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        timeout.exitCode = code;
        timeout.exitSignal = signal || null;
      }
      try {
        await writeFile(logPath, appendTimeoutMarker({ stdout, stderr, timeout }), "utf8");
        resolve({
          ok: !timedOut && code === 0,
          code,
          signal: signal || null,
          logPath,
          stdout,
          stderr,
          timedOut,
          reason: timedOut ? "outer_timeout" : undefined,
          timeout
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}
