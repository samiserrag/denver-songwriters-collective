/**
 * Concierge deterministic validator — Lane 9 PR 2.
 *
 * Pure function over `ConciergeIR` + raw source. Implements the 9 gates from
 * the design doc §4 (merged via PR #291). Output is the **question ledger** —
 * the authoritative list of what to ask the user. The model never adds to
 * this list; the model only writes prose.
 *
 * Gates 1–9:
 *   1. Schema conformance.
 *   2. Source coverage check.
 *   3. Question-vs-source coverage.
 *   4. Internal-question rejection (extends #285's regex to concierge output).
 *   5. Self-contradiction check.
 *   6. Cross-turn ledger persistence.
 *   7. Year/date suppression (reuses #285's redundant-year regex).
 *   8. Search query quality.
 *   9. external_url discipline (Maps URL exclusion).
 */

import {
  CONCIERGE_IR_KEYS,
  SHARED_FACTS_KEYS,
  SOURCE_KINDS,
  type ConciergeIR,
  type ConciergeOccurrence,
} from "@/lib/events/conciergeIR";
import {
  INTERNAL_DRAFT_VERIFIER_QUESTION_PATTERN,
  REDUNDANT_YEAR_CONFIRMATION_PATTERN,
} from "@/lib/events/interpreterPostprocess";

const CUSTOM_DATES_PATTERN = /\bcustom[\s_-]?dates?\b/i;

const NEXT_DATE_PATTERN =
  /\b(?:what\s+date(?:\s+(?:should|will|does))?\s+(?:this|it)\s+(?:happen|occur|take\s+place)?\s+next|when\s+(?:should|will|does)\s+(?:this|it)\s+next)/i;

// Maps and search-result URLs the concierge must not adopt as external_url.
const MAPS_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?google\.[a-z.]+\/maps/i,
  /^https?:\/\/maps\.google\.[a-z.]+/i,
  /^https?:\/\/goo\.gl\/maps/i,
  /^https?:\/\/maps\.app\.goo\.gl/i,
  /^https?:\/\/maps\.apple\.com/i,
  /^https?:\/\/(?:www\.)?bing\.com\/maps/i,
];

const SEARCH_RESULT_URL_PATTERNS = [
  /^https?:\/\/(?:www\.)?google\.[a-z.]+\/search/i,
  /^https?:\/\/(?:www\.)?bing\.com\/search/i,
  /^https?:\/\/(?:www\.)?duckduckgo\.com\/\?/i,
];

const PROSE_NOISE_TOKENS = new Set([
  "here",
  "this",
  "that",
  "the",
  "those",
  "these",
  "next",
  "now",
  "soon",
  "lately",
  "recently",
  "today",
  "tomorrow",
  "yesterday",
]);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_PATTERN = /^\d{2}:\d{2}$/;

// Generic patterns the source-coverage check uses to detect facts the parser
// may have missed.
const SOURCE_VENUE_HINT_PATTERN = /\b(?:at|@|venue:?)\s+([A-Z][\w' &\-]{2,40})/;
const SOURCE_DATE_HINT_PATTERN = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}\b/i;
const SOURCE_TIME_HINT_PATTERN = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;

export const QUESTION_LEDGER_FIELDS = [
  "title",
  "venue",
  "address",
  "city",
  "state",
  "date",
  "time",
  "cost",
  "signup",
  "membership",
  "age_policy",
  "external_url",
  "lineup",
  "custom_dates",
] as const;

export type QuestionLedgerField = (typeof QUESTION_LEDGER_FIELDS)[number];

export type LedgerQuestion = {
  field: QuestionLedgerField | string;
  reason: string;
};

export type ValidatorReason = {
  gate: number;
  field: string;
  detail: string;
};

export type ValidationResult = {
  questionLedger: LedgerQuestion[];
  halt: boolean;
  reasons: ValidatorReason[];
};

export type ValidatorInput = {
  ir: ConciergeIR;
  rawSource: string;
  // Optional bag the model may have produced; used by gates 4/8 to filter.
  candidateQuestions?: LedgerQuestion[];
  candidateSearchQueries?: string[];
  candidateExternalUrl?: string | null;
  todayIso?: string | null;
};

function pushReason(out: ValidatorReason[], gate: number, field: string, detail: string): void {
  out.push({ gate, field, detail });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkSchemaConformance(ir: ConciergeIR, reasons: ValidatorReason[]): boolean {
  const irKeys = Object.keys(ir).sort();
  const expected = [...CONCIERGE_IR_KEYS].sort();
  const missing = expected.filter((k) => !irKeys.includes(k));
  if (missing.length > 0) {
    pushReason(reasons, 1, "ir", `missing keys: ${missing.join(", ")}`);
    return false;
  }

  if (!SOURCE_KINDS.includes(ir.source_kind)) {
    pushReason(reasons, 1, "source_kind", `unknown source_kind: ${ir.source_kind}`);
    return false;
  }

  if (!isPlainObject(ir.shared_facts)) {
    pushReason(reasons, 1, "shared_facts", "not an object");
    return false;
  }
  const sharedKeys = Object.keys(ir.shared_facts).sort();
  const sharedExpected = [...SHARED_FACTS_KEYS].sort();
  if (
    sharedKeys.length !== sharedExpected.length ||
    sharedKeys.some((k, i) => k !== sharedExpected[i])
  ) {
    pushReason(reasons, 1, "shared_facts", "key set mismatch");
    return false;
  }

  if (!Array.isArray(ir.occurrences)) {
    pushReason(reasons, 1, "occurrences", "not an array");
    return false;
  }
  for (const occ of ir.occurrences) {
    if (!isPlainObject(occ)) {
      pushReason(reasons, 1, "occurrences", "occurrence not an object");
      return false;
    }
    if (!ISO_DATE_PATTERN.test(occ.date)) {
      pushReason(reasons, 1, "occurrences", `bad ISO date: ${occ.date}`);
      return false;
    }
    if (occ.start_time !== null && !ISO_TIME_PATTERN.test(occ.start_time)) {
      pushReason(reasons, 1, "occurrences", `bad start_time: ${occ.start_time}`);
      return false;
    }
    if (occ.end_time !== null && !ISO_TIME_PATTERN.test(occ.end_time)) {
      pushReason(reasons, 1, "occurrences", `bad end_time: ${occ.end_time}`);
      return false;
    }
    if (!Array.isArray(occ.lineup)) {
      pushReason(reasons, 1, "occurrences", "lineup not an array");
      return false;
    }
  }

  for (const requiredArrayKey of [
    "inferred_facts",
    "conflicts",
    "true_unknowns",
    "suggested_questions",
  ] as const) {
    if (!Array.isArray(ir[requiredArrayKey])) {
      pushReason(reasons, 1, requiredArrayKey, "not an array");
      return false;
    }
  }
  if (!isPlainObject(ir.provenance)) {
    pushReason(reasons, 1, "provenance", "not an object");
    return false;
  }
  return true;
}

function checkSourceCoverage(
  ir: ConciergeIR,
  rawSource: string,
  reasons: ValidatorReason[],
): boolean {
  let ok = true;
  // Venue: if the source mentions a venue-shaped phrase but IR has no venue.
  if (!ir.shared_facts.venue) {
    const venueHint = SOURCE_VENUE_HINT_PATTERN.exec(rawSource);
    if (venueHint && venueHint[1]) {
      pushReason(
        reasons,
        2,
        "venue",
        `source mentions venue (${venueHint[1].trim()}) but IR has no venue`,
      );
      ok = false;
    }
  }
  // Date: if the source contains a month-day pattern but IR has no occurrences.
  if (ir.occurrences.length === 0) {
    if (SOURCE_DATE_HINT_PATTERN.test(rawSource)) {
      pushReason(reasons, 2, "date", "source contains date patterns but IR has zero occurrences");
      ok = false;
    }
  }
  // Time: if the source contains a clock time but IR has no shared time AND no
  // per-occurrence times.
  const hasAnyTime =
    !!ir.shared_facts.time ||
    ir.occurrences.some((o) => o.start_time !== null || o.end_time !== null);
  if (!hasAnyTime && SOURCE_TIME_HINT_PATTERN.test(rawSource)) {
    pushReason(reasons, 2, "time", "source contains a clock time but IR has none");
    ok = false;
  }
  return ok;
}

function isFieldCovered(field: string, ir: ConciergeIR, rawSource: string): boolean {
  switch (field) {
    case "venue":
      return !!ir.shared_facts.venue || !!SOURCE_VENUE_HINT_PATTERN.exec(rawSource);
    case "address":
      return !!ir.shared_facts.address;
    case "city":
      return !!ir.shared_facts.city;
    case "state":
      return !!ir.shared_facts.state;
    case "time":
      return (
        !!ir.shared_facts.time ||
        ir.occurrences.some((o) => o.start_time !== null || o.end_time !== null) ||
        SOURCE_TIME_HINT_PATTERN.test(rawSource)
      );
    case "date":
      return ir.occurrences.length > 0 || SOURCE_DATE_HINT_PATTERN.test(rawSource);
    case "title":
      return !!ir.title;
    case "cost":
      return !!ir.shared_facts.cost;
    case "signup":
      return !!ir.shared_facts.signup;
    case "membership":
      return !!ir.shared_facts.membership;
    case "age_policy":
      return !!ir.shared_facts.age_policy;
    case "lineup":
      return ir.occurrences.some((o) => o.lineup.length > 0);
    case "external_url":
      return !!ir.source_url;
    default:
      return false;
  }
}

function questionText(q: LedgerQuestion): string {
  return [q.field, q.reason].filter(Boolean).join(" ");
}

function isInternalQuestion(q: LedgerQuestion): boolean {
  return INTERNAL_DRAFT_VERIFIER_QUESTION_PATTERN.test(questionText(q));
}

function isCustomDatesQuestion(q: LedgerQuestion): boolean {
  return q.field === "custom_dates" || CUSTOM_DATES_PATTERN.test(questionText(q));
}

function isNextDateQuestion(q: LedgerQuestion): boolean {
  return NEXT_DATE_PATTERN.test(questionText(q));
}

function isYearConfirmationQuestion(q: LedgerQuestion): boolean {
  return REDUNDANT_YEAR_CONFIRMATION_PATTERN.test(questionText(q));
}

function isCurrentYearFutureOccurrence(
  occurrences: ConciergeOccurrence[],
  todayIso: string | null | undefined,
): boolean {
  if (!todayIso || !ISO_DATE_PATTERN.test(todayIso)) return false;
  const todayYear = todayIso.slice(0, 4);
  return occurrences.some((o) => {
    if (!ISO_DATE_PATTERN.test(o.date)) return false;
    if (o.date.slice(0, 4) !== todayYear) return false;
    return o.date >= todayIso;
  });
}

export function applyCrossTurnLedger(
  current: ConciergeIR,
  prior: ConciergeIR | null | undefined,
): ConciergeIR {
  if (!prior) return current;
  const merged: ConciergeIR = {
    ...current,
    title: current.title ?? prior.title,
    event_family: current.event_family ?? prior.event_family,
    source_url: current.source_url ?? prior.source_url,
    shared_facts: { ...current.shared_facts },
    occurrences: current.occurrences.length > 0 ? current.occurrences : prior.occurrences,
    inferred_facts: [...current.inferred_facts],
    conflicts: [...current.conflicts],
    true_unknowns: [...current.true_unknowns],
    suggested_questions: [...current.suggested_questions],
    provenance: { ...current.provenance },
  };
  for (const k of SHARED_FACTS_KEYS) {
    if (merged.shared_facts[k] == null && prior.shared_facts[k] != null) {
      (merged.shared_facts as Record<string, unknown>)[k] = prior.shared_facts[k];
      merged.inferred_facts.push({
        field: `shared_facts.${k}`,
        value: prior.shared_facts[k],
        basis: "carried_from_prior_turn",
      });
    }
  }
  return merged;
}

function isMapsOrSearchUrl(url: string): boolean {
  return (
    MAPS_URL_PATTERNS.some((p) => p.test(url)) ||
    SEARCH_RESULT_URL_PATTERNS.some((p) => p.test(url))
  );
}

function searchQueryHasSignal(
  query: string,
  ir: ConciergeIR,
): boolean {
  const lowered = query.toLowerCase();
  const tokens = lowered.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return false;
  // Only-prose-noise tokens fail the gate.
  const meaningful = tokens.filter((t) => !PROSE_NOISE_TOKENS.has(t));
  if (meaningful.length === 0) return false;
  const titleWords = (ir.title ?? "").toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  if (titleWords.some((w) => lowered.includes(w))) return true;
  const venue = ir.shared_facts.venue ?? null;
  if (venue && lowered.includes(venue.toLowerCase())) return true;
  if (ir.source_url) {
    const m = /^https?:\/\/([^\/]+)/i.exec(ir.source_url);
    if (m && m[1] && lowered.includes(m[1].replace(/^www\./, "").toLowerCase())) return true;
  }
  const dateTokenPresent = ir.occurrences.some((o) => lowered.includes(o.date)) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(query) ||
    SOURCE_DATE_HINT_PATTERN.test(query);
  if (dateTokenPresent) return true;
  return false;
}

export function validate(input: ValidatorInput): ValidationResult {
  const reasons: ValidatorReason[] = [];
  const ledger: LedgerQuestion[] = [];
  let halt = false;

  // Gate 1 — Schema conformance. Halt on failure.
  const schemaOk = checkSchemaConformance(input.ir, reasons);
  if (!schemaOk) {
    return { questionLedger: [], halt: true, reasons };
  }

  // Gate 2 — Source coverage check. Halt on failure (escalation per §8).
  const coverageOk = checkSourceCoverage(input.ir, input.rawSource, reasons);
  if (!coverageOk) {
    halt = true;
  }

  const candidates: LedgerQuestion[] = [
    ...input.ir.suggested_questions.map((q) => ({ field: q.field, reason: q.reason })),
    ...(input.candidateQuestions ?? []),
  ];

  for (const candidate of candidates) {
    // Gate 4 — Internal-question rejection. Silent drop.
    if (isInternalQuestion(candidate)) {
      pushReason(reasons, 4, candidate.field, "matches INTERNAL_DRAFT_VERIFIER_QUESTION_PATTERN");
      continue;
    }
    // Gate 5 — Self-contradiction. If we have any occurrences, drop date /
    // custom-dates / next-date questions.
    if (input.ir.occurrences.length > 0) {
      if (isNextDateQuestion(candidate) || isCustomDatesQuestion(candidate)) {
        pushReason(reasons, 5, candidate.field, "occurrences exist; date question contradicts IR");
        continue;
      }
    }
    // Gate 7 — Year/date suppression for current-year future dates.
    if (isYearConfirmationQuestion(candidate) && isCurrentYearFutureOccurrence(input.ir.occurrences, input.todayIso)) {
      pushReason(reasons, 7, candidate.field, "current-year future occurrence; year confirmation redundant");
      continue;
    }
    // Gate 3 — Question-vs-source coverage. Drop if the field is already
    // populated in IR or detected in the raw source.
    if (isFieldCovered(candidate.field, input.ir, input.rawSource)) {
      pushReason(reasons, 3, candidate.field, "field already covered by IR or source");
      continue;
    }
    ledger.push(candidate);
  }

  // Gate 8 — Search query quality.
  const validatedSearchQueries: string[] = [];
  for (const query of input.candidateSearchQueries ?? []) {
    if (searchQueryHasSignal(query, input.ir)) {
      validatedSearchQueries.push(query);
    } else {
      pushReason(reasons, 8, "search_query", `dropped: ${query}`);
    }
  }

  // Gate 9 — external_url discipline.
  let validatedExternalUrl: string | null | undefined = input.candidateExternalUrl;
  if (validatedExternalUrl && isMapsOrSearchUrl(validatedExternalUrl)) {
    pushReason(reasons, 9, "external_url", `dropped maps/search URL: ${validatedExternalUrl}`);
    validatedExternalUrl = null;
  }
  // Carry the validated value forward only as a reason — actual write happens
  // in PR 3+ when this is wired into a route.
  if (validatedExternalUrl !== undefined) {
    if (validatedExternalUrl === null) {
      pushReason(reasons, 9, "external_url", "ok: cleared");
    } else {
      pushReason(reasons, 9, "external_url", `ok: ${validatedExternalUrl}`);
    }
  }

  return {
    questionLedger: ledger,
    halt,
    reasons,
  };
}

export function dropOutOfLedgerQuestions(
  modelQuestions: LedgerQuestion[],
  ledger: LedgerQuestion[],
  ir: ConciergeIR,
  rawSource: string,
): LedgerQuestion[] {
  const allowedFields = new Set(ledger.map((q) => q.field));
  return modelQuestions.filter((q) => {
    if (isInternalQuestion(q)) return false;
    if (isFieldCovered(q.field, ir, rawSource)) return false;
    return allowedFields.has(q.field);
  });
}

export function filterSearchQueries(
  queries: string[],
  ir: ConciergeIR,
): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const q of queries) {
    if (searchQueryHasSignal(q, ir)) kept.push(q);
    else dropped.push(q);
  }
  return { kept, dropped };
}

export const __validatorTest__ = {
  isMapsOrSearchUrl,
  searchQueryHasSignal,
  isFieldCovered,
  isInternalQuestion,
  isNextDateQuestion,
  isCustomDatesQuestion,
  isYearConfirmationQuestion,
  isCurrentYearFutureOccurrence,
};
