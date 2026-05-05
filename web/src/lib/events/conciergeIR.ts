/**
 * Concierge Intermediate Representation (IR) — Lane 9 PR 2.
 *
 * Pure types and shape constants. No runtime logic, no I/O. The IR is the
 * contract between the deterministic schedule parser and the deterministic
 * validator. It is request-scoped and in-memory only — never persisted, never
 * written to any table.
 *
 * Shape derives verbatim from `docs/investigation/concierge-ir-source-handling.md`
 * §2 (merged via PR #291). Field domains for `source_kind` are deliberately
 * subset-compatible with Lane 6 Step 3a `event_sources.type` per §10.
 */

export type SourceKind =
  | "flyer_image"
  | "webpage"
  | "pasted_page_text"
  | "social_post"
  | "conversation"
  | "existing_event_edit";

export const SOURCE_KINDS: readonly SourceKind[] = [
  "flyer_image",
  "webpage",
  "pasted_page_text",
  "social_post",
  "conversation",
  "existing_event_edit",
] as const;

export type ConciergeSharedTime = {
  start: string;
  end: string | null;
};

export type ConciergeSharedFacts = {
  venue: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  time: ConciergeSharedTime | null;
  cost: string | null;
  signup: string | null;
  membership: string | null;
  age_policy: string | null;
};

export const SHARED_FACTS_KEYS = [
  "venue",
  "address",
  "city",
  "state",
  "time",
  "cost",
  "signup",
  "membership",
  "age_policy",
] as const;

export type ConciergeOccurrence = {
  date: string;
  start_time: string | null;
  end_time: string | null;
  lineup: string[];
  per_date_notes: string | null;
};

export const OCCURRENCE_KEYS = [
  "date",
  "start_time",
  "end_time",
  "lineup",
  "per_date_notes",
] as const;

export type ConciergeInferredFact = {
  field: string;
  value: unknown;
  basis: string;
};

export type ConciergeConflict = {
  field: string;
  values: unknown[];
  basis: string;
};

export type ConciergeSuggestedQuestion = {
  field: string;
  reason: string;
};

export type ConciergeProvenanceEntry = {
  source_pointer: string;
  evidence_text: string;
};

export type ConciergeIR = {
  source_kind: SourceKind;
  source_url: string | null;
  event_family: string | null;
  title: string | null;

  shared_facts: ConciergeSharedFacts;
  occurrences: ConciergeOccurrence[];

  inferred_facts: ConciergeInferredFact[];
  conflicts: ConciergeConflict[];
  true_unknowns: string[];
  suggested_questions: ConciergeSuggestedQuestion[];

  provenance: Record<string, ConciergeProvenanceEntry>;
};

export const CONCIERGE_IR_KEYS = [
  "source_kind",
  "source_url",
  "event_family",
  "title",
  "shared_facts",
  "occurrences",
  "inferred_facts",
  "conflicts",
  "true_unknowns",
  "suggested_questions",
  "provenance",
] as const;

export type ConciergeInput = {
  source_kind: SourceKind;
  source_url?: string | null;
  raw_text: string;
  prior_ir?: ConciergeIR | null;
  today_iso?: string | null;
};

export function emptySharedFacts(): ConciergeSharedFacts {
  return {
    venue: null,
    address: null,
    city: null,
    state: null,
    time: null,
    cost: null,
    signup: null,
    membership: null,
    age_policy: null,
  };
}

export function emptyConciergeIR(source_kind: SourceKind, source_url: string | null = null): ConciergeIR {
  return {
    source_kind,
    source_url,
    event_family: null,
    title: null,
    shared_facts: emptySharedFacts(),
    occurrences: [],
    inferred_facts: [],
    conflicts: [],
    true_unknowns: [],
    suggested_questions: [],
    provenance: {},
  };
}
