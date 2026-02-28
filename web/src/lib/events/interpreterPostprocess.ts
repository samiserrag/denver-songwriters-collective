/**
 * Shared deterministic post-processing helpers for the interpreter pipeline.
 *
 * Used by both the interpreter route (route.ts) and the fixture regression
 * tests. Extracting these into a shared module eliminates code duplication
 * and prevents logic drift between production and test code.
 */

// ---------------------------------------------------------------------------
// Recurrence intent guard (Phase 7B)
// ---------------------------------------------------------------------------

export const RECURRENCE_INTENT_PATTERNS = [
  /\bevery\b/i,
  /\bweekly\b/i,
  /\bbiweekly\b/i,
  /\bbi-weekly\b/i,
  /\bmonthly\b/i,
  /\brecurring\b/i,
  /\bseries\b/i,
  /\brepeating\b/i,
  /\b(?:1st|2nd|3rd|4th|first|second|third|fourth|last)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bevery\s+other\b/i,
];

export function detectsRecurrenceIntent(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): boolean {
  const intentText = [message, ...history.filter((h) => h.role === "user").map((h) => h.content)]
    .join("\n");
  if (!intentText.trim()) return false;
  return RECURRENCE_INTENT_PATTERNS.some((pattern) => pattern.test(intentText));
}

// ---------------------------------------------------------------------------
// Time semantics: doors vs performance start (Phase 7D)
// ---------------------------------------------------------------------------

export const DOORS_PATTERN = /\bdoors?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
export const PERFORMANCE_START_PATTERN =
  /\b(?:first\s+performance|show|music)\s+(?:starts?\s+)?(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;

export function parseTimeString(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3];
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
}

export function applyTimeSemantics(
  draft: Record<string, unknown>,
  message: string,
): void {
  const doorsMatch = message.match(DOORS_PATTERN);
  const performanceMatch = message.match(PERFORMANCE_START_PATTERN);

  if (doorsMatch && performanceMatch) {
    const performanceTime = parseTimeString(performanceMatch[1]);
    if (performanceTime) {
      draft.start_time = performanceTime;
    }
  }
}

// ---------------------------------------------------------------------------
// Clarification reducer: single blocking question per turn (Phase 7C)
// ---------------------------------------------------------------------------

export const BLOCKING_FIELD_PRIORITY = [
  "event_type",
  "title",
  "start_date",
  "start_time",
  "venue_id",
  "online_url",
  "date_key",
  "series_mode",
  "signup_mode",
];

const FIELD_PROMPTS: Record<string, string> = {
  event_type: "What type of event is this? (open mic, showcase, workshop, jam session, etc.)",
  title: "What would you like to call this event?",
  start_date: "What date will this event take place?",
  start_time: "What time does the event start?",
  venue_id: "Where will this event be held?",
  online_url: "Please provide the online event URL (Zoom, YouTube, etc.).",
  series_mode: "Is this a one-time event or a recurring series?",
};

export function reduceClarificationToSingle(
  blockingFields: string[],
  clarificationQuestion: string | null
): { blockingFields: string[]; clarificationQuestion: string | null } {
  if (blockingFields.length <= 1) {
    return { blockingFields, clarificationQuestion };
  }

  let primary: string | null = null;
  for (const field of BLOCKING_FIELD_PRIORITY) {
    if (blockingFields.includes(field)) {
      primary = field;
      break;
    }
  }
  if (!primary) {
    primary = blockingFields[0];
  }

  return {
    blockingFields: [primary],
    clarificationQuestion: FIELD_PROMPTS[primary] || `Please provide ${primary} to continue.`,
  };
}

// ---------------------------------------------------------------------------
// Location mode normalization (DB-safe canonical values)
// ---------------------------------------------------------------------------

type CanonicalLocationMode = "venue" | "online" | "hybrid";

export function normalizeInterpreterLocationMode(
  value: unknown,
  fallback: CanonicalLocationMode = "venue"
): CanonicalLocationMode {
  if (typeof value !== "string") return fallback;
  const mode = value.trim().toLowerCase();

  if (
    mode === "venue" ||
    mode === "in_person" ||
    mode === "in-person" ||
    mode === "in_person_custom" ||
    mode === "in_person_venue" ||
    mode === "physical" ||
    mode === "onsite" ||
    mode === "on_site" ||
    mode === "custom" ||
    mode === "custom_location"
  ) {
    return "venue";
  }

  if (
    mode === "online" ||
    mode === "virtual" ||
    mode === "zoom" ||
    mode === "livestream" ||
    mode === "live_stream" ||
    mode === "remote"
  ) {
    return "online";
  }

  if (mode === "hybrid") return "hybrid";
  return fallback;
}

// ---------------------------------------------------------------------------
// Venue/custom location mutual exclusivity (Phase 7D)
// ---------------------------------------------------------------------------

export function enforceVenueCustomExclusivity(draft: Record<string, unknown>): void {
  if (typeof draft.venue_id === "string" && draft.venue_id.trim().length > 0) {
    draft.custom_location_name = null;
    draft.custom_address = null;
    draft.custom_city = null;
    draft.custom_state = null;
    draft.custom_latitude = null;
    draft.custom_longitude = null;
  }
}

// ---------------------------------------------------------------------------
// Multi-turn create context lock (preserve previously confirmed fields)
// ---------------------------------------------------------------------------

const TITLE_INTENT_PATTERN =
  /\b(title|name\s+it|call\s+it|rename|change\s+title)\b/i;
const RECURRENCE_OVERRIDE_PATTERN =
  /\b(one[-\s]?time|single\s+event|not\s+recurring|stop\s+recurring|weekly|bi[-\s]?weekly|monthly|recurring|series|every)\b/i;
const END_TIME_CLEAR_PATTERN =
  /\b(no\s+end\s+time|no\s+hard\s+end|end\s+time\s+(unknown|tbd|none|n\/a))\b/i;

const CONTEXT_PRESERVE_FIELDS = [
  "event_type",
  "start_time",
  "start_date",
  "event_date",
  "timezone",
  "venue_id",
  "venue_name",
  "custom_location_name",
  "custom_address",
  "custom_city",
  "custom_state",
  "custom_latitude",
  "custom_longitude",
  "location_mode",
  "series_mode",
  "recurrence_rule",
  "day_of_week",
  "max_occurrences",
  "occurrence_count",
  "custom_dates",
] as const;

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function isShortClarificationReply(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.length > 140) return false;
  return trimmed.split(/\s+/).length <= 10;
}

export function mergeLockedCreateDraft(input: {
  draft: Record<string, unknown>;
  lockedDraft: Record<string, unknown> | null;
  message: string;
}): void {
  const { draft, lockedDraft, message } = input;
  if (!lockedDraft) return;
  const currentMessage = message.trim();

  for (const field of CONTEXT_PRESERVE_FIELDS) {
    if (isMissingValue(draft[field]) && !isMissingValue(lockedDraft[field])) {
      draft[field] = lockedDraft[field] as unknown;
    }
  }

  // Preserve recurrence when a short clarification answer accidentally resets
  // the draft to a one-time event without explicit recurrence change intent.
  if (
    hasNonEmptyString(lockedDraft.recurrence_rule) &&
    !RECURRENCE_OVERRIDE_PATTERN.test(currentMessage) &&
    (!hasNonEmptyString(draft.recurrence_rule) || draft.series_mode === "single")
  ) {
    draft.recurrence_rule = lockedDraft.recurrence_rule;
    if (!hasNonEmptyString(draft.series_mode)) {
      draft.series_mode = lockedDraft.series_mode ?? "recurring";
    } else if (draft.series_mode === "single") {
      draft.series_mode = "recurring";
    }

    if (isMissingValue(draft.day_of_week) && !isMissingValue(lockedDraft.day_of_week)) {
      draft.day_of_week = lockedDraft.day_of_week as unknown;
    }
    if (isMissingValue(draft.max_occurrences) && !isMissingValue(lockedDraft.max_occurrences)) {
      draft.max_occurrences = lockedDraft.max_occurrences as unknown;
    }
    if (isMissingValue(draft.occurrence_count) && !isMissingValue(lockedDraft.occurrence_count)) {
      draft.occurrence_count = lockedDraft.occurrence_count as unknown;
    }
  }

  // Preserve prior title for short clarification replies unless user explicitly
  // indicates they are changing the title.
  if (
    hasNonEmptyString(lockedDraft.title) &&
    isShortClarificationReply(message) &&
    !TITLE_INTENT_PATTERN.test(currentMessage)
  ) {
    draft.title = lockedDraft.title;
  }

  // Allow explicit "no end time" user intent to keep end_time empty.
  if (END_TIME_CLEAR_PATTERN.test(currentMessage)) {
    draft.end_time = null;
  }
}

// ---------------------------------------------------------------------------
// Optional blocking field pruning (UX hardening)
// ---------------------------------------------------------------------------

export function pruneOptionalBlockingFields(
  mode: "create" | "edit_series" | "edit_occurrence",
  blockingFields: string[],
  clarificationQuestion: string | null
): { blockingFields: string[]; clarificationQuestion: string | null } {
  if (mode === "edit_occurrence") {
    return { blockingFields, clarificationQuestion };
  }

  const optionalBlocking = new Set(["end_time"]);
  const filtered = blockingFields.filter((field) => !optionalBlocking.has(field));

  if (filtered.length === blockingFields.length) {
    return { blockingFields, clarificationQuestion };
  }

  const questionIsEndTimeOnly =
    clarificationQuestion !== null &&
    /\bend\s*time\b/i.test(clarificationQuestion) &&
    filtered.length === 0;

  return {
    blockingFields: filtered,
    clarificationQuestion: questionIsEndTimeOnly ? null : clarificationQuestion,
  };
}
