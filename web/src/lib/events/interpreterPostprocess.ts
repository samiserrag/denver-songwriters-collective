/**
 * Shared deterministic post-processing helpers for the interpreter pipeline.
 *
 * Used by both the interpreter route (route.ts) and the fixture regression
 * tests. Extracting these into a shared module eliminates code duplication
 * and prevents logic drift between production and test code.
 */

import { normalizeDraftRecurrenceFields } from "@/lib/events/recurrenceDraftTools";

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

export const OCR_RECURRENCE_CONFIDENCE_THRESHOLD = 0.7;

function buildUserIntentText(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): string {
  return [message, ...history.filter((h) => h.role === "user").map((h) => h.content)].join("\n");
}

export function detectsRecurrenceIntent(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  extractedImageText?: string,
  extractionConfidence?: number
): boolean {
  const userIntentText = buildUserIntentText(message, history);
  if (EXPLICIT_ONE_TIME_CUE_PATTERN.test(userIntentText)) return false;

  if (RECURRENCE_INTENT_PATTERNS.some((pattern) => pattern.test(userIntentText))) {
    return true;
  }

  if (
    typeof extractionConfidence !== "number" ||
    extractionConfidence < OCR_RECURRENCE_CONFIDENCE_THRESHOLD
  ) {
    return false;
  }

  if (typeof extractedImageText !== "string" || !extractedImageText.trim()) {
    return false;
  }

  return RECURRENCE_INTENT_PATTERNS.some((pattern) => pattern.test(extractedImageText));
}

const WEEKDAY_TO_BYDAY: Record<string, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
};

const ORDINAL_TO_BYSETPOS: Record<string, string> = {
  "1st": "1",
  first: "1",
  "2nd": "2",
  second: "2",
  "3rd": "3",
  third: "3",
  "4th": "4",
  fourth: "4",
  last: "-1",
};

const EXPLICIT_ONE_TIME_CUE_PATTERN =
  /\b(one[-\s]?time|single\s+event|not\s+recurring|just\s+this\s+once)\b/i;

type DerivedRecurrenceHint = {
  recurrenceRule: string;
  dayOfWeek: string;
};

export function deriveRecurrenceHintFromText(text: string): DerivedRecurrenceHint | null {
  if (!text.trim()) return null;

  const monthlyMatch = text.match(
    /\bmonthly(?:\s+on)?\s+the\s+(1st|2nd|3rd|4th|first|second|third|fourth|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  );
  if (monthlyMatch) {
    const ordinalRaw = monthlyMatch[1].toLowerCase();
    const weekdayRaw = monthlyMatch[2].toLowerCase();
    const byDay = WEEKDAY_TO_BYDAY[weekdayRaw];
    const bySetPos = ORDINAL_TO_BYSETPOS[ordinalRaw];
    if (byDay && bySetPos) {
      return {
        recurrenceRule: `FREQ=MONTHLY;BYDAY=${byDay};BYSETPOS=${bySetPos}`,
        dayOfWeek: weekdayRaw,
      };
    }
  }

  const weeklyMatch = text.match(
    /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  );
  if (weeklyMatch) {
    const weekdayRaw = weeklyMatch[1].toLowerCase();
    const byDay = WEEKDAY_TO_BYDAY[weekdayRaw];
    if (byDay) {
      return {
        recurrenceRule: `FREQ=WEEKLY;BYDAY=${byDay}`,
        dayOfWeek: weekdayRaw,
      };
    }
  }

  return null;
}

function hasRecurringRule(value: unknown): boolean {
  return typeof value === "string" && /\bFREQ=(?:DAILY|WEEKLY|MONTHLY|YEARLY)\b/i.test(value);
}

export function applyRecurrenceHintFromExtractedText(input: {
  draft: Record<string, unknown>;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  extractionConfidence?: number;
}): void {
  const { draft, message, history, extractedImageText, extractionConfidence } = input;

  if (typeof extractedImageText !== "string" || !extractedImageText.trim()) return;
  if (
    typeof extractionConfidence !== "number" ||
    extractionConfidence < OCR_RECURRENCE_CONFIDENCE_THRESHOLD
  ) {
    return;
  }

  const userIntentText = buildUserIntentText(message, history);
  if (EXPLICIT_ONE_TIME_CUE_PATTERN.test(userIntentText)) return;

  const hint = deriveRecurrenceHintFromText(extractedImageText);
  if (!hint) return;

  if (!hasRecurringRule(draft.recurrence_rule) || draft.series_mode === "single") {
    draft.recurrence_rule = hint.recurrenceRule;
    draft.series_mode = "recurring";
    if (typeof draft.day_of_week !== "string" || !draft.day_of_week.trim()) {
      draft.day_of_week = hint.dayOfWeek;
    }
  }
}

// ---------------------------------------------------------------------------
// Event-type intent guard (Phase 10)
// ---------------------------------------------------------------------------

const EVENT_TYPE_SIGNAL_PATTERNS: Record<string, RegExp[]> = {
  showcase: [/\bshowcase\b/i, /\bsongwriter(?:s)?\s+showcase\b/i],
  open_mic: [/\bopen[\s-]?mic\b/i, /\bopen[\s-]?mike\b/i],
  jam_session: [/\bjam\s+session\b/i, /\bjam\b/i],
  workshop: [/\bworkshop\b/i, /\bmasterclass\b/i],
  song_circle: [/\bsong\s+circle\b/i, /\bsongwriter(?:s)?\s+circle\b/i],
  gig: [/\bgig\b/i, /\blive\s+music\b/i, /\bconcert\b/i, /\bperformance\b/i, /\blive\s+performance\b/i],
  meetup: [/\bmeetup\b/i, /\bmeet\s?up\b/i],
  poetry: [
    /\bpoetry\b/i,
    /\bpoem(?:s)?\b/i,
    /\bpoet(?:ry)?\s+night\b/i,
    /\bspoken[\s-]?word\b/i,
    /\bslam\b/i,
  ],
  comedy: [/\bcomedy\b/i, /\bstand[\s-]?up\b/i],
  irish: [/\birish\b/i, /\bceltic\b/i],
  blues: [/\bblues\b/i],
  bluegrass: [/\bbluegrass\b/i],
};

const EVENT_TYPE_PRIORITY: Record<string, number> = {
  showcase: 100,
  workshop: 90,
  song_circle: 80,
  jam_session: 70,
  open_mic: 60,
  gig: 50,
  meetup: 40,
  poetry: 30,
  comedy: 20,
  irish: 10,
  blues: 10,
  bluegrass: 10,
};

function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => {
    return count + (pattern.test(text) ? 1 : 0);
  }, 0);
}

function deriveEventTypesFromText(text: string): string[] {
  if (!text.trim()) return [];

  const counts = Object.entries(EVENT_TYPE_SIGNAL_PATTERNS)
    .map(([eventType, patterns]) => ({
      eventType,
      matches: countPatternMatches(text, patterns),
    }))
    .filter((entry) => entry.matches > 0)
    .sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      return (EVENT_TYPE_PRIORITY[b.eventType] ?? 0) - (EVENT_TYPE_PRIORITY[a.eventType] ?? 0);
    });

  if (counts.length === 0) return [];
  return counts.map((entry) => entry.eventType);
}

export function deriveEventTypeHint(input: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
}): string[] {
  const { message, history, extractedImageText } = input;
  const userText = [
    message,
    ...history.filter((entry) => entry.role === "user").map((entry) => entry.content),
  ].join("\n");

  // User text wins over OCR when both exist.
  const userHint = deriveEventTypesFromText(userText);
  if (userHint.length > 0) return userHint;

  if (typeof extractedImageText === "string" && extractedImageText.trim().length > 0) {
    return deriveEventTypesFromText(extractedImageText);
  }
  return [];
}

const EVENT_TYPE_TO_CATEGORY_LABEL: Record<string, string> = {
  open_mic: "Open Mic",
  showcase: "Showcase",
  song_circle: "Song Circle",
  workshop: "Workshop",
  jam_session: "Jam Session",
  gig: "Live Music",
  meetup: "Meetup",
  poetry: "Poetry",
  comedy: "Comedy",
  irish: "Irish",
  blues: "Blues",
  bluegrass: "Bluegrass",
};

export function applyEventTypeHint(input: {
  draft: Record<string, unknown>;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
}): void {
  const { draft, message, history, extractedImageText } = input;
  const hints = deriveEventTypeHint({ message, history, extractedImageText });
  if (hints.length === 0) return;

  const existingEventTypes = Array.isArray(draft.event_type)
    ? draft.event_type
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
  draft.event_type = [...new Set([...hints, ...existingEventTypes])];

  const labels = hints
    .map((hint) => EVENT_TYPE_TO_CATEGORY_LABEL[hint])
    .filter((label): label is string => typeof label === "string" && label.length > 0);
  if (labels.length === 0) return;

  const existingCategories = Array.isArray(draft.categories)
    ? draft.categories
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  const labelsLower = new Set(labels.map((label) => label.toLowerCase()));
  draft.categories = [
    ...labels,
    ...existingCategories.filter((value) => !labelsLower.has(value.toLowerCase())),
  ];
}

// ---------------------------------------------------------------------------
// Time semantics: doors/sign-up vs public performance start (Phase 7D)
// ---------------------------------------------------------------------------

export const DOORS_PATTERN = /\bdoors?\s+(?:open\s+)?(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
export const PERFORMANCE_START_PATTERN =
  /\b(?:first\s+performance|show|music|set|acts?)\s+(?:starts?\s+)?(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
export const SIGNUP_TIME_PATTERN =
  /\b(?:(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:[-–—]\s*)?sign[\s-]?up|sign[\s-]?up\s*(?:starts?\s*)?(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))/i;
export const PERFORMANCE_RANGE_PATTERN =
  /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:[-–—]|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:performances?|show|music|sets?)\b/i;

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

function inheritMeridiemIfMissing(raw: string, fallback: string): string {
  if (/\b(?:am|pm)\b/i.test(raw)) return raw;
  const meridiem = fallback.match(/\b(am|pm)\b/i)?.[1];
  return meridiem ? `${raw.trim()}${meridiem}` : raw;
}

export function applyTimeSemantics(
  draft: Record<string, unknown>,
  message: string,
): void {
  const doorsMatch = message.match(DOORS_PATTERN);
  const performanceMatch = message.match(PERFORMANCE_START_PATTERN);
  const signupMatch = message.match(SIGNUP_TIME_PATTERN);
  const performanceRangeMatch = message.match(PERFORMANCE_RANGE_PATTERN);

  if (doorsMatch && performanceMatch) {
    const performanceTime = parseTimeString(performanceMatch[1]);
    if (performanceTime) {
      draft.start_time = performanceTime;
    }
  }

  if (signupMatch) {
    const signupRaw = signupMatch[1] || signupMatch[2];
    const signupTime = signupRaw ? parseTimeString(signupRaw) : null;
    if (signupTime) {
      draft.signup_time = signupTime;
    }
  }

  if (signupMatch && performanceRangeMatch) {
    const rangeEndRaw = performanceRangeMatch[2];
    const rangeStartRaw = inheritMeridiemIfMissing(performanceRangeMatch[1], rangeEndRaw);
    const rangeStart = parseTimeString(rangeStartRaw);
    const rangeEnd = parseTimeString(rangeEndRaw);
    if (rangeStart) {
      draft.start_time = rangeStart;
    }
    if (rangeEnd && (draft.end_time === null || draft.end_time === undefined || draft.end_time === "")) {
      draft.end_time = rangeEnd;
    }
  }
}

// ---------------------------------------------------------------------------
// Title defaults: generic event names should include the venue.
// ---------------------------------------------------------------------------

const EVENT_TYPE_TITLE_LABELS: Record<string, string> = {
  open_mic: "Open Mic",
  jam_session: "Jam Session",
  song_circle: "Song Circle",
  showcase: "Showcase",
  workshop: "Workshop",
  meetup: "Meetup",
  gig: "Live Music",
};

function normalizeComparableTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|night|event|at|hosted|by)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrimaryEventType(draft: Record<string, unknown>): string | null {
  if (!Array.isArray(draft.event_type)) return null;
  return (
    draft.event_type.find(
      (value): value is string => typeof value === "string" && EVENT_TYPE_TITLE_LABELS[value] !== undefined
    ) ?? null
  );
}

function shouldUseVenueTypeTitle(input: {
  title: string;
  venueName: string;
  primaryEventType: string;
  typeLabel: string;
}): boolean {
  const title = normalizeComparableTitle(input.title);
  const venue = normalizeComparableTitle(input.venueName);
  const type = normalizeComparableTitle(input.typeLabel);
  if (!title || !venue || !type) return false;

  if (title === type) return true;

  // Open mic flyers often produce "Open Mic", "Open Mic Night", or
  // "{Venue} Open Mic Night". Those are generic listing labels, not distinct
  // event brands, so name them consistently by venue for discoverability.
  if (input.primaryEventType === "open_mic" && title.includes("open mic")) {
    const remainder = title
      .replace(venue, " ")
      .replace(type, " ")
      .replace(/\bopen mic\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return remainder.length === 0;
  }

  return false;
}

export function applyVenueTypeTitleDefault(draft: Record<string, unknown>): void {
  if (typeof draft.title !== "string" || draft.title.trim().length === 0) return;
  const venueName =
    typeof draft.venue_name === "string" && draft.venue_name.trim().length > 0
      ? draft.venue_name.trim()
      : typeof draft.custom_location_name === "string" && draft.custom_location_name.trim().length > 0
        ? draft.custom_location_name.trim()
        : null;
  if (!venueName) return;

  const primaryEventType = getPrimaryEventType(draft);
  if (!primaryEventType) return;
  const typeLabel = EVENT_TYPE_TITLE_LABELS[primaryEventType];
  if (!typeLabel) return;

  if (shouldUseVenueTypeTitle({ title: draft.title, venueName, primaryEventType, typeLabel })) {
    draft.title = `${venueName} - ${typeLabel}`;
  }
}

// ---------------------------------------------------------------------------
// Future-date guard: month/day flyers without a year (Phase 10B)
// ---------------------------------------------------------------------------

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_DAY_PATTERN =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;

const FUTURE_DATE_INTENT_PATTERN =
  /\b(next|upcoming|future|if\s+[^.?!]*\bpast\b|past\s+[^.?!]*\bnext)\b/i;

const PAST_EVENT_INTENT_PATTERN =
  /\b(yesterday|last\s+(?:night|week|month|year)|already\s+happened|past\s+event|archive|recap)\b/i;

type IsoDateParts = {
  year: number;
  month: number;
  day: number;
};

type MonthDayMention = {
  month: number;
  day: number;
  year: number | null;
};

export type FutureDateGuardResult =
  | { applied: false }
  | { applied: true; from: string; to: string; reason: "month_day_without_year" | "future_intent" };

function parseIsoDateParts(value: unknown): IsoDateParts | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toIsoDate(parts: IsoDateParts): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function compareIsoDate(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function findMatchingMonthDayMention(text: string, month: number, day: number): MonthDayMention | null {
  MONTH_DAY_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MONTH_DAY_PATTERN.exec(text)) !== null) {
    const normalizedMonth = match[1].toLowerCase().replace(/\.$/, "");
    const mentionMonth = MONTH_NAME_TO_NUMBER[normalizedMonth];
    const mentionDay = Number.parseInt(match[2], 10);
    if (mentionMonth !== month || mentionDay !== day) continue;

    const mentionYear = match[3] ? Number.parseInt(match[3], 10) : null;
    return {
      month: mentionMonth,
      day: mentionDay,
      year: Number.isInteger(mentionYear) ? mentionYear : null,
    };
  }
  return null;
}

export function nextFutureMonthDayDate(month: number, day: number, todayIso: string): string | null {
  const today = parseIsoDateParts(todayIso);
  if (!today) return null;

  for (let year = today.year; year <= today.year + 2; year += 1) {
    const candidate = toIsoDate({ year, month, day });
    if (compareIsoDate(candidate, todayIso) >= 0) {
      return candidate;
    }
  }

  return null;
}

export function applyFutureDateGuard(input: {
  draft: Record<string, unknown>;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  todayIso: string;
}): FutureDateGuardResult {
  const { draft, message, history, extractedImageText, todayIso } = input;
  const dateValue =
    typeof draft.start_date === "string" && draft.start_date.trim().length > 0
      ? draft.start_date
      : typeof draft.event_date === "string" && draft.event_date.trim().length > 0
        ? draft.event_date
        : null;
  const parsedDate = parseIsoDateParts(dateValue);
  if (!dateValue || !parsedDate) return { applied: false };
  if (compareIsoDate(dateValue, todayIso) > 0) return { applied: false };

  const intentText = [
    message,
    ...history.filter((entry) => entry.role === "user").map((entry) => entry.content),
    extractedImageText ?? "",
  ].join("\n");
  const matchingMention = findMatchingMonthDayMention(intentText, parsedDate.month, parsedDate.day);
  if (!matchingMention) return { applied: false };

  const hasFutureIntent = FUTURE_DATE_INTENT_PATTERN.test(intentText);
  const hasExplicitYear = typeof matchingMention.year === "number";
  if (hasExplicitYear && !hasFutureIntent) return { applied: false };
  if (PAST_EVENT_INTENT_PATTERN.test(intentText) && !hasFutureIntent) return { applied: false };

  const nextDate = nextFutureMonthDayDate(parsedDate.month, parsedDate.day, todayIso);
  if (!nextDate || nextDate === dateValue) return { applied: false };

  if (typeof draft.start_date === "string" && draft.start_date.trim().length > 0) {
    draft.start_date = nextDate;
  }
  if (typeof draft.event_date === "string" && draft.event_date.trim().length > 0) {
    draft.event_date = nextDate;
  }

  return {
    applied: true,
    from: dateValue,
    to: nextDate,
    reason: hasFutureIntent ? "future_intent" : "month_day_without_year",
  };
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
    draft.custom_zip = null;
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

  normalizeDraftRecurrenceFields(draft);

  if (RECURRING_RRULE_PATTERN.test(rule) && (!draft.series_mode || draft.series_mode === "single")) {
    draft.series_mode = "custom";
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
  "custom_zip",
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
      draft.custom_zip = null;
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
      draft.custom_zip = lockedDraft.custom_zip ?? null;
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
    case "custom_zip":
    case "zip":
      return hasNonEmptyString(draft.custom_zip) || hasNonEmptyString(draft.zip);
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

  const optionalBlocking = new Set(["end_time", "external_url"]);
  const filtered = blockingFields.filter((field) => !optionalBlocking.has(field));

  if (filtered.length === blockingFields.length) {
    return { blockingFields, clarificationQuestion };
  }

  const questionIsEndTimeOnly =
    clarificationQuestion !== null &&
    /\bend\s*time\b/i.test(clarificationQuestion) &&
    filtered.length === 0;
  const questionIsExternalUrlOnly =
    clarificationQuestion !== null &&
    /\b(?:external|source|website|url|link)\b/i.test(clarificationQuestion) &&
    filtered.length === 0;

  return {
    blockingFields: filtered,
    clarificationQuestion: questionIsEndTimeOnly || questionIsExternalUrlOnly ? null : clarificationQuestion,
  };
}
