/**
 * Phase 4.17: Next Occurrence Computation
 *
 * Computes the next occurrence date for events, handling:
 * - One-time events (event_date)
 * - Weekly recurring events (day_of_week)
 * - Nth weekday of month events (RRULE with BYDAY ordinal)
 *
 * Used for Today-first date grouping on /happenings.
 */

import { parseRRule } from "@/lib/recurrenceHumanizer";

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
  const now = new Date();
  // Create a formatter that outputs in Denver timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // Returns YYYY-MM-DD
}

/**
 * Get today as a Date object at midnight in local time
 */
function getTodayDate(): Date {
  const todayStr = getTodayDenver();
  return new Date(todayStr + "T00:00:00");
}

/**
 * Get the next occurrence of a weekly event given a day name
 */
function getNextWeeklyOccurrence(dayName: string, today: Date): Date {
  const targetDayIndex = DAY_NAME_TO_INDEX[dayName.toLowerCase()];
  if (targetDayIndex === undefined) {
    return today; // Fallback
  }

  const todayDayIndex = today.getDay();
  let daysUntil = targetDayIndex - todayDayIndex;
  if (daysUntil < 0) {
    daysUntil += 7;
  }

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
}

/**
 * Get the next occurrence for an nth-weekday-of-month event
 * Returns null if we can't confidently determine it
 */
function getNextNthWeekdayOccurrence(
  ordinal: number,
  dayAbbrev: string,
  today: Date
): { date: Date; confident: boolean } | null {
  const targetDayIndex = DAY_ABBREV_TO_INDEX[dayAbbrev];
  if (targetDayIndex === undefined) return null;

  // Check this month and next 2 months
  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const checkYear = today.getFullYear();
    const checkMonth = today.getMonth() + monthOffset;
    const occurrence = getNthWeekdayOfMonth(
      checkYear + Math.floor(checkMonth / 12),
      checkMonth % 12,
      targetDayIndex,
      ordinal
    );

    if (occurrence && occurrence >= today) {
      return { date: occurrence, confident: true };
    }
  }

  return null;
}

/**
 * Compute the next occurrence date for an event.
 *
 * @param event - The event object with timing fields
 * @returns NextOccurrenceResult with the computed date and metadata
 */
export function computeNextOccurrence(
  event: EventForOccurrence
): NextOccurrenceResult {
  const today = getTodayDate();
  const todayStr = getTodayDenver();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Case 1: One-time event with specific date
  if (event.event_date) {
    const eventDateStr = event.event_date;
    return {
      date: eventDateStr,
      isToday: eventDateStr === todayStr,
      isTomorrow: eventDateStr === tomorrowStr,
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
    const result = getNextNthWeekdayOccurrence(ordinal, day, today);
    if (result) {
      const dateStr = result.date.toISOString().split("T")[0];
      return {
        date: dateStr,
        isToday: dateStr === todayStr,
        isTomorrow: dateStr === tomorrowStr,
        // For nth-weekday, we're confident IF we computed it correctly
        isConfident: result.confident,
      };
    }
  }

  // Case 3: Weekly recurring with day_of_week
  if (event.day_of_week) {
    const dayName = event.day_of_week.trim();
    const nextDate = getNextWeeklyOccurrence(dayName, today);
    const dateStr = nextDate.toISOString().split("T")[0];
    return {
      date: dateStr,
      isToday: dateStr === todayStr,
      isTomorrow: dateStr === tomorrowStr,
      isConfident: true,
    };
  }

  // Fallback: Return today but mark as not confident
  return {
    date: todayStr,
    isToday: true,
    isTomorrow: false,
    isConfident: false,
  };
}

/**
 * Format a date string for display as a group header.
 *
 * @param dateStr - Date string (YYYY-MM-DD)
 * @param todayStr - Today's date string (YYYY-MM-DD)
 * @returns Human-readable header: "Today", "Tomorrow", or "Fri, Jan 3"
 */
export function formatDateGroupHeader(
  dateStr: string,
  todayStr: string
): string {
  const tomorrow = new Date(todayStr + "T00:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (dateStr === todayStr) {
    return "Today";
  }
  if (dateStr === tomorrowStr) {
    return "Tomorrow";
  }

  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

/**
 * Group events by their next occurrence date.
 *
 * @param events - Array of events with timing fields and an `id` field
 * @returns Map of date strings to event arrays, sorted by date
 */
export function groupEventsByNextOccurrence<
  T extends EventForOccurrence & { id: string }
>(events: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const event of events) {
    const occurrence = computeNextOccurrence(event);
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
