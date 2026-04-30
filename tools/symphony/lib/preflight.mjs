import { requiredLabelNames } from "./config.mjs";
import { hasLabel, isPullRequest, labelNames } from "./issues.mjs";

const HIGH_RISK_WRITE_SET = [
  { name: "Track 1 claimed files", pattern: /track1|docs\/investigation\/track1-claims\.md/i },
  { name: "production app runtime", pattern: /^web\/|web\/|production app|runtime/i },
  { name: "Supabase migrations", pattern: /supabase\/migrations|migration|schema|policy|data/i },
  { name: "telemetry", pattern: /telemetry/i },
  { name: "prompt contracts", pattern: /prompt.*contract|aiPromptContract/i }
];

const EXPLICIT_HIGH_RISK_APPROVAL = /explicitly\s+approv(?:e|ed|es)|high-risk\s+scope\s+approved|approved\s+high-risk/i;

function normalizeSectionLine(line) {
  return line
    .replace(/^\s{0,3}[-*]\s+/, "")
    .replace(/^\s{0,3}\d+[.)]\s+/, "")
    .replace(/^`+|`+$/g, "")
    .trim();
}

function isHeading(line) {
  return /^\s{0,3}#{1,6}\s+\S/.test(line) || /^\s*\*\*[^*]+:\*\*\s*$/.test(line);
}

export function extractSectionItems(body, headingPattern) {
  const lines = String(body || "").split(/\r?\n/);
  const items = [];
  let inSection = false;

  for (const line of lines) {
    if (headingPattern.test(line)) {
      inSection = true;
      const inline = line.split(":").slice(1).join(":").trim();
      if (inline) {
        items.push(normalizeSectionLine(inline));
      }
      continue;
    }
    if (!inSection) {
      continue;
    }
    if (isHeading(line) && items.length > 0) {
      break;
    }
    const item = normalizeSectionLine(line);
    if (!item) {
      if (items.length > 0) {
        break;
      }
      continue;
    }
    items.push(item);
  }

  return items.filter(Boolean);
}

export function parseApprovedWriteSet(body) {
  return extractSectionItems(body, /approved\s+write\s+set|allowed\s+write\s+set/i);
}

export function parseAcceptanceCriteria(body) {
  return extractSectionItems(body, /acceptance\s+criteria|done\s+when|definition\s+of\s+done|done\s+condition/i);
}

export function highRiskWriteSetFindings({ body, approvedWriteSet }) {
  const explicitApproval = EXPLICIT_HIGH_RISK_APPROVAL.test(String(body || ""));
  return approvedWriteSet
    .flatMap((item) => HIGH_RISK_WRITE_SET
      .filter((scope) => scope.pattern.test(item))
      .map((scope) => ({ item, scope: scope.name, explicitApproval })))
    .filter((finding) => !finding.explicitApproval);
}

export function diagnoseIssueEligibility(issue, labels) {
  const reasons = [];
  const approvedWriteSet = parseApprovedWriteSet(issue.body);
  const acceptanceCriteria = parseAcceptanceCriteria(issue.body);
  const highRiskFindings = highRiskWriteSetFindings({ body: issue.body, approvedWriteSet });

  if (issue.state !== "open") {
    reasons.push("issue is not open");
  }
  if (isPullRequest(issue)) {
    reasons.push("pull request is not eligible");
  }
  if (!hasLabel(issue, labels.ready)) {
    reasons.push(`missing ${labels.ready} label`);
  }
  if (hasLabel(issue, labels.running)) {
    reasons.push(`running lock present via ${labels.running} label`);
  }
  if (hasLabel(issue, labels.blocked)) {
    reasons.push(`blocked by ${labels.blocked} label`);
  }
  if (hasLabel(issue, labels.humanReview)) {
    reasons.push(`waiting for human review via ${labels.humanReview} label`);
  }
  if (approvedWriteSet.length === 0) {
    reasons.push("missing approved write set");
  }
  if (acceptanceCriteria.length === 0) {
    reasons.push("missing acceptance criteria");
  }
  for (const finding of highRiskFindings) {
    reasons.push(`forbidden or high-risk scope requires explicit approval: ${finding.scope}`);
  }

  return {
    issue,
    labels: labelNames(issue),
    eligible: reasons.length === 0,
    reasons,
    approvedWriteSet,
    acceptanceCriteria,
    highRiskFindings
  };
}

export async function checkRequiredLabels({ client, repo, labels }) {
  const checks = [];
  for (const label of requiredLabelNames(labels)) {
    const result = await client.getLabel(repo, label);
    checks.push({
      label,
      ok: result.ok,
      status: result.status,
      reason: result.ok ? "" : result.status === 404 ? "missing" : result.detail
    });
  }
  return checks;
}

export async function runExecutePreflight({ repoRoot, config, client, repo, tokenInfo, planned, gitSnapshot }) {
  const labelChecks = await checkRequiredLabels({ client, repo, labels: config.labels });
  const failures = [];

  if (!gitSnapshot.clean) {
    failures.push("control checkout is not clean");
  }
  if (!gitSnapshot.originMain) {
    failures.push("origin/main is not resolvable");
  }
  if (!tokenInfo?.token) {
    failures.push("GitHub auth/token is not valid");
  }
  for (const label of labelChecks.filter((item) => !item.ok)) {
    failures.push(`required label ${label.label} is ${label.reason}`);
  }
  if (planned.eligibleCount !== 1 || planned.plans.length !== 1) {
    failures.push("execute requires exactly one eligible issue");
  }
  if (planned.runningCount > 0) {
    failures.push("execute refused while another issue is running");
  }
  for (const plan of planned.plans) {
    if ((plan.issue.approvedWriteSet || []).length === 0) {
      failures.push(`#${plan.issue.number} missing approved write set`);
    }
    if ((plan.issue.acceptanceCriteria || []).length === 0) {
      failures.push(`#${plan.issue.number} missing acceptance criteria`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    labelChecks,
    repoRoot
  };
}
