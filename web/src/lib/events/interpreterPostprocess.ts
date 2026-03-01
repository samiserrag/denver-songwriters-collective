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

export const DOORS_PATTERN = /\bdoors?\s+(?:open\s+)?(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
export const PERFORMANCE_START_PATTERN =
  /\b(?:first\s+performance|show|music|set|acts?)\s+(?:starts?\s+)?(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;

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
// INTERPRETER-08: series_mode ↔ recurrence_rule consistency (Phase 8A)
//
// Must run AFTER the recurrence intent guard (which may clear both fields)
// and AFTER mergeLockedCreateDraft (which may restore them from context).
// ---------------------------------------------------------------------------

const RECURRING_RRULE_PATTERN =
  /\bFREQ=(?:DAILY|WEEKLY|MONTHLY|YEARLY)\b/i;

/**
 * Normalize `series_mode` to match `recurrence_rule` in the same response turn.
 *
 * If `recurrence_rule` is structurally recurring (contains FREQ=...) but
 * `series_mode` is "single" or missing, promote `series_mode` to "recurring".
 *
 * If `recurrence_rule` is null/empty, leave `series_mode` unchanged — the
 * recurrence intent guard already handled intentional downgrades by clearing
 * both fields together.
 */
export function normalizeSeriesModeConsistency(
  draft: Record<string, unknown>
): void {
  const rule = draft.recurrence_rule;
  if (typeof rule !== "string" || !rule.trim()) return;

  if (RECURRING_RRULE_PATTERN.test(rule)) {
    if (!draft.series_mode || draft.series_mode === "single") {
      draft.series_mode = "recurring";
    }
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
const GOOGLE_MAPS_LINK_PATTERN =
  /\bhttps?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.com\/maps|maps\.google\.com)\b/i;
const LOCATION_OVERRIDE_INTENT_PATTERN =
  /\b(change|move|switch|relocat|different)\b.*\b(venue|location|address)\b/i;
const LOCATION_KEYWORD_PATTERN =
  /\b(venue|location|address)\b/i;
const ADDRESS_SIGNAL_PATTERN =
  /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place|pkwy|parkway)\b|\d{5}(?:-\d{4})?|,\s*[A-Z]{2}\b)\b/i;

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
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}): void {
  const { draft, lockedDraft, message, conversationHistory } = input;
  if (!lockedDraft) return;
  const currentMessage = message.trim();
  const lastAssistantMessage =
    [...conversationHistory]
      .reverse()
      .find((entry) => entry.role === "assistant")?.content ?? "";

  const hasLocationOverrideIntent =
    LOCATION_OVERRIDE_INTENT_PATTERN.test(currentMessage) ||
    LOCATION_KEYWORD_PATTERN.test(currentMessage) ||
    GOOGLE_MAPS_LINK_PATTERN.test(currentMessage);
  const assistantAskedLocation =
    /\b(venue|location|address|where)\b/i.test(lastAssistantMessage);
  const hasStructuredLocationSignal =
    GOOGLE_MAPS_LINK_PATTERN.test(currentMessage) || ADDRESS_SIGNAL_PATTERN.test(currentMessage);

  for (const field of CONTEXT_PRESERVE_FIELDS) {
    if (isMissingValue(draft[field]) && !isMissingValue(lockedDraft[field])) {
      draft[field] = lockedDraft[field] as unknown;
    }
  }

  // Keep resolved venue/location stable across short clarification turns unless
  // user explicitly changes location details.
  const shouldPreserveLockedLocation =
    !hasLocationOverrideIntent && (!assistantAskedLocation || !hasStructuredLocationSignal);
  if (shouldPreserveLockedLocation) {
    if (hasNonEmptyString(lockedDraft.venue_id)) {
      draft.venue_id = lockedDraft.venue_id;
      if (hasNonEmptyString(lockedDraft.venue_name)) {
        draft.venue_name = lockedDraft.venue_name;
      }
      draft.location_mode = "venue";
      draft.custom_location_name = null;
      draft.custom_address = null;
      draft.custom_city = null;
      draft.custom_state = null;
      draft.custom_latitude = null;
      draft.custom_longitude = null;
    } else if (
      hasNonEmptyString(lockedDraft.custom_location_name) &&
      !hasNonEmptyString(draft.venue_id)
    ) {
      draft.custom_location_name = lockedDraft.custom_location_name;
      draft.custom_address = lockedDraft.custom_address ?? null;
      draft.custom_city = lockedDraft.custom_city ?? null;
      draft.custom_state = lockedDraft.custom_state ?? null;
      draft.custom_latitude = lockedDraft.custom_latitude ?? null;
      draft.custom_longitude = lockedDraft.custom_longitude ?? null;
      draft.location_mode = "venue";
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
// Blocking field pruning for already-satisfied draft fields
// ---------------------------------------------------------------------------

function hasArrayValues(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isBlockingFieldSatisfied(draft: Record<string, unknown>, field: string): boolean {
  switch (field) {
    case "title":
      return hasNonEmptyString(draft.title);
    case "event_type":
      return hasArrayValues(draft.event_type);
    case "start_date":
      return hasNonEmptyString(draft.start_date) || hasNonEmptyString(draft.event_date);
    case "event_date":
      return hasNonEmptyString(draft.event_date) || hasNonEmptyString(draft.start_date);
    case "start_time":
      return hasNonEmptyString(draft.start_time);
    case "end_time":
      return hasNonEmptyString(draft.end_time);
    case "timezone":
      return hasNonEmptyString(draft.timezone);
    case "series_mode":
      return hasNonEmptyString(draft.series_mode);
    case "online_url":
      return hasNonEmptyString(draft.online_url);
    case "venue_id":
      return hasNonEmptyString(draft.venue_id) || hasNonEmptyString(draft.custom_location_name);
    case "custom_location_name":
      return hasNonEmptyString(draft.custom_location_name);
    case "custom_address":
      return hasNonEmptyString(draft.custom_address);
    case "custom_city":
      return hasNonEmptyString(draft.custom_city);
    case "custom_state":
      return hasNonEmptyString(draft.custom_state);
    // Phase 9C: additional explicit cases to reduce unnecessary clarification turns.
    case "description":
      return hasNonEmptyString(draft.description);
    case "signup_mode":
      return hasNonEmptyString(draft.signup_mode);
    case "cost_label":
      return hasNonEmptyString(draft.cost_label);
    case "is_free":
      return draft.is_free === true || draft.is_free === false;
    case "day_of_week":
      return hasNonEmptyString(draft.day_of_week);
    case "recurrence_rule":
      return hasNonEmptyString(draft.recurrence_rule);
    case "location_mode":
      return hasNonEmptyString(draft.location_mode);
    case "capacity":
      return typeof draft.capacity === "number" || hasNonEmptyString(draft.capacity);
    default:
      return false;
  }
}

export function pruneSatisfiedBlockingFields(
  draft: Record<string, unknown>,
  blockingFields: string[]
): string[] {
  return blockingFields.filter((field) => {
    if (field === "venue_name_confirmation" || field === "venue_id/venue_name_confirmation") {
      return true;
    }
    return !isBlockingFieldSatisfied(draft, field);
  });
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
