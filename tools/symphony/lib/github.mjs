import { execFile } from "node:child_process";

export function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 15000, ...options }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code || 0,
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim()
      });
    });
  });
}

export function parseGitHubRemote(remote) {
  const trimmed = remote.trim();
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return sshMatch[1];
  }
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return httpsMatch[1];
  }
  throw new Error(`unsupported GitHub remote: ${remote}`);
}

export async function detectRepositorySlug(repoRoot) {
  const result = await runCommand("git", ["config", "--get", "remote.origin.url"], { cwd: repoRoot });
  if (!result.ok || !result.stdout) {
    throw new Error(result.stderr || "remote.origin.url not configured");
  }
  return parseGitHubRemote(result.stdout);
}

export async function resolveGitHubToken(env = process.env) {
  if (env.GITHUB_TOKEN) {
    return { source: "GITHUB_TOKEN", token: env.GITHUB_TOKEN };
  }
  const result = await runCommand("gh", ["auth", "token"]);
  if (result.ok && result.stdout) {
    return { source: "gh auth token", token: result.stdout };
  }
  throw new Error(result.stderr || "set GITHUB_TOKEN or repair gh auth");
}

export class GitHubClient {
  constructor({ token, apiBase = "https://api.github.com", fetchImpl = fetch }) {
    this.token = token;
    this.apiBase = apiBase;
    this.fetchImpl = fetchImpl;
  }

  async request(pathname, options = {}) {
    const response = await this.fetchImpl(`${this.apiBase}${pathname}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: typeof data === "string" ? data : data?.message || response.statusText,
        data
      };
    }
    return { ok: true, status: response.status, data };
  }

  async paginatedRequest(pathname, { perPage = 100 } = {}) {
    const separator = pathname.includes("?") ? "&" : "?";
    const allData = [];
    let lastStatus = 200;

    for (let page = 1; ; page += 1) {
      const result = await this.request(`${pathname}${separator}per_page=${perPage}&page=${page}`);
      lastStatus = result.status;
      if (!result.ok) {
        return result;
      }
      if (!Array.isArray(result.data)) {
        return {
          ok: false,
          status: result.status,
          detail: "expected paginated GitHub response to be an array",
          data: result.data
        };
      }
      allData.push(...result.data);
      if (result.data.length < perPage) {
        break;
      }
    }

    return { ok: true, status: lastStatus, data: allData };
  }

  getLabel(repo, label) {
    return this.request(`/repos/${repo}/labels/${encodeURIComponent(label)}`);
  }

  createLabel(repo, label) {
    return this.request(`/repos/${repo}/labels`, {
      method: "POST",
      body: JSON.stringify({
        name: label,
        color: "5319e7",
        description: "Managed by the local Symphony runner"
      })
    });
  }

  async listIssuesByLabel(repo, label) {
    const result = await this.paginatedRequest(`/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}`);
    if (!result.ok) {
      throw new Error(result.detail);
    }
    return result.data;
  }

  addLabels(repo, issueNumber, labels) {
    return this.request(`/repos/${repo}/issues/${issueNumber}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels })
    });
  }

  removeLabel(repo, issueNumber, label) {
    return this.request(`/repos/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`, {
      method: "DELETE"
    });
  }

  createComment(repo, issueNumber, body) {
    return this.request(`/repos/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
  }

  listComments(repo, issueNumber) {
    return this.paginatedRequest(`/repos/${repo}/issues/${issueNumber}/comments`);
  }

  updateComment(repo, commentId, body) {
    return this.request(`/repos/${repo}/issues/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify({ body })
    });
  }
}
