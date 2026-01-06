/**
 * Phase 4.42e: Date helpers for event creation forms
 *
 * These helpers ensure weekday/date alignment in the series preview:
 * 1. First Event Date is authoritative
 * 2. Day of Week is derived/snap-updated when date changes
 * 3. All computations use America/Denver timezone
 *
 * CONTRACT:
 * - snapDateToWeekdayMT(dateKey, targetDayIndex): Snap a date forward to the next target weekday
 * - weekdayIndexFromDateMT(dateKey): Get weekday index (0-6) from a date in Mountain Time
 * - weekdayNameFromDateMT(dateKey): Get weekday name from a date in Mountain Time
 * - getNextDayOfWeekMT(dayName): Get next occurrence of a weekday from today in Mountain Time
 */

import {
  addDaysDenver,
  getTodayDenver,
} from "@/lib/events/nextOccurrence";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Parse a Denver date key (YYYY-MM-DD) into a Date object at noon UTC.
 * This avoids DST edge cases.
 */
function dateFromDenverKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

/**
 * Get the weekday index (0=Sunday, 6=Saturday) for a date in Mountain Time.
 */
export function weekdayIndexFromDateMT(dateKey: string): number {
  const date = dateFromDenverKey(dateKey);
  // Since we parse at noon UTC, and Denver is UTC-7 or UTC-6,
  // noon UTC is always the same calendar day in Denver
  return date.getUTCDay();
}

/**
 * Get the weekday name for a date in Mountain Time.
 */
export function weekdayNameFromDateMT(dateKey: string): string {
  const index = weekdayIndexFromDateMT(dateKey);
  return DAYS_OF_WEEK[index];
}

/**
 * Get the next occurrence of a weekday from today in Mountain Time.
 * If today IS that weekday, returns today's date.
 *
 * @param dayName - Day name like "Monday", "Tuesday", etc.
 * @param options.includeToday - If true, today can be returned if it matches. Default: false (skip to next week)
 * @returns Date key in YYYY-MM-DD format
 */
export function getNextDayOfWeekMT(
  dayName: string,
  options?: { includeToday?: boolean }
): string {
  const today = getTodayDenver();
  const targetIndex = DAY_NAME_TO_INDEX[dayName.toLowerCase()];

  if (targetIndex === undefined) {
    // Invalid day name, return today as fallback
    return today;
  }

  const todayIndex = weekdayIndexFromDateMT(today);
  let daysUntil = targetIndex - todayIndex;

  if (options?.includeToday) {
    // Include today if it matches
    if (daysUntil < 0) daysUntil += 7;
  } else {
    // Always advance to next week if today or past
    if (daysUntil <= 0) daysUntil += 7;
  }

  return addDaysDenver(today, daysUntil);
}

/**
 * Snap a date to the next occurrence of a target weekday.
 * If the date is already on that weekday, it's returned unchanged.
 *
 * @param dateKey - Source date in YYYY-MM-DD format
 * @param targetDayIndex - Target weekday index (0=Sunday, 6=Saturday)
 * @returns Date key snapped to target weekday
 */
export function snapDateToWeekdayMT(dateKey: string, targetDayIndex: number): string {
  const currentDayIndex = weekdayIndexFromDateMT(dateKey);

  if (currentDayIndex === targetDayIndex) {
    // Already on target day
    return dateKey;
  }

  // Calculate days until target day
  let daysUntil = targetDayIndex - currentDayIndex;
  if (daysUntil <= 0) daysUntil += 7;

  return addDaysDenver(dateKey, daysUntil);
}

/**
 * Generate series dates for a recurring weekly event.
 *
 * @param startDate - First event date in YYYY-MM-DD format
 * @param count - Number of events to generate
 * @returns Array of date keys
 */
export function generateSeriesDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  let current = startDate;

  for (let i = 0; i < count; i++) {
    dates.push(current);
    current = addDaysDenver(current, 7);
  }

  return dates;
}

/**
 * Convert day name to index.
 */
export function dayNameToIndex(dayName: string): number | undefined {
  return DAY_NAME_TO_INDEX[dayName.toLowerCase()];
}

/**
 * Convert index to day name.
 */
export function indexToDayName(index: number): string | undefined {
  return DAYS_OF_WEEK[index];
}
