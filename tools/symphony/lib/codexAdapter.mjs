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

export async function runCodexExecAdapter({ codexBin = "codex", worktreePath, prompt, logPath }) {
  await mkdir(path.dirname(logPath), { recursive: true });
  const args = buildCodexExecArgs({ worktreePath, prompt });

  return new Promise((resolve, reject) => {
    const child = spawn(codexBin, args, {
      cwd: worktreePath,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", async (code) => {
      await writeFile(logPath, stdout + stderr, "utf8");
      resolve({
        ok: code === 0,
        code,
        logPath,
        stdout,
        stderr
      });
    });
  });
}
