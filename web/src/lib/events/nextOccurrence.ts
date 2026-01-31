/**
 * Phase 4.18: Occurrence Computation & Expansion
 * Phase 4.42c: Recurrence Unification Fix
 *
 * Computes occurrence dates for events, handling:
 * - One-time events (event_date without recurrence)
 * - Weekly recurring events (day_of_week + recurrence_rule)
 * - Single nth weekday of month (RRULE BYDAY=2TH or legacy "2nd")
 * - Multi-ordinal monthly (RRULE BYDAY=1TH,3TH or legacy "2nd/3rd", "1st & 3rd")
 *
 * Phase 4.18 adds:
 * - Multi-ordinal detection to prevent fallback to weekly
 * - Occurrence expansion within a 90-day window
 * - One event can appear on multiple dates (e.g., every Wednesday)
 *
 * Phase 4.42c CRITICAL FIX:
 * - event_date now defines the START of a series, NOT the only date
 * - Recurring events ALWAYS expand to multiple occurrences
 * - Uses shared recurrence contract (interpretRecurrence) for consistency
 *
 * IMPORTANT: All date keys are in America/Denver timezone.
 * Never use toISOString().split("T")[0] for date keys (that's UTC).
 */

import { parseRRule } from "@/lib/recurrenceHumanizer";
import {
  interpretRecurrence,
  labelFromRecurrence,
  assertRecurrenceInvariant,
  type RecurrenceInput,
} from "@/lib/events/recurrenceContract";

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
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
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
 * Check if a recurrence rule appears to be multi-ordinal format.
 * Multi-ordinal patterns should NOT fall back to weekly.
 */
function isMultiOrdinalPattern(rule: string | null | undefined): boolean {
  if (!rule) return false;
  const r = rule.toLowerCase().trim();
  // Contains separators: /, &, "and", or comma
  if (r.includes("/") || r.includes("&") || r.includes(",")) return true;
  if (/\band\b/.test(r)) return true;
  // Contains multiple ordinal words: "1st 3rd", "first third", etc.
  const ordinalMatches = r.match(/\b(1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth|last)\b/g);
  if (ordinalMatches && ordinalMatches.length > 1) return true;
  return false;
}

/**
 * Parse a multi-ordinal legacy format like "2nd/3rd", "1st & 3rd", "1st, 3rd".
 * Returns array of numeric ordinals, or null if not parseable.
 */
function parseMultiOrdinal(rule: string): number[] | null {
  const r = rule.toLowerCase().trim();
  // Split on /, &, comma, or "and"
  const parts = r.split(/[\/&,]|\band\b/).map((p) => p.trim()).filter(Boolean);
  const ordinals: number[] = [];
  for (const part of parts) {
    const ordinal = LEGACY_ORDINAL_TO_NUMBER[part];
    if (ordinal !== undefined) {
      ordinals.push(ordinal);
    }
  }
  return ordinals.length > 0 ? ordinals : null;
}

/**
 * Get the nth weekday of a month as a date key string.
 * Uses UTC throughout to avoid timezone issues on CI.
 *
 * @param year - Year
 * @param month - Month (0-11)
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @param n - Which occurrence (1=first, 2=second, -1=last, etc.)
 * @returns Date key string (YYYY-MM-DD) or null
 */
function getNthWeekdayOfMonthKey(
  year: number,
  month: number,
  dayOfWeek: number,
  n: number
): string | null {
  // Adjust year/month for overflow (e.g., month=13 -> next year January)
  const adjustedYear = year + Math.floor(month / 12);
  const adjustedMonth = ((month % 12) + 12) % 12;

  if (n > 0) {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      // Use UTC to avoid timezone issues
      const date = new Date(Date.UTC(adjustedYear, adjustedMonth, day, 12, 0, 0));
      if (date.getUTCMonth() !== adjustedMonth) break;
      if (date.getUTCDay() === dayOfWeek) {
        count++;
        if (count === n) {
          // Return as YYYY-MM-DD string directly from UTC
          const y = date.getUTCFullYear();
          const m = String(date.getUTCMonth() + 1).padStart(2, "0");
          const d = String(date.getUTCDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
      }
    }
  } else if (n < 0) {
    // Get last day of month using UTC
    const lastDay = new Date(Date.UTC(adjustedYear, adjustedMonth + 1, 0, 12, 0, 0)).getUTCDate();
    let count = 0;
    for (let day = lastDay; day >= 1; day--) {
      const date = new Date(Date.UTC(adjustedYear, adjustedMonth, day, 12, 0, 0));
      if (date.getUTCDay() === dayOfWeek) {
        count++;
        if (count === Math.abs(n)) {
          const y = date.getUTCFullYear();
          const m = String(date.getUTCMonth() + 1).padStart(2, "0");
          const d = String(date.getUTCDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
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
  max_occurrences?: number | null;
  custom_dates?: string[] | null;
}

export interface NextOccurrenceResult {
  /** The next occurrence date string (YYYY-MM-DD) in Denver time */
  date: string;
  /** Whether this is today */
  isToday: boolean;
  /** Whether this is tomorrow */
  isTomorrow: boolean;
  /** Whether this date can be confidently shown (false for unknown schedules) */
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
    const occurrenceKey = getNthWeekdayOfMonthKey(
      checkYear,
      checkMonth,
      targetDayIndex,
      ordinal
    );

    if (occurrenceKey) {
      // Compare date keys lexicographically (YYYY-MM-DD format)
      if (occurrenceKey >= todayKey) {
        return { dateKey: occurrenceKey, confident: true };
      }
    }
  }

  return null;
}

/**
 * Get the next occurrence for a multi-ordinal monthly event.
 * E.g., "2nd/3rd Thursday" - find the earliest upcoming 2nd or 3rd Thursday.
 */
function getNextMultiOrdinalOccurrenceKey(
  ordinals: number[],
  dayAbbrev: string,
  todayKey: string
): { dateKey: string; confident: boolean } | null {
  const targetDayIndex = DAY_ABBREV_TO_INDEX[dayAbbrev];
  if (targetDayIndex === undefined) return null;

  const todayDate = dateFromDenverKey(todayKey);
  const candidates: string[] = [];

  // Check this month and next 2 months
  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const checkYear = todayDate.getUTCFullYear();
    const checkMonth = todayDate.getUTCMonth() + monthOffset;

    for (const ordinal of ordinals) {
      const occurrenceKey = getNthWeekdayOfMonthKey(
        checkYear,
        checkMonth,
        targetDayIndex,
        ordinal
      );
      if (occurrenceKey && occurrenceKey >= todayKey) {
        candidates.push(occurrenceKey);
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort and return the earliest
  candidates.sort();
  return { dateKey: candidates[0], confident: true };
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

  // Case 0: Custom dates series - find next date >= today
  if (event.recurrence_rule === "custom" && Array.isArray(event.custom_dates) && event.custom_dates.length > 0) {
    const nextDate = event.custom_dates.sort().find(d => d >= todayKey);
    if (nextDate) {
      return {
        date: nextDate,
        isToday: nextDate === todayKey,
        isTomorrow: nextDate === tomorrowKey,
        isConfident: true,
      };
    }
    // All dates in the past - return last date
    const lastDate = event.custom_dates[event.custom_dates.length - 1];
    return {
      date: lastDate,
      isToday: false,
      isTomorrow: false,
      isConfident: true,
    };
  }

  // Case 1: One-time event with specific date (NOT recurring)
  // Phase 4.105.1: Use interpretRecurrence to check if event is recurring
  // Previously, this returned event_date immediately for ANY event with event_date,
  // including recurring events with past anchor dates. This caused bugs where
  // "next occurrence" returned a past anchor date instead of the next future date.
  const recurrence = interpretRecurrence(event as RecurrenceInput);
  if (!recurrence.isRecurring && event.event_date) {
    const eventDateKey = event.event_date;
    return {
      date: eventDateKey,
      isToday: eventDateKey === todayKey,
      isTomorrow: eventDateKey === tomorrowKey,
      isConfident: true,
    };
  }

  // Case 2: Check for RRULE with nth weekday(s)
  const parsed = parseRRule(event.recurrence_rule ?? null);
  if (parsed && parsed.freq === "MONTHLY" && parsed.byday.length > 0) {
    // Check if ALL byday entries have ordinals
    const withOrdinals = parsed.byday.filter((d) => d.ordinal !== null);

    if (withOrdinals.length > 0) {
      // Multi-BYDAY: e.g., BYDAY=1TH,3TH
      if (withOrdinals.length > 1) {
        const ordinals = withOrdinals.map((d) => d.ordinal!);
        const dayAbbrev = withOrdinals[0].day;
        const result = getNextMultiOrdinalOccurrenceKey(ordinals, dayAbbrev, todayKey);
        if (result) {
          return {
            date: result.dateKey,
            isToday: result.dateKey === todayKey,
            isTomorrow: result.dateKey === tomorrowKey,
            isConfident: result.confident,
          };
        }
      } else {
        // Single ordinal BYDAY
        const { ordinal, day } = withOrdinals[0];
        const result = getNextNthWeekdayOccurrenceKey(ordinal!, day, todayKey);
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
  }

  // Case 2.5: Legacy format with day_of_week
  if (event.recurrence_rule && event.day_of_week) {
    const rule = event.recurrence_rule.toLowerCase().trim();
    const dayAbbrev = DAY_NAME_TO_ABBREV[event.day_of_week.toLowerCase().trim()];

    if (dayAbbrev) {
      // Check for multi-ordinal pattern first (e.g., "2nd/3rd")
      if (isMultiOrdinalPattern(rule)) {
        const ordinals = parseMultiOrdinal(rule);
        if (ordinals && ordinals.length > 0) {
          const result = getNextMultiOrdinalOccurrenceKey(ordinals, dayAbbrev, todayKey);
          if (result) {
            return {
              date: result.dateKey,
              isToday: result.dateKey === todayKey,
              isTomorrow: result.dateKey === tomorrowKey,
              isConfident: result.confident,
            };
          }
        }
        // Multi-ordinal detected but couldn't parse - mark as unknown
        return {
          date: todayKey,
          isToday: true,
          isTomorrow: false,
          isConfident: false,
        };
      }

      // Single ordinal format (e.g., "1st", "2nd")
      const legacyOrdinal = LEGACY_ORDINAL_TO_NUMBER[rule];
      if (legacyOrdinal !== undefined) {
        const result = getNextNthWeekdayOccurrenceKey(legacyOrdinal, dayAbbrev, todayKey);
        if (result) {
          return {
            date: result.dateKey,
            isToday: result.dateKey === todayKey,
            isTomorrow: result.dateKey === tomorrowKey,
            isConfident: result.confident,
          };
        }
      }

      // "weekly", "none", etc. - treat as weekly pattern
      if (rule === "weekly" || rule === "none" || rule === "") {
        const dateKey = getNextWeeklyOccurrenceKey(event.day_of_week, todayKey);
        return {
          date: dateKey,
          isToday: dateKey === todayKey,
          isTomorrow: dateKey === tomorrowKey,
          isConfident: true,
        };
      }
    }
  }

  // Case 3: Weekly recurring with day_of_week only (no recurrence_rule or empty)
  if (event.day_of_week && !isMultiOrdinalPattern(event.recurrence_rule)) {
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

// ============================================================
// Phase 4.18: Occurrence Expansion for Rolling Window
// ============================================================

/** Performance caps for occurrence expansion */
export const EXPANSION_CAPS = {
  /** Maximum events to process in a single expansion call */
  MAX_EVENTS: 200,
  /** Maximum total occurrences across all events */
  MAX_TOTAL_OCCURRENCES: 500,
  /** Maximum occurrences per individual event */
  MAX_PER_EVENT: 40,
  /** Default window size in days */
  DEFAULT_WINDOW_DAYS: 90,
} as const;

export interface ExpansionOptions {
  /** Start of window (YYYY-MM-DD), defaults to today */
  startKey?: string;
  /** End of window (YYYY-MM-DD), defaults to startKey + 90 days */
  endKey?: string;
  /** Maximum occurrences per event (prevents runaway), default 40 */
  maxOccurrences?: number;
  /** Maximum events to process (default 200) */
  maxEvents?: number;
  /** Maximum total occurrences across all events (default 500) */
  maxTotalOccurrences?: number;
  /** Pre-built override map for applying per-occurrence overrides */
  overrideMap?: OverrideMap;
}

export interface ExpandedOccurrence {
  /** Date key (YYYY-MM-DD) — the IDENTITY of this occurrence (never changes) */
  dateKey: string;
  /** Whether this occurrence is confident */
  isConfident: boolean;
  /** Display date (may differ from dateKey if rescheduled via override_patch.event_date) */
  displayDate?: string;
  /** Whether this occurrence was rescheduled to a different date */
  isRescheduled?: boolean;
  /** Whether this occurrence has been cancelled via override */
  isCancelled?: boolean;
}

/**
 * Expand all occurrences for an event within a date window.
 * Weekly events generate weekly dates, monthly events generate monthly dates.
 *
 * Phase 4.42c: Now uses the unified recurrence contract.
 * - event_date defines the START of a series, NOT the only date
 * - Recurring events ALWAYS expand to multiple occurrences
 *
 * @param event - Event with timing fields
 * @param options - Expansion options (window, max occurrences)
 * @returns Array of occurrence date keys within window
 */
export function expandOccurrencesForEvent(
  event: EventForOccurrence,
  options?: ExpansionOptions
): ExpandedOccurrence[] {
  const startKey = options?.startKey ?? getTodayDenver();
  const endKey = options?.endKey ?? addDaysDenver(startKey, EXPANSION_CAPS.DEFAULT_WINDOW_DAYS);
  const maxOccurrences = options?.maxOccurrences ?? EXPANSION_CAPS.MAX_PER_EVENT;

  const occurrences: ExpandedOccurrence[] = [];

  // Phase 4.42c: Use shared recurrence contract
  const recurrence = interpretRecurrence(event as RecurrenceInput);

  // Case 1: One-time event (NOT recurring)
  if (!recurrence.isRecurring) {
    if (event.event_date && event.event_date >= startKey && event.event_date <= endKey) {
      occurrences.push({ dateKey: event.event_date, isConfident: true });
    }
    return occurrences;
  }

  // Case 2a: Custom dates series - expand from custom_dates array
  if (recurrence.frequency === "custom" && Array.isArray(event.custom_dates) && event.custom_dates.length > 0) {
    for (const dateKey of event.custom_dates) {
      if (dateKey >= startKey && dateKey <= endKey) {
        occurrences.push({ dateKey, isConfident: true });
      }
      if (occurrences.length >= maxOccurrences) break;
    }
    return occurrences;
  }

  // Case 2b: Recurring event - MUST expand to multiple occurrences
  const targetDayIndex = recurrence.dayOfWeekIndex;

  // If we don't have a confident day, return empty (unknown schedule)
  if (targetDayIndex === null || !recurrence.isConfident) {
    return [];
  }

  // Determine effective start: use event_date as anchor if specified, else startKey
  const effectiveStart = event.event_date && event.event_date >= startKey
    ? event.event_date
    : startKey;

  // If max_occurrences is set, compute the series end date.
  // This ensures finite series stop after N occurrences from the anchor date.
  let effectiveEndKey = endKey;
  let effectiveMaxOccurrences = maxOccurrences;
  if (event.max_occurrences && event.max_occurrences > 0 && event.event_date) {
    // Compute when the series ends
    const seriesEndDate = computeSeriesEndDate(
      recurrence,
      targetDayIndex,
      event.event_date,
      event.max_occurrences
    );
    // Use the earlier of window end or series end
    if (seriesEndDate && seriesEndDate < endKey) {
      effectiveEndKey = seriesEndDate;
    }
    // Also cap the expansion count to the series limit
    effectiveMaxOccurrences = Math.min(maxOccurrences, event.max_occurrences);
  }

  // Handle different recurrence frequencies
  switch (recurrence.frequency) {
    case "monthly":
      if (recurrence.ordinals.length > 0) {
        // Monthly with ordinals (1st Tuesday, 2nd/4th Thursday, etc.)
        expandMonthlyOrdinals(
          recurrence.ordinals,
          targetDayIndex,
          effectiveStart,
          effectiveEndKey,
          effectiveMaxOccurrences,
          occurrences
        );
      } else {
        // Monthly without ordinals - just expand weekly (fallback)
        expandWeekly(targetDayIndex, effectiveStart, effectiveEndKey, effectiveMaxOccurrences, occurrences);
      }
      break;

    case "biweekly":
      // Biweekly - every other week
      expandBiweekly(targetDayIndex, effectiveStart, effectiveEndKey, effectiveMaxOccurrences, occurrences);
      break;

    case "weekly":
    default:
      // Weekly expansion
      expandWeekly(targetDayIndex, effectiveStart, effectiveEndKey, effectiveMaxOccurrences, occurrences);
      break;
  }

  // Phase 4.42c: Invariant check - recurring events should produce multiple occurrences
  // Skip check for bounded series (max_occurrences limits expansion count)
  if (!event.max_occurrences || event.max_occurrences > 1) {
    assertRecurrenceInvariant(recurrence, occurrences.length);
  }

  return occurrences;
}

/**
 * Compute the last date of a finite series.
 * Given the event's anchor date and max_occurrences, determine when the series ends.
 *
 * For weekly: last date = anchor + (max_occurrences - 1) * 7 days
 * For biweekly: last date = anchor + (max_occurrences - 1) * 14 days
 * For monthly: approximate by stepping through months
 */
function computeSeriesEndDate(
  recurrence: { frequency: string; ordinals: number[] },
  dayOfWeek: number | null,
  anchorDate: string,
  maxOccurrences: number
): string | null {
  if (maxOccurrences <= 0 || !dayOfWeek) return null;

  switch (recurrence.frequency) {
    case "weekly": {
      // Each occurrence is 7 days apart
      const totalDays = (maxOccurrences - 1) * 7;
      return addDaysDenver(anchorDate, totalDays);
    }
    case "biweekly": {
      // Each occurrence is 14 days apart
      const totalDays = (maxOccurrences - 1) * 14;
      return addDaysDenver(anchorDate, totalDays);
    }
    case "monthly": {
      // For monthly patterns, approximate: each occurrence ~30 days apart
      // We overshoot slightly to ensure we don't cut off the last occurrence
      const totalDays = maxOccurrences * 35;
      // But cap the actual expansion within expandMonthlyOrdinals via maxOccurrences param
      return addDaysDenver(anchorDate, totalDays);
    }
    default:
      return null;
  }
}

/**
 * Expand weekly occurrences within window.
 */
function expandWeekly(
  dayOfWeek: number,
  startKey: string,
  endKey: string,
  maxOccurrences: number,
  occurrences: ExpandedOccurrence[]
): void {
  const startDate = dateFromDenverKey(startKey);
  const startDayIndex = startDate.getUTCDay();

  // Find first occurrence >= startKey
  let daysUntil = dayOfWeek - startDayIndex;
  if (daysUntil < 0) daysUntil += 7;

  let current = addDaysDenver(startKey, daysUntil);

  while (current <= endKey && occurrences.length < maxOccurrences) {
    occurrences.push({ dateKey: current, isConfident: true });
    current = addDaysDenver(current, 7);
  }
}

/**
 * Expand biweekly (every other week) occurrences within window.
 * Phase 4.42c: Added for proper biweekly support.
 */
function expandBiweekly(
  dayOfWeek: number,
  startKey: string,
  endKey: string,
  maxOccurrences: number,
  occurrences: ExpandedOccurrence[]
): void {
  const startDate = dateFromDenverKey(startKey);
  const startDayIndex = startDate.getUTCDay();

  // Find first occurrence >= startKey
  let daysUntil = dayOfWeek - startDayIndex;
  if (daysUntil < 0) daysUntil += 7;

  let current = addDaysDenver(startKey, daysUntil);

  while (current <= endKey && occurrences.length < maxOccurrences) {
    occurrences.push({ dateKey: current, isConfident: true });
    current = addDaysDenver(current, 14); // Every 14 days = biweekly
  }
}

/**
 * Expand monthly ordinal occurrences within window.
 */
function expandMonthlyOrdinals(
  ordinals: number[],
  dayOfWeek: number,
  startKey: string,
  endKey: string,
  maxOccurrences: number,
  occurrences: ExpandedOccurrence[]
): void {
  const startDate = dateFromDenverKey(startKey);
  const endDate = dateFromDenverKey(endKey);

  // Iterate through months in window
  let year = startDate.getUTCFullYear();
  let month = startDate.getUTCMonth();

  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();

  while (
    (year < endYear || (year === endYear && month <= endMonth)) &&
    occurrences.length < maxOccurrences
  ) {
    for (const ordinal of ordinals) {
      if (occurrences.length >= maxOccurrences) break;

      const dateKey = getNthWeekdayOfMonthKey(year, month, dayOfWeek, ordinal);
      if (dateKey && dateKey >= startKey && dateKey <= endKey) {
        occurrences.push({ dateKey, isConfident: true });
      }
    }

    // Move to next month
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  // Sort by date
  occurrences.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
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

// ============================================================
// Phase 4.18: Expanded Grouping (events appear on multiple dates)
// ============================================================

/**
 * Override status for a specific occurrence.
 */
export type OccurrenceStatus = "normal" | "cancelled";

/**
 * Override data for a specific occurrence (from occurrence_overrides table).
 */
export interface OccurrenceOverride {
  event_id: string;
  date_key: string;
  status: OccurrenceStatus;
  override_start_time?: string | null;
  override_cover_image_url?: string | null;
  override_notes?: string | null;
  /** JSONB patch of per-occurrence field overrides (Phase: Occurrence Mode Form) */
  override_patch?: Record<string, unknown> | null;
}

/**
 * Allowlist of fields that can be overridden per-occurrence.
 * Series-level fields (event_type, recurrence_rule, etc.) are BLOCKED.
 */
export const ALLOWED_OVERRIDE_FIELDS = new Set([
  "title",
  "description",
  "event_date",
  "start_time",
  "end_time",
  "venue_id",
  "location_mode",
  "custom_location_name",
  "custom_address",
  "custom_city",
  "custom_state",
  "online_url",
  "location_notes",
  "capacity",
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
  "is_free",
  "cost_label",
  "signup_url",
  "signup_deadline",
  "signup_time", // Phase 5.10: Per-occurrence signup time override (keep in sync with overrides/route.ts)
  "age_policy",
  "external_url",
  "categories",
  "cover_image_url",
  "host_notes",
  "is_published",
]);

/**
 * Apply occurrence override to a base event.
 * Single merge path: legacy columns first, then overlay override_patch.
 *
 * Usage: const effective = applyOccurrenceOverride(baseEvent, overrideRow);
 *
 * @param baseEvent - The series-level event data (any object with event fields)
 * @param override - The override row from occurrence_overrides table (or null)
 * @returns A new object with overrides applied (does NOT mutate inputs)
 */
export function applyOccurrenceOverride<T extends Record<string, unknown>>(
  baseEvent: T,
  override: OccurrenceOverride | null | undefined
): T {
  if (!override) return baseEvent;

  const result = { ...baseEvent };

  // 1. Apply legacy columns (backward compatibility with existing override UI)
  if (override.override_start_time) {
    (result as Record<string, unknown>).start_time = override.override_start_time;
  }
  if (override.override_cover_image_url) {
    (result as Record<string, unknown>).cover_image_url = override.override_cover_image_url;
  }
  if (override.override_notes) {
    (result as Record<string, unknown>).host_notes = override.override_notes;
  }

  // 2. Apply override_patch (allowlisted keys only)
  if (override.override_patch && typeof override.override_patch === "object") {
    for (const [key, value] of Object.entries(override.override_patch)) {
      if (ALLOWED_OVERRIDE_FIELDS.has(key)) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }

  return result;
}

/**
 * Map of overrides keyed by "event_id:date_key" for efficient lookup.
 */
export type OverrideMap = Map<string, OccurrenceOverride>;

/**
 * Build an override lookup key.
 */
export function buildOverrideKey(eventId: string, dateKey: string): string {
  return `${eventId}:${dateKey}`;
}

/**
 * Build an override map from an array of overrides.
 */
export function buildOverrideMap(overrides: OccurrenceOverride[]): OverrideMap {
  const map = new Map<string, OccurrenceOverride>();
  for (const o of overrides) {
    map.set(buildOverrideKey(o.event_id, o.date_key), o);
  }
  return map;
}

export interface EventOccurrenceEntry<T extends EventForOccurrence = EventForOccurrence> {
  event: T;
  dateKey: string;
  isConfident: boolean;
  /** Override data if present (cancelled, time change, etc.) */
  override?: OccurrenceOverride;
  /** Whether this occurrence is cancelled */
  isCancelled: boolean;
  /** Whether this occurrence was rescheduled to a different date */
  isRescheduled?: boolean;
  /** Original date_key before rescheduling (for "moved from" indicators) */
  originalDateKey?: string;
  /** The display date (may differ from dateKey if rescheduled) */
  displayDate?: string;
}

export interface ExpansionResult<T extends EventForOccurrence = EventForOccurrence> {
  groupedEvents: Map<string, EventOccurrenceEntry<T>[]>;
  /** Cancelled occurrences (kept separate for toggle control) */
  cancelledOccurrences: EventOccurrenceEntry<T>[];
  unknownEvents: T[];
  /** Performance metrics for instrumentation */
  metrics: {
    eventsProcessed: number;
    eventsSkipped: number;
    totalOccurrences: number;
    cancelledCount: number;
    wasCapped: boolean;
  };
}

/**
 * Expand and group events by ALL their occurrences within a window.
 * One event can appear on multiple dates (e.g., every Wednesday in next 90 days).
 *
 * Phase 4.21: Now applies per-occurrence overrides (cancellations, time/flyer changes).
 * Cancelled occurrences are tracked separately for toggle control.
 *
 * Performance caps are enforced to prevent runaway processing:
 * - maxEvents: Maximum events to process (default 200)
 * - maxTotalOccurrences: Maximum total occurrences (default 500)
 * - maxOccurrences: Maximum occurrences per event (default 40)
 *
 * @param events - Array of events with timing fields and an `id` field
 * @param options - Expansion options (including optional overrideMap)
 * @returns Map of date strings to event entries, sorted by date, plus metrics
 */
export function expandAndGroupEvents<T extends EventForOccurrence & { id: string }>(
  events: T[],
  options?: ExpansionOptions
): ExpansionResult<T> {
  const startKey = options?.startKey ?? getTodayDenver();
  const endKey = options?.endKey ?? addDaysDenver(startKey, EXPANSION_CAPS.DEFAULT_WINDOW_DAYS);
  const maxEvents = options?.maxEvents ?? EXPANSION_CAPS.MAX_EVENTS;
  const maxTotalOccurrences = options?.maxTotalOccurrences ?? EXPANSION_CAPS.MAX_TOTAL_OCCURRENCES;
  const overrideMap = options?.overrideMap ?? new Map<string, OccurrenceOverride>();

  const groupedEvents = new Map<string, EventOccurrenceEntry<T>[]>();
  const cancelledOccurrences: EventOccurrenceEntry<T>[] = [];
  const unknownEvents: T[] = [];

  // Performance metrics
  let eventsProcessed = 0;
  let totalOccurrences = 0;
  let cancelledCount = 0;
  let wasCapped = false;

  // Apply event cap - process only first N events
  const eventsToProcess = events.slice(0, maxEvents);
  const eventsSkipped = events.length - eventsToProcess.length;
  if (eventsSkipped > 0) {
    wasCapped = true;
  }

  for (const event of eventsToProcess) {
    // Stop if we've hit the total occurrence cap
    if (totalOccurrences >= maxTotalOccurrences) {
      wasCapped = true;
      break;
    }

    eventsProcessed++;

    const occurrences = expandOccurrencesForEvent(event, {
      startKey,
      endKey,
      maxOccurrences: options?.maxOccurrences,
    });

    if (occurrences.length === 0) {
      // No computable occurrences - mark as unknown
      unknownEvents.push(event);
      continue;
    }

    for (const occ of occurrences) {
      // Enforce total occurrence cap
      if (totalOccurrences >= maxTotalOccurrences) {
        wasCapped = true;
        break;
      }

      totalOccurrences++;

      // Check for override
      const overrideKey = buildOverrideKey(event.id, occ.dateKey);
      const override = overrideMap.get(overrideKey);
      const isCancelled = override?.status === "cancelled";

      const entry: EventOccurrenceEntry<T> = {
        event,
        dateKey: occ.dateKey,
        isConfident: occ.isConfident,
        override,
        isCancelled,
      };

      if (isCancelled) {
        // Track cancelled occurrences separately
        cancelledCount++;
        cancelledOccurrences.push(entry);
      } else {
        // Add to normal grouping
        if (!groupedEvents.has(occ.dateKey)) {
          groupedEvents.set(occ.dateKey, []);
        }
        groupedEvents.get(occ.dateKey)!.push(entry);
      }
    }
  }

  // Sort groups by date, and within each group by start_time (applying overrides)
  const sortedGroups = new Map(
    [...groupedEvents.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, entries]) => [
        dateKey,
        entries.sort((a, b) => {
          // Use override time if present, else event time
          const timeA = a.override?.override_start_time || a.event.start_time || "99:99";
          const timeB = b.override?.override_start_time || b.event.start_time || "99:99";
          return timeA.localeCompare(timeB);
        }),
      ])
  );

  // Sort cancelled occurrences by date
  cancelledOccurrences.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return {
    groupedEvents: sortedGroups,
    cancelledOccurrences,
    unknownEvents,
    metrics: {
      eventsProcessed,
      eventsSkipped,
      totalOccurrences,
      cancelledCount,
      wasCapped,
    },
  };
}

// ============================================================
// Occurrence Rescheduling Post-Processing
// ============================================================

/**
 * Get the display date for an occurrence, accounting for rescheduling.
 *
 * When an override has `override_patch.event_date` set to a different date,
 * the occurrence is "rescheduled" — it should display on the new date
 * while keeping its identity (date_key) for routing/RSVPs/comments.
 */
export function getDisplayDateForOccurrence(
  dateKey: string,
  override?: OccurrenceOverride
): { displayDate: string; isRescheduled: boolean; originalDateKey?: string } {
  if (!override) {
    return { displayDate: dateKey, isRescheduled: false };
  }
  const patch = override.override_patch ?? null;
  const rescheduledDate = patch?.event_date as string | undefined;
  if (rescheduledDate && rescheduledDate !== dateKey) {
    return { displayDate: rescheduledDate, isRescheduled: true, originalDateKey: dateKey };
  }
  return { displayDate: dateKey, isRescheduled: false };
}

/**
 * Apply rescheduling to grouped timeline events.
 *
 * Moves rescheduled entries from their original date group to the new
 * (display) date group. Preserves identity (dateKey) on each entry.
 *
 * MUST be called AFTER expandAndGroupEvents() — this is a post-processing step.
 * expandOccurrencesForEvent() stays pure and never knows about overrides.
 *
 * @param groupedEvents - Map from expandAndGroupEvents()
 * @returns New map with rescheduled entries relocated to their display dates
 */
export function applyReschedulesToTimeline<T extends EventForOccurrence & { id: string }>(
  groupedEvents: Map<string, EventOccurrenceEntry<T>[]>
): Map<string, EventOccurrenceEntry<T>[]> {
  // Build a new map to avoid mutating input
  const result = new Map<string, EventOccurrenceEntry<T>[]>();

  // First pass: copy non-rescheduled entries, collect rescheduled ones
  const rescheduledEntries: Array<{ entry: EventOccurrenceEntry<T>; newDateKey: string }> = [];

  for (const [dateKey, entries] of groupedEvents.entries()) {
    const kept: EventOccurrenceEntry<T>[] = [];

    for (const entry of entries) {
      const { displayDate, isRescheduled } = getDisplayDateForOccurrence(
        entry.dateKey,
        entry.override
      );

      if (isRescheduled) {
        // Mark entry and collect for relocation
        rescheduledEntries.push({
          entry: {
            ...entry,
            isRescheduled: true,
            originalDateKey: entry.dateKey,
            displayDate,
          },
          newDateKey: displayDate,
        });
      } else {
        kept.push(entry);
      }
    }

    if (kept.length > 0) {
      result.set(dateKey, kept);
    }
  }

  // Second pass: insert rescheduled entries into their new date groups
  for (const { entry, newDateKey } of rescheduledEntries) {
    if (!result.has(newDateKey)) {
      result.set(newDateKey, []);
    }
    result.get(newDateKey)!.push(entry);
  }

  // Sort groups by date key, and within each group by start_time
  const sorted = new Map(
    [...result.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, entries]) => [
        dateKey,
        entries.sort((a, b) => {
          const timeA = a.override?.override_start_time || a.event.start_time || "99:99";
          const timeB = b.override?.override_start_time || b.event.start_time || "99:99";
          return timeA.localeCompare(timeB);
        }),
      ])
  );

  return sorted;
}

// ============================================================
// Phase 4.54: Series View Support
// ============================================================

/**
 * Maximum upcoming occurrences to show in series view expand.
 * Per approved constraint: cap expanded dates at 12.
 */
export const SERIES_VIEW_MAX_UPCOMING = 12;

/**
 * Represents a single series (recurring event) in series view.
 */
export interface SeriesEntry<T extends EventForOccurrence = EventForOccurrence> {
  /** The event (series) itself */
  event: T;
  /** Next occurrence result (date, isToday, etc.) */
  nextOccurrence: NextOccurrenceResult;
  /** Upcoming occurrences in window (capped at SERIES_VIEW_MAX_UPCOMING, excludes cancelled) */
  upcomingOccurrences: ExpandedOccurrence[];
  /** Human-readable recurrence label (e.g., "Every Monday") */
  recurrenceSummary: string;
  /** Whether this is a one-time event (not recurring) */
  isOneTime: boolean;
  /** Count of total upcoming in window (may exceed upcomingOccurrences.length due to cap) */
  totalUpcomingCount: number;
}

export interface SeriesViewResult<T extends EventForOccurrence = EventForOccurrence> {
  /** Series entries sorted by next occurrence date */
  series: SeriesEntry<T>[];
  /** Events with uncomputable schedules */
  unknownEvents: T[];
  /** Performance metrics */
  metrics: {
    eventsProcessed: number;
    wasCapped: boolean;
  };
}

/**
 * Group events as series for series view.
 * Each event becomes one series entry with next occurrence and upcoming dates.
 *
 * Phase 4.54: Series view alternative to timeline view.
 * - Uses event.id as series key (each event = one series)
 * - Computes next occurrence and upcoming occurrences
 * - Generates recurrence summary label
 * - Sorts by next occurrence date (ascending)
 *
 * @param events - Events to group as series
 * @param options - Expansion options (window bounds, override map)
 * @returns Series entries sorted by next occurrence date
 */
export function groupEventsAsSeriesView<T extends EventForOccurrence & { id: string }>(
  events: T[],
  options?: ExpansionOptions
): SeriesViewResult<T> {
  const startKey = options?.startKey ?? getTodayDenver();
  const endKey = options?.endKey ?? addDaysDenver(startKey, EXPANSION_CAPS.DEFAULT_WINDOW_DAYS);
  const maxEvents = options?.maxEvents ?? EXPANSION_CAPS.MAX_EVENTS;
  const overrideMap = options?.overrideMap ?? new Map<string, OccurrenceOverride>();

  const seriesEntries: SeriesEntry<T>[] = [];
  const unknownEvents: T[] = [];
  let eventsProcessed = 0;
  let wasCapped = false;

  // Apply event cap
  const eventsToProcess = events.slice(0, maxEvents);
  if (events.length > maxEvents) {
    wasCapped = true;
  }

  for (const event of eventsToProcess) {
    eventsProcessed++;

    // Get next occurrence
    const nextOcc = computeNextOccurrence(event);

    // Expand all occurrences in window
    const allOccurrences = expandOccurrencesForEvent(event, {
      startKey,
      endKey,
      maxOccurrences: SERIES_VIEW_MAX_UPCOMING + 5, // Buffer for cancelled filtering
    });

    if (allOccurrences.length === 0 && !nextOcc.isConfident) {
      // No computable occurrences
      unknownEvents.push(event);
      continue;
    }

    // Include ALL occurrences (including cancelled) with status flags for UI rendering
    // Cancelled occurrences are kept visible in pills but marked with isCancelled flag
    const allOccurrencesWithStatus = allOccurrences
      .map((occ) => {
        const overrideKey = buildOverrideKey(event.id, occ.dateKey);
        const override = overrideMap.get(overrideKey);
        const { displayDate, isRescheduled } = getDisplayDateForOccurrence(occ.dateKey, override);
        const isCancelled = override?.status === "cancelled";
        return { ...occ, displayDate, isRescheduled, isCancelled };
      })
      // Sort by display date so rescheduled occurrences appear in correct order
      .sort((a, b) => (a.displayDate || a.dateKey).localeCompare(b.displayDate || b.dateKey));

    // For counting "active" occurrences, exclude cancelled ones
    const activeOccurrences = allOccurrencesWithStatus.filter((occ) => !occ.isCancelled);

    // Get recurrence summary using the contract
    const recurrence = interpretRecurrence(event);
    const recurrenceSummary = labelFromRecurrence(recurrence);
    const isOneTime = !recurrence.isRecurring || recurrence.frequency === "one-time";

    // Cap upcoming occurrences - include ALL (with cancelled marked) for pills display
    // This allows cancelled dates to be visible in the UI with cancelled styling
    const upcomingOccurrences = allOccurrencesWithStatus.slice(0, SERIES_VIEW_MAX_UPCOMING);

    seriesEntries.push({
      event,
      nextOccurrence: nextOcc,
      upcomingOccurrences,
      recurrenceSummary,
      isOneTime,
      // totalUpcomingCount reflects ACTIVE occurrences only (for "+X more" label)
      totalUpcomingCount: activeOccurrences.length,
    });
  }

  // Sort by next occurrence date (ascending)
  // Events with no confident next occurrence sort to end
  seriesEntries.sort((a, b) => {
    if (!a.nextOccurrence.isConfident && !b.nextOccurrence.isConfident) return 0;
    if (!a.nextOccurrence.isConfident) return 1;
    if (!b.nextOccurrence.isConfident) return -1;
    return a.nextOccurrence.date.localeCompare(b.nextOccurrence.date);
  });

  return {
    series: seriesEntries,
    unknownEvents,
    metrics: {
      eventsProcessed,
      wasCapped,
    },
  };
}
