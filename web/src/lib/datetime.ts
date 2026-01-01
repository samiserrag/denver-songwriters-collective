/**
 * Date/Time formatting utilities for the Denver Songwriters Collective
 *
 * All date formatting uses America/Denver timezone for consistency.
 */

export const DENVER_TIMEZONE = "America/Denver";

/**
 * Formats an ISO date string (YYYY-MM-DD) to "MMM D, YYYY" format
 * in the America/Denver timezone.
 *
 * @param dateStr - ISO date string (e.g., "2025-01-15")
 * @returns Formatted date string (e.g., "Jan 15, 2025")
 *
 * @example
 * formatEventDate("2025-01-15") // "Jan 15, 2025"
 * formatEventDate("2025-12-31") // "Dec 31, 2025"
 */
export function formatEventDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: DENVER_TIMEZONE,
  });
}

/**
 * Formats an ISO date string for display with optional label prefix.
 * Commonly used for event dropdown options.
 *
 * @param dateStr - ISO date string or null
 * @param prefix - Optional prefix (default: " — ")
 * @returns Formatted date with prefix, or empty string if no date
 *
 * @example
 * formatEventDateLabel("2025-01-15") // " — Jan 15, 2025"
 * formatEventDateLabel(null) // ""
 */
export function formatEventDateLabel(dateStr: string | null, prefix = " — "): string {
  if (!dateStr) return "";
  return `${prefix}${formatEventDate(dateStr)}`;
}
