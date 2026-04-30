import assert from "node:assert/strict";
import test from "node:test";
import { GitHubClient } from "../lib/github.mjs";

test("listIssuesByLabel follows paginated GitHub results", async () => {
  const calls = [];
  const client = new GitHubClient({
    token: "test-token",
    apiBase: "https://example.test",
    fetchImpl: async (url) => {
      calls.push(url);
      const page = new URL(url).searchParams.get("page");
      const data = page === "1" ? Array.from({ length: 100 }, (_, index) => ({ number: index + 1 })) : [{ number: 101 }];
      return new Response(JSON.stringify(data), { status: 200 });
    }
  });

  const issues = await client.listIssuesByLabel("owner/repo", "symphony:running");

  assert.equal(issues.length, 101);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes("per_page=100"));
  assert.ok(calls[0].includes("page=1"));
  assert.ok(calls[1].includes("page=2"));
});

test("listComments follows paginated GitHub results", async () => {
  const client = new GitHubClient({
    token: "test-token",
    apiBase: "https://example.test",
    fetchImpl: async (url) => {
      const page = new URL(url).searchParams.get("page");
      const data = page === "1" ? Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })) : [];
      return new Response(JSON.stringify(data), { status: 200 });
    }
  });

  const result = await client.listComments("owner/repo", 44);

  assert.equal(result.ok, true);
  assert.equal(result.data.length, 100);
});
