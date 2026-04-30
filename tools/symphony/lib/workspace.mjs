import path from "node:path";

export function slugifyTitle(title, maxLength = 48) {
  const slug = String(title || "issue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "issue";
}

export function branchNameForIssue(issue) {
  return `symphony/issue-${issue.number}-${slugifyTitle(issue.title, 36)}`;
}

export function assertInsideRoot(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return resolvedTarget;
  }
  throw new Error(`path escapes workspace root: ${target}`);
}

export function workspacePathForIssue(workspaceRoot, issue) {
  const directory = `issue-${issue.number}-${slugifyTitle(issue.title)}`;
  return assertInsideRoot(workspaceRoot, path.join(workspaceRoot, directory));
}
