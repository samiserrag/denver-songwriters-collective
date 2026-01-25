/**
 * Recurrence Canonicalization Helpers
 * Phase 4.83: Server-side canonicalization to prevent invalid recurrence states
 *
 * These helpers ensure that ordinal monthly events (1st, 2nd, 3rd, 4th, last, etc.)
 * always have a valid day_of_week derived from the anchor date when not explicitly set.
 */

/**
 * Ordinal monthly recurrence rules that REQUIRE a day_of_week to be meaningful.
 * These rules specify "Nth X of the month" patterns.
 */
const ORDINAL_MONTHLY_RULES = new Set([
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "last",
  "1st/3rd",
  "2nd/3rd",
  "2nd/4th",
  "1st and 3rd",
  "2nd and 4th",
  "1st and Last",
  "monthly", // Generic monthly also needs day_of_week
]);

/**
 * Day name lookup: 0=Sunday, 1=Monday, ..., 6=Saturday
 * Matches the encoding used in the events table (Title Case)
 */
const DAY_NAMES: readonly string[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Check if a recurrence_rule is an ordinal monthly pattern
 * that requires a day_of_week to function correctly.
 */
export function isOrdinalMonthlyRule(recurrenceRule: string | null | undefined): boolean {
  if (!recurrenceRule) return false;
  const normalized = recurrenceRule.toLowerCase().trim();
  return ORDINAL_MONTHLY_RULES.has(normalized) || ORDINAL_MONTHLY_RULES.has(recurrenceRule);
}

/**
 * Derive day_of_week name from a date string (YYYY-MM-DD format).
 * Uses UTC noon to avoid timezone edge cases.
 *
 * @param dateKey - Date in YYYY-MM-DD format
 * @returns Day name in Title Case (e.g., "Saturday"), or null if invalid
 */
export function deriveDayOfWeekFromDate(dateKey: string | null | undefined): string | null {
  if (!dateKey) return null;

  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  // Parse components to validate the date is real
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Basic range checks
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Use T12:00:00Z to avoid timezone edge cases
  const date = new Date(dateKey + "T12:00:00Z");

  // Check for invalid date (NaN)
  if (isNaN(date.getTime())) {
    return null;
  }

  // Verify the date wasn't auto-corrected (e.g., Feb 30 -> Mar 2)
  // by checking that the parsed date matches the input components
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return null;
  }

  // getUTCDay returns 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayIndex = date.getUTCDay();
  return DAY_NAMES[dayIndex];
}

/**
 * Canonicalize recurrence fields for event creation/update.
 * If recurrence_rule is ordinal monthly and day_of_week is not set,
 * derive day_of_week from the anchor date (event_date/start_date).
 *
 * @param recurrenceRule - The recurrence_rule value
 * @param dayOfWeek - The day_of_week value (may be null/undefined)
 * @param anchorDate - The anchor date (event_date or start_date) in YYYY-MM-DD format
 * @returns The canonicalized day_of_week value
 */
export function canonicalizeDayOfWeek(
  recurrenceRule: string | null | undefined,
  dayOfWeek: string | null | undefined,
  anchorDate: string | null | undefined
): string | null {
  // If day_of_week is already set, use it
  if (dayOfWeek) {
    return dayOfWeek;
  }

  // If not an ordinal monthly rule, no canonicalization needed
  if (!isOrdinalMonthlyRule(recurrenceRule)) {
    return null;
  }

  // Derive from anchor date
  return deriveDayOfWeekFromDate(anchorDate);
}
