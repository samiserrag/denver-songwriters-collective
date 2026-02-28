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
