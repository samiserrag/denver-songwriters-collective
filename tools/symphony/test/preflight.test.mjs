import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LABELS } from "../lib/config.mjs";
import {
  diagnoseIssueEligibility,
  parseAcceptanceCriteria,
  parseApprovedWriteSet,
  runExecutePreflight
} from "../lib/preflight.mjs";

const approvedBody = [
  "## Approved write set",
  "- tools/symphony/**",
  "",
  "## Acceptance criteria",
  "- The runner writes a manifest.",
  "- Tests pass."
].join("\n");

test("parseApprovedWriteSet and parseAcceptanceCriteria read issue sections", () => {
  assert.deepEqual(parseApprovedWriteSet(approvedBody), ["tools/symphony/**"]);
  assert.deepEqual(parseAcceptanceCriteria(approvedBody), ["The runner writes a manifest.", "Tests pass."]);
});

test("diagnoseIssueEligibility reports deterministic skip reasons", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 12,
    title: "Missing metadata",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: "Please do work."
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, false);
  assert.deepEqual(diagnostic.reasons, ["missing approved write set", "missing acceptance criteria"]);
});

test("diagnoseIssueEligibility blocks high-risk write sets without explicit approval", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 13,
    title: "Risky",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- web/src/app/page.tsx",
      "",
      "## Acceptance criteria",
      "- Page updates."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, false);
  assert.match(diagnostic.reasons.join("\n"), /high-risk scope/);
});

test("runExecutePreflight fails closed on dirty checkout and multiple eligible issues", async () => {
  const client = {
    async getLabel() {
      return { ok: true };
    }
  };
  const preflight = await runExecutePreflight({
    repoRoot: "/repo",
    config: {
      labels: DEFAULT_LABELS
    },
    client,
    repo: "owner/repo",
    tokenInfo: { token: "github_pat_SECRET" },
    planned: {
      runningCount: 0,
      eligibleCount: 2,
      plans: [
        {
          issue: {
            number: 1,
            approvedWriteSet: ["tools/symphony/**"],
            acceptanceCriteria: ["Done"]
          }
        }
      ]
    },
    gitSnapshot: {
      clean: false,
      originMain: null
    }
  });

  assert.equal(preflight.ok, false);
  assert.match(preflight.failures.join("\n"), /control checkout is not clean/);
  assert.match(preflight.failures.join("\n"), /origin\/main is not resolvable/);
  assert.match(preflight.failures.join("\n"), /exactly one eligible issue/);
});
