import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function buildCodexPrompt({ workflowText, issue }) {
  return [
    "You are running inside the repository's Symphony workflow.",
    "Follow WORKFLOW.md and all repo governance files before making changes.",
    "",
    "GitHub issue:",
    `#${issue.number} ${issue.title}`,
    "",
    issue.body || "(no issue body)",
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
