/**
 * Phase 4.83: Recurrence Canonicalization Tests
 *
 * Tests server-side canonicalization logic that prevents invalid recurrence states
 * (ordinal monthly events with missing day_of_week).
 */

import { describe, it, expect } from "vitest";
import {
  isOrdinalMonthlyRule,
  deriveDayOfWeekFromDate,
  canonicalizeDayOfWeek,
} from "@/lib/events/recurrenceCanonicalization";

describe("isOrdinalMonthlyRule", () => {
  it("returns true for single ordinal rules", () => {
    expect(isOrdinalMonthlyRule("1st")).toBe(true);
    expect(isOrdinalMonthlyRule("2nd")).toBe(true);
    expect(isOrdinalMonthlyRule("3rd")).toBe(true);
    expect(isOrdinalMonthlyRule("4th")).toBe(true);
    expect(isOrdinalMonthlyRule("5th")).toBe(true);
    expect(isOrdinalMonthlyRule("last")).toBe(true);
  });

  it("returns true for multi-ordinal rules", () => {
    expect(isOrdinalMonthlyRule("1st/3rd")).toBe(true);
    expect(isOrdinalMonthlyRule("2nd/4th")).toBe(true);
    expect(isOrdinalMonthlyRule("2nd/3rd")).toBe(true);
    expect(isOrdinalMonthlyRule("1st and 3rd")).toBe(true);
    expect(isOrdinalMonthlyRule("2nd and 4th")).toBe(true);
    expect(isOrdinalMonthlyRule("1st and Last")).toBe(true);
  });

  it("returns true for generic monthly", () => {
    expect(isOrdinalMonthlyRule("monthly")).toBe(true);
  });

  it("returns false for weekly rules", () => {
    expect(isOrdinalMonthlyRule("weekly")).toBe(false);
    expect(isOrdinalMonthlyRule("biweekly")).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isOrdinalMonthlyRule(null)).toBe(false);
    expect(isOrdinalMonthlyRule(undefined)).toBe(false);
    expect(isOrdinalMonthlyRule("")).toBe(false);
  });

  it("returns false for custom/one-time", () => {
    expect(isOrdinalMonthlyRule("custom")).toBe(false);
    expect(isOrdinalMonthlyRule("none")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isOrdinalMonthlyRule("4TH")).toBe(true);
    expect(isOrdinalMonthlyRule("MONTHLY")).toBe(true);
    expect(isOrdinalMonthlyRule("Last")).toBe(true);
    expect(isOrdinalMonthlyRule("1ST/3RD")).toBe(true);
  });
});

describe("deriveDayOfWeekFromDate", () => {
  it("derives correct day for known dates", () => {
    // 2026-01-24 is a Saturday
    expect(deriveDayOfWeekFromDate("2026-01-24")).toBe("Saturday");
    // 2026-01-25 is a Sunday
    expect(deriveDayOfWeekFromDate("2026-01-25")).toBe("Sunday");
    // 2026-01-26 is a Monday
    expect(deriveDayOfWeekFromDate("2026-01-26")).toBe("Monday");
    // 2026-01-27 is a Tuesday
    expect(deriveDayOfWeekFromDate("2026-01-27")).toBe("Tuesday");
    // 2026-01-28 is a Wednesday
    expect(deriveDayOfWeekFromDate("2026-01-28")).toBe("Wednesday");
    // 2026-01-29 is a Thursday
    expect(deriveDayOfWeekFromDate("2026-01-29")).toBe("Thursday");
    // 2026-01-30 is a Friday
    expect(deriveDayOfWeekFromDate("2026-01-30")).toBe("Friday");
  });

  it("returns Title Case day names", () => {
    const day = deriveDayOfWeekFromDate("2026-01-24");
    expect(day).toBe("Saturday");
    expect(day).not.toBe("saturday");
    expect(day).not.toBe("SATURDAY");
  });

  it("returns null for null/undefined input", () => {
    expect(deriveDayOfWeekFromDate(null)).toBeNull();
    expect(deriveDayOfWeekFromDate(undefined)).toBeNull();
  });

  it("returns null for invalid date format", () => {
    expect(deriveDayOfWeekFromDate("01-24-2026")).toBeNull(); // MM-DD-YYYY
    expect(deriveDayOfWeekFromDate("2026/01/24")).toBeNull(); // slashes
    expect(deriveDayOfWeekFromDate("January 24, 2026")).toBeNull(); // text
    expect(deriveDayOfWeekFromDate("")).toBeNull();
    expect(deriveDayOfWeekFromDate("not-a-date")).toBeNull();
  });

  it("returns null for invalid dates", () => {
    expect(deriveDayOfWeekFromDate("2026-02-30")).toBeNull(); // Feb 30 doesn't exist
    expect(deriveDayOfWeekFromDate("2026-13-01")).toBeNull(); // Month 13
    expect(deriveDayOfWeekFromDate("0000-00-00")).toBeNull(); // Invalid
  });
});

describe("canonicalizeDayOfWeek", () => {
  it("returns existing day_of_week when already set", () => {
    expect(canonicalizeDayOfWeek("4th", "Saturday", "2026-01-24")).toBe("Saturday");
    expect(canonicalizeDayOfWeek("monthly", "Friday", "2026-01-30")).toBe("Friday");
    // Even if date doesn't match the day, trust the explicit day_of_week
    expect(canonicalizeDayOfWeek("4th", "Monday", "2026-01-24")).toBe("Monday");
  });

  it("derives day_of_week for ordinal monthly when null", () => {
    // 2026-01-24 is a Saturday
    expect(canonicalizeDayOfWeek("4th", null, "2026-01-24")).toBe("Saturday");
    expect(canonicalizeDayOfWeek("1st", null, "2026-01-24")).toBe("Saturday");
    expect(canonicalizeDayOfWeek("monthly", null, "2026-01-24")).toBe("Saturday");
    expect(canonicalizeDayOfWeek("1st/3rd", null, "2026-01-24")).toBe("Saturday");
  });

  it("returns null for non-ordinal rules", () => {
    expect(canonicalizeDayOfWeek("weekly", null, "2026-01-24")).toBeNull();
    expect(canonicalizeDayOfWeek("biweekly", null, "2026-01-24")).toBeNull();
    expect(canonicalizeDayOfWeek("custom", null, "2026-01-24")).toBeNull();
    expect(canonicalizeDayOfWeek(null, null, "2026-01-24")).toBeNull();
  });

  it("returns null when anchor date is missing", () => {
    expect(canonicalizeDayOfWeek("4th", null, null)).toBeNull();
    expect(canonicalizeDayOfWeek("4th", null, undefined)).toBeNull();
  });

  it("handles empty string day_of_week as missing", () => {
    // Empty string is falsy, so it should derive from date
    // Note: Our function checks `if (dayOfWeek)` which is falsy for ""
    expect(canonicalizeDayOfWeek("4th", "", "2026-01-24")).toBe("Saturday");
  });
});

describe("Lone Tree Open Mic scenario (the original bug)", () => {
  it("correctly derives Saturday for 2026-01-24 (4th Saturday)", () => {
    // The original bug: recurrence_rule='4th', event_date='2026-01-24', day_of_week=NULL
    // 2026-01-24 is the 4th Saturday of January 2026
    const derivedDay = canonicalizeDayOfWeek("4th", null, "2026-01-24");
    expect(derivedDay).toBe("Saturday");
  });

  it("would have prevented the bug if run server-side on save", () => {
    // Simulating what the API route now does:
    const recurrenceRule = "4th";
    const dayOfWeek = null;
    const anchorDate = "2026-01-24";

    // Server-side canonicalization
    const canonicalizedDay = canonicalizeDayOfWeek(recurrenceRule, dayOfWeek, anchorDate);

    // This would now be saved as day_of_week='Saturday'
    expect(canonicalizedDay).toBe("Saturday");
  });
});
