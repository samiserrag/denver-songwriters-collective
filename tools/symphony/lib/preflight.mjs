import { requiredLabelNames } from "./config.mjs";
import { hasLabel, isPullRequest, labelNames } from "./issues.mjs";

const HIGH_RISK_WRITE_SET = [
  {
    name: "Track 1 claimed files",
    pattern: /track1|docs\/investigation\/track1-claims\.md/i,
    approvalPattern: /track\s*1|track1|docs\/investigation\/track1-claims\.md/i
  },
  {
    name: "symphony self-edit",
    pattern: /^tools\/symphony\/|tools\/symphony\//,
    approvalPattern: /tools\s*\/\s*symphony|symphony\s+self[-\s]?edit/i
  },
  {
    name: "production app runtime",
    pattern: /^web\/|web\/|production app|runtime/i,
    approvalPattern: /\bweb\/|production app|runtime/i
  },
  {
    name: "Supabase migrations",
    pattern: /supabase\/migrations|migration|schema|policy|data/i,
    approvalPattern: /supabase|migrations?|schema|policy|data/i
  },
  {
    name: "telemetry",
    pattern: /telemetry/i,
    approvalPattern: /telemetry/i
  },
  {
    name: "prompt contracts",
    pattern: /prompt.*contract|aiPromptContract/i,
    approvalPattern: /prompt.*contract|aiPromptContract/i
  }
];

const EXPLICIT_HIGH_RISK_APPROVAL = /explicitly\s+approv(?:e|ed|es)|explicit\s+high-risk\s+approval|high-risk\s+scope\s+approved|approved\s+high-risk/i;
const NEGATED_APPROVAL = /\b(?:not|never|without)\b.{0,48}\bapprov|\bdo\s+not\b.{0,48}\b(?:touch|change|modify|edit|approv)|\bno\b.{0,48}\b(?:changes?|edits?|touch|supabase|migrations?|web|track\s*1|telemetry|prompt\s+contracts?|approv)/i;
const VAGUE_WRITE_SET_PATTERNS = [
  /^(?:repo|repository)\s+files?$/i,
  /^whatever(?:\s+is)?\s+needed$/i,
  /^as\s+needed$/i,
  /^docs?$/i,
  /^source\s+code$/i,
  /^all\s+files?$/i,
  /^everything$/i,
  /^codebase$/i,
  /^project\s+files?$/i,
  /^any\s+files?$/i
];

function normalizeSectionLine(line) {
  return line
    .replace(/^\s{0,3}[-*]\s+/, "")
    .replace(/^\s{0,3}\d+[.)]\s+/, "")
    .replace(/^`+|`+$/g, "")
    .trim();
}

function parseSectionHeading(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || /^\s{0,3}[-*]\s+/.test(line) || /^\s{0,3}\d+[.)]\s+/.test(line)) {
    return null;
  }

  let content = "";
  const markdown = trimmed.match(/^#{1,6}\s+(.+)$/);
  const bold = trimmed.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
  const plain = trimmed.match(/^([A-Za-z][A-Za-z0-9 /_-]{1,80}):\s*(.*)$/);
  if (markdown) {
    content = markdown[1];
  } else if (bold) {
    content = `${bold[1]}${bold[2] ? `: ${bold[2]}` : ""}`;
  } else if (plain) {
    content = `${plain[1]}:${plain[2] ? ` ${plain[2]}` : ""}`;
  } else {
    return null;
  }

  const colonIndex = content.indexOf(":");
  if (colonIndex === -1) {
    return {
      heading: content.trim(),
      inline: ""
    };
  }
  return {
    heading: content.slice(0, colonIndex).trim(),
    inline: normalizeSectionLine(content.slice(colonIndex + 1))
  };
}

export function extractSectionItems(body, headingPattern) {
  const lines = String(body || "").split(/\r?\n/);
  const items = [];
  let inSection = false;

  for (const line of lines) {
    const heading = parseSectionHeading(line);
    if (heading) {
      if (inSection) {
        break;
      }
      if (!headingPattern.test(heading.heading)) {
        continue;
      }
      inSection = true;
      if (heading.inline) {
        items.push(heading.inline);
      }
      continue;
    }
    if (!inSection) {
      continue;
    }
    const item = normalizeSectionLine(line);
    if (item) {
      items.push(item);
    }
  }

  return items.filter(Boolean);
}

export function isConcreteWriteSetItem(item) {
  const normalized = normalizeSectionLine(item)
    .replace(/^["']|["']$/g, "")
    .replace(/[.;,]+$/g, "")
    .trim();
  if (!normalized || VAGUE_WRITE_SET_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  if (/^(?:no|not|do\s+not|don't)\b/i.test(normalized)) {
    return false;
  }
  return (
    normalized.includes("/") ||
    normalized.includes("*") ||
    normalized === ".gitignore" ||
    /^[A-Za-z0-9_.-]+\.[A-Za-z0-9]+$/.test(normalized)
  );
}

export function parseApprovedWriteSetDetails(body) {
  const rawItems = extractSectionItems(body, /^(approved|allowed)\s+write\s+set$/i);
  const items = rawItems.filter(isConcreteWriteSetItem);
  const invalidItems = rawItems.filter((item) => !isConcreteWriteSetItem(item));
  return { rawItems, items, invalidItems };
}

export function parseApprovedWriteSet(body) {
  return parseApprovedWriteSetDetails(body).items;
}

export function parseAcceptanceCriteria(body) {
  return extractSectionItems(body, /^(acceptance\s+criteria|done\s+when|definition\s+of\s+done|done\s+condition)$/i);
}

function normalizeScopeText(value) {
  return String(value || "").toLowerCase().replace(/[`"'*]/g, "").trim();
}

function lineMentionsRiskyScope(line, item, scope) {
  const normalizedLine = normalizeScopeText(line);
  const normalizedItem = normalizeScopeText(item);
  return (
    (normalizedItem && normalizedLine.includes(normalizedItem)) ||
    scope.approvalPattern.test(line)
  );
}

function hasSpecificHighRiskApproval({ body, item, scope }) {
  return String(body || "")
    .split(/\r?\n/)
    .some((line) => (
      EXPLICIT_HIGH_RISK_APPROVAL.test(line) &&
      !NEGATED_APPROVAL.test(line) &&
      lineMentionsRiskyScope(line, item, scope)
    ));
}

export function highRiskWriteSetFindings({ body, approvedWriteSet }) {
  return approvedWriteSet
    .flatMap((item) => HIGH_RISK_WRITE_SET
      .filter((scope) => scope.pattern.test(item))
      .map((scope) => ({
        item,
        scope: scope.name,
        explicitApproval: hasSpecificHighRiskApproval({ body, item, scope })
      })))
    .filter((finding) => !finding.explicitApproval);
}

export function diagnoseIssueEligibility(issue, labels) {
  const reasons = [];
  const approvedWriteSetDetails = parseApprovedWriteSetDetails(issue.body);
  const approvedWriteSet = approvedWriteSetDetails.items;
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
  if (approvedWriteSetDetails.invalidItems.length > 0) {
    reasons.push(`ambiguous approved write set entries: ${approvedWriteSetDetails.invalidItems.join(", ")}`);
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
    invalidApprovedWriteSet: approvedWriteSetDetails.invalidItems,
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
