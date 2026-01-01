/**
 * Phase 4.17: Next Occurrence Computation
 *
 * Computes the next occurrence date for events, handling:
 * - One-time events (event_date)
 * - Weekly recurring events (day_of_week)
 * - Nth weekday of month events (RRULE with BYDAY ordinal)
 *
 * Used for Today-first date grouping on /happenings.
 *
 * IMPORTANT: All date keys are in America/Denver timezone.
 * Never use toISOString().split("T")[0] for date keys (that's UTC).
 */

import { parseRRule } from "@/lib/recurrenceHumanizer";

/**
 * Denver timezone formatter for producing YYYY-MM-DD date keys.
 * Reused across all date key generation.
 */
const denverDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Denver",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Convert a Date object to a Denver timezone date key (YYYY-MM-DD).
 * This is the ONLY way to produce date keys - never use toISOString().
 */
export function denverDateKeyFromDate(d: Date): string {
  return denverDateFormatter.format(d);
}

/**
 * Add days to a Denver date key and return the new date key.
 * Uses noon UTC to avoid DST edge cases when stepping days.
 */
export function addDaysDenver(dateKey: string, days: number): string {
  // Parse at noon UTC to avoid DST midnight issues
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return denverDateKeyFromDate(date);
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_ABBREV_TO_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/**
 * Map legacy ordinal strings to numeric ordinals.
 * These come from the database recurrence_rule field.
 */
const LEGACY_ORDINAL_TO_NUMBER: Record<string, number> = {
  "1st": 1,
  "2nd": 2,
  "3rd": 3,
  "4th": 4,
  "5th": 5,
  last: -1,
};

/**
 * Map full day names to RRULE-style abbreviations.
 */
const DAY_NAME_TO_ABBREV: Record<string, string> = {
  sunday: "SU",
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
};

/**
 * Get the nth weekday of a month
 * @param year - Year
 * @param month - Month (0-11)
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @param n - Which occurrence (1=first, 2=second, -1=last, etc.)
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  dayOfWeek: number,
  n: number
): Date | null {
  if (n > 0) {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month, day);
      if (date.getMonth() !== month) break;
      if (date.getDay() === dayOfWeek) {
        count++;
        if (count === n) return date;
      }
    }
  } else if (n < 0) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let day = lastDay; day >= 1; day--) {
      const date = new Date(year, month, day);
      if (date.getDay() === dayOfWeek) {
        count++;
        if (count === Math.abs(n)) return date;
      }
    }
  }
  return null;
}

export interface EventForOccurrence {
  event_date?: string | null;
  day_of_week?: string | null;
  recurrence_rule?: string | null;
  start_time?: string | null;
}

export interface NextOccurrenceResult {
  /** The next occurrence date string (YYYY-MM-DD) in Denver time */
  date: string;
  /** Whether this is today */
  isToday: boolean;
  /** Whether this is tomorrow */
  isTomorrow: boolean;
  /** Whether this date can be confidently shown (false for complex nth-weekday) */
  isConfident: boolean;
}

/**
 * Get today's date string in Denver timezone (YYYY-MM-DD)
 */
export function getTodayDenver(): string {
  return denverDateKeyFromDate(new Date());
}

/**
 * Parse a Denver date key into a Date at noon UTC.
 * This avoids DST edge cases when doing date arithmetic.
 */
function dateFromDenverKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

/**
 * Get the next occurrence date key of a weekly event given a day name.
 * Works entirely with Denver date keys to avoid timezone issues.
 */
function getNextWeeklyOccurrenceKey(dayName: string, todayKey: string): string {
  const targetDayIndex = DAY_NAME_TO_INDEX[dayName.toLowerCase()];
  if (targetDayIndex === undefined) {
    return todayKey; // Fallback
  }

  // Parse today at noon UTC for safe day-of-week calculation
  const todayDate = dateFromDenverKey(todayKey);
  const todayDayIndex = todayDate.getUTCDay();
  let daysUntil = targetDayIndex - todayDayIndex;
  if (daysUntil < 0) {
    daysUntil += 7;
  }

  return addDaysDenver(todayKey, daysUntil);
}

/**
 * Get the next occurrence date key for an nth-weekday-of-month event.
 * Returns null if we can't confidently determine it.
 */
function getNextNthWeekdayOccurrenceKey(
  ordinal: number,
  dayAbbrev: string,
  todayKey: string
): { dateKey: string; confident: boolean } | null {
  const targetDayIndex = DAY_ABBREV_TO_INDEX[dayAbbrev];
  if (targetDayIndex === undefined) return null;

  const todayDate = dateFromDenverKey(todayKey);

  // Check this month and next 2 months
  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const checkYear = todayDate.getUTCFullYear();
    const checkMonth = todayDate.getUTCMonth() + monthOffset;
    const occurrence = getNthWeekdayOfMonth(
      checkYear + Math.floor(checkMonth / 12),
      checkMonth % 12,
      targetDayIndex,
      ordinal
    );

    if (occurrence) {
      const occurrenceKey = denverDateKeyFromDate(occurrence);
      // Compare date keys lexicographically (YYYY-MM-DD format)
      if (occurrenceKey >= todayKey) {
        return { dateKey: occurrenceKey, confident: true };
      }
    }
  }

  return null;
}

/**
 * Options for computing next occurrence with a canonical date context.
 * Passing these ensures consistent todayKey across all computations.
 */
export interface OccurrenceOptions {
  /** Canonical today date key (YYYY-MM-DD in Denver timezone) */
  todayKey?: string;
}

/**
 * Compute the next occurrence date for an event.
 *
 * @param event - The event object with timing fields
 * @param options - Optional date context for consistent computation
 * @returns NextOccurrenceResult with the computed date and metadata
 */
export function computeNextOccurrence(
  event: EventForOccurrence,
  options?: OccurrenceOptions
): NextOccurrenceResult {
  const todayKey = options?.todayKey ?? getTodayDenver();
  const tomorrowKey = addDaysDenver(todayKey, 1);

  // Case 1: One-time event with specific date
  if (event.event_date) {
    const eventDateKey = event.event_date;
    return {
      date: eventDateKey,
      isToday: eventDateKey === todayKey,
      isTomorrow: eventDateKey === tomorrowKey,
      isConfident: true,
    };
  }

  // Case 2: Check for RRULE with nth weekday (e.g., "2nd Tuesday")
  const parsed = parseRRule(event.recurrence_rule ?? null);
  if (
    parsed &&
    parsed.freq === "MONTHLY" &&
    parsed.byday.length > 0 &&
    parsed.byday[0].ordinal !== null
  ) {
    const { ordinal, day } = parsed.byday[0];
    const result = getNextNthWeekdayOccurrenceKey(ordinal, day, todayKey);
    if (result) {
      return {
        date: result.dateKey,
        isToday: result.dateKey === todayKey,
        isTomorrow: result.dateKey === tomorrowKey,
        isConfident: result.confident,
      };
    }
  }

  // Case 2.5: Legacy ordinal format (e.g., recurrence_rule="1st" + day_of_week="Wednesday")
  // This handles events where the ordinal is stored as "1st", "2nd", etc. instead of RRULE
  if (event.recurrence_rule && event.day_of_week) {
    const legacyOrdinal =
      LEGACY_ORDINAL_TO_NUMBER[event.recurrence_rule.toLowerCase().trim()];
    const dayAbbrev = DAY_NAME_TO_ABBREV[event.day_of_week.toLowerCase().trim()];

    if (legacyOrdinal !== undefined && dayAbbrev) {
      const result = getNextNthWeekdayOccurrenceKey(
        legacyOrdinal,
        dayAbbrev,
        todayKey
      );
      if (result) {
        return {
          date: result.dateKey,
          isToday: result.dateKey === todayKey,
          isTomorrow: result.dateKey === tomorrowKey,
          isConfident: result.confident,
        };
      }
    }
  }

  // Case 3: Weekly recurring with day_of_week
  if (event.day_of_week) {
    const dayName = event.day_of_week.trim();
    const dateKey = getNextWeeklyOccurrenceKey(dayName, todayKey);
    return {
      date: dateKey,
      isToday: dateKey === todayKey,
      isTomorrow: dateKey === tomorrowKey,
      isConfident: true,
    };
  }

  // Fallback: Return today but mark as not confident
  return {
    date: todayKey,
    isToday: true,
    isTomorrow: false,
    isConfident: false,
  };
}

/**
 * Format a date string for display as a group header.
 *
 * @param dateKey - Date key (YYYY-MM-DD) in Denver timezone
 * @param todayKey - Today's date key (YYYY-MM-DD) in Denver timezone
 * @returns Human-readable header: "Today", "Tomorrow", or "Fri, Jan 3"
 */
export function formatDateGroupHeader(
  dateKey: string,
  todayKey: string
): string {
  const tomorrowKey = addDaysDenver(todayKey, 1);

  if (dateKey === todayKey) {
    return "Today";
  }
  if (dateKey === tomorrowKey) {
    return "Tomorrow";
  }

  // Parse at noon UTC for safe formatting
  const date = dateFromDenverKey(dateKey);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

/**
 * Event with pre-computed occurrence attached.
 * This is the canonical type for events after occurrence computation.
 */
export interface EventWithOccurrence<T extends EventForOccurrence = EventForOccurrence> {
  event: T;
  occurrence: NextOccurrenceResult;
}

/**
 * Compute occurrences for all events with a consistent todayKey.
 * This ensures all events use the same date context.
 *
 * @param events - Array of events with timing fields
 * @param options - Optional date context (defaults to current Denver time)
 * @returns Array of events with their pre-computed occurrences
 */
export function computeOccurrencesForEvents<T extends EventForOccurrence>(
  events: T[],
  options?: OccurrenceOptions
): EventWithOccurrence<T>[] {
  const todayKey = options?.todayKey ?? getTodayDenver();
  return events.map((event) => ({
    event,
    occurrence: computeNextOccurrence(event, { todayKey }),
  }));
}

/**
 * Group events by their next occurrence date.
 *
 * @param events - Array of events with timing fields and an `id` field
 * @param options - Optional date context for consistent computation
 * @returns Map of date strings to event arrays, sorted by date
 */
export function groupEventsByNextOccurrence<
  T extends EventForOccurrence & { id: string }
>(events: T[], options?: OccurrenceOptions): Map<string, T[]> {
  const todayKey = options?.todayKey ?? getTodayDenver();
  const groups = new Map<string, T[]>();

  for (const event of events) {
    const occurrence = computeNextOccurrence(event, { todayKey });
    const dateKey = occurrence.date;

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  }

  // Sort by date (chronological order)
  return new Map(
    [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );
}
