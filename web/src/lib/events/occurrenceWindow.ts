/**
 * Occurrence Window Helpers
 *
 * Single source of truth for the rolling 90-day occurrence window.
 * Used to display consistent messaging about what dates are shown.
 */

import { getTodayDenver, addDaysDenver, EXPANSION_CAPS } from "./nextOccurrence";

/**
 * Format a date key (YYYY-MM-DD) to "MMM D" format in Denver timezone.
 * Example: "2026-01-24" → "Jan 24"
 */
export function formatDateLabel(dateKey: string): string {
  const date = new Date(dateKey + "T12:00:00Z");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

export interface OccurrenceWindowRange {
  /** Start date key (YYYY-MM-DD) */
  startKey: string;
  /** End date key (YYYY-MM-DD) */
  endKey: string;
  /** Formatted start date (e.g., "Jan 24") */
  startLabel: string;
  /** Formatted end date (e.g., "Apr 24") */
  endLabel: string;
  /** Window size in days */
  windowDays: number;
}

/**
 * Get the current occurrence window date range.
 * Uses the authoritative EXPANSION_CAPS.DEFAULT_WINDOW_DAYS (90 days).
 *
 * @param nowKey - Optional date key to use as "today" (for testing). Defaults to getTodayDenver().
 */
export function getOccurrenceWindowRange(nowKey?: string): OccurrenceWindowRange {
  const startKey = nowKey ?? getTodayDenver();
  const windowDays = EXPANSION_CAPS.DEFAULT_WINDOW_DAYS;
  const endKey = addDaysDenver(startKey, windowDays);

  return {
    startKey,
    endKey,
    startLabel: formatDateLabel(startKey),
    endLabel: formatDateLabel(endKey),
    windowDays,
  };
}

export interface OccurrenceWindowNotice {
  /** Main headline text */
  headline: string;
  /** Detail line with computed date range */
  detail: string;
}

/**
 * Get the occurrence window notice text for UI display.
 *
 * @param nowKey - Optional date key to use as "today" (for testing). Defaults to getTodayDenver().
 */
export function getOccurrenceWindowNotice(nowKey?: string): OccurrenceWindowNotice {
  const { startLabel, endLabel } = getOccurrenceWindowRange(nowKey);

  return {
    headline: "Occurrences are shown in a rolling 90-day window from today.",
    detail: `Showing: ${startLabel} – ${endLabel}. New dates appear automatically as the window advances.`,
  };
}
