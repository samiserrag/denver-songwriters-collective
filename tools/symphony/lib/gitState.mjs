import { runCommand } from "./github.mjs";

function statusEntries(stdout) {
  return String(stdout || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

export function parsePorcelainDirtyFiles(stdout) {
  return statusEntries(stdout).map((line) => line.slice(2).trim());
}

async function readGitValue(repoRoot, args) {
  const result = await runCommand("git", args, { cwd: repoRoot });
  return result.ok && result.stdout ? result.stdout : null;
}

export async function readGitSnapshot(repoRoot) {
  const [head, originMain, status] = await Promise.all([
    readGitValue(repoRoot, ["rev-parse", "HEAD"]),
    readGitValue(repoRoot, ["rev-parse", "--verify", "origin/main^{commit}"]),
    runCommand("git", ["status", "--porcelain=v1"], { cwd: repoRoot })
  ]);
  const dirtyFiles = status.ok ? parsePorcelainDirtyFiles(status.stdout) : [];

  return {
    head,
    originMain,
    clean: status.ok && dirtyFiles.length === 0,
    dirtyFiles,
    statusError: status.ok ? "" : status.stderr || status.stdout || "git status failed"
  };
}
