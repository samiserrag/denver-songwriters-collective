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

test("parseApprovedWriteSet stops at the next section even when empty", () => {
  const body = [
    "## Approved write set",
    "",
    "## Acceptance criteria",
    "- Done."
  ].join("\n");

  assert.deepEqual(parseApprovedWriteSet(body), []);
  assert.deepEqual(parseAcceptanceCriteria(body), ["Done."]);
});

test("diagnoseIssueEligibility rejects vague approved write set entries", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 14,
    title: "Vague scope",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- repo files",
      "- whatever is needed",
      "- docs",
      "- source code",
      "- all files",
      "",
      "## Acceptance criteria",
      "- Done."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, false);
  assert.match(diagnostic.reasons.join("\n"), /missing approved write set/);
  assert.match(diagnostic.reasons.join("\n"), /ambiguous approved write set entries/);
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

test("diagnoseIssueEligibility requires high-risk approval to mention the risky scope", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 15,
    title: "Unrelated approval",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- web/src/app/page.tsx",
      "",
      "## Acceptance criteria",
      "- Page updates.",
      "",
      "Telemetry is explicitly approved."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, false);
  assert.match(diagnostic.reasons.join("\n"), /production app runtime/);
});

test("diagnoseIssueEligibility rejects negated high-risk approval wording", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 16,
    title: "Negated approval",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- web/src/app/page.tsx",
      "",
      "## Acceptance criteria",
      "- Page updates.",
      "",
      "web/src/app/page.tsx is not explicitly approved."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, false);
  assert.match(diagnostic.reasons.join("\n"), /production app runtime/);
});

test("diagnoseIssueEligibility accepts specific positive high-risk approval", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 17,
    title: "Specific approval",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- web/src/app/page.tsx",
      "",
      "## Acceptance criteria",
      "- Page updates.",
      "",
      "web/src/app/page.tsx is explicitly approved for this issue."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, true);
});

test("diagnoseIssueEligibility blocks symphony self-edit without high-risk approval", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 18,
    title: "Self edit",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- tools/symphony/lib/preflight.mjs",
      "",
      "## Acceptance criteria",
      "- Preflight blocks Symphony self-edits without explicit high-risk approval."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, false);
  assert.match(diagnostic.reasons.join("\n"), /symphony self-edit/);
});

test("diagnoseIssueEligibility allows symphony self-edit with explicit high-risk approval", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 19,
    title: "Approved self edit",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- tools/symphony/lib/preflight.mjs",
      "",
      "## Acceptance criteria",
      "- Preflight blocks Symphony self-edits unless explicitly approved.",
      "",
      "Explicitly approved high-risk scope: tools/symphony self-edit."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, true);
});

test("diagnoseIssueEligibility blocks symphony self-edit with negated approval", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 20,
    title: "Negated self edit",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- tools/symphony/lib/preflight.mjs",
      "",
      "## Acceptance criteria",
      "- Preflight blocks negated Symphony self-edit approval.",
      "",
      "Do not approve tools/symphony self-edit."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, false);
  assert.match(diagnostic.reasons.join("\n"), /symphony self-edit/);
});

test("diagnoseIssueEligibility requires approval for each high-risk scope", () => {
  const bodyWithBothApprovals = [
    "## Approved write set",
    "- tools/symphony/**",
    "- web/src/app/page.tsx",
    "",
    "## Acceptance criteria",
    "- Preflight blocks high-risk scopes unless each one is explicitly approved.",
    "",
    "Explicitly approved high-risk scope: tools/symphony self-edit.",
    "Explicitly approved high-risk scope: web/** production app runtime."
  ].join("\n");
  const bodyWithOneApproval = [
    "## Approved write set",
    "- tools/symphony/**",
    "- web/src/app/page.tsx",
    "",
    "## Acceptance criteria",
    "- Preflight blocks high-risk scopes unless each one is explicitly approved.",
    "",
    "Explicitly approved high-risk scope: tools/symphony self-edit."
  ].join("\n");

  assert.equal(diagnoseIssueEligibility({
    number: 21,
    title: "Both high-risk scopes approved",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: bodyWithBothApprovals
  }, DEFAULT_LABELS).eligible, true);

  const partialApproval = diagnoseIssueEligibility({
    number: 22,
    title: "One high-risk scope approved",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: bodyWithOneApproval
  }, DEFAULT_LABELS);

  assert.equal(partialApproval.eligible, false);
  assert.match(partialApproval.reasons.join("\n"), /production app runtime/);
});

test("diagnoseIssueEligibility does not treat runbook docs as symphony self-edit", () => {
  const diagnostic = diagnoseIssueEligibility({
    number: 23,
    title: "Runbook docs",
    state: "open",
    labels: [{ name: DEFAULT_LABELS.ready }],
    body: [
      "## Approved write set",
      "- docs/runbooks/symphony.md",
      "",
      "## Acceptance criteria",
      "- The runbook documents the requested behavior."
    ].join("\n")
  }, DEFAULT_LABELS);

  assert.equal(diagnostic.eligible, true);
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
