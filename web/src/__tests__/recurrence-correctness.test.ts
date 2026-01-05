/**
 * Phase 4.42: Recurrence Correctness Tests
 *
 * Ensures that:
 * 1. day_of_week must match event_date when both are set
 * 2. Label and generator produce consistent weekdays
 * 3. Weekly expansion generates dates on the correct day
 */

import { describe, it, expect } from "vitest";
import {
  expandOccurrencesForEvent,
  computeNextOccurrence,
} from "@/lib/events/nextOccurrence";
import { humanizeRecurrence, getRecurrenceSummary } from "@/lib/recurrenceHumanizer";

/**
 * Helper to get the weekday name for a date string
 */
function getWeekdayName(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/Denver",
  });
}

/**
 * Validation helper (same logic as API endpoints)
 */
function validateDayOfWeekMatch(
  eventDate: string,
  dayOfWeek: string | null | undefined
): { valid: boolean; error?: string; actualDay?: string } {
  if (!dayOfWeek) {
    return { valid: true };
  }

  const date = new Date(`${eventDate}T12:00:00`);
  const actualDay = date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/Denver",
  });

  if (actualDay.toLowerCase() !== dayOfWeek.toLowerCase()) {
    return {
      valid: false,
      error: `Date ${eventDate} is ${actualDay}, not ${dayOfWeek}`,
      actualDay,
    };
  }

  return { valid: true, actualDay };
}

describe("Phase 4.42: Recurrence Correctness", () => {
  describe("Validation: day_of_week must match event_date", () => {
    it("rejects event where start_date is Tuesday but day_of_week is Monday", () => {
      // Jan 6, 2026 is a Tuesday
      const result = validateDayOfWeekMatch("2026-01-06", "Monday");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Tuesday");
      expect(result.error).toContain("Monday");
    });

    it("accepts event where start_date matches day_of_week", () => {
      // Jan 5, 2026 is a Monday
      const result = validateDayOfWeekMatch("2026-01-05", "Monday");
      expect(result.valid).toBe(true);
    });

    it("accepts event with no day_of_week", () => {
      const result = validateDayOfWeekMatch("2026-01-06", null);
      expect(result.valid).toBe(true);
    });

    it("validates Tuesday correctly", () => {
      // Jan 6, 2026 is a Tuesday
      const result = validateDayOfWeekMatch("2026-01-06", "Tuesday");
      expect(result.valid).toBe(true);
      expect(result.actualDay).toBe("Tuesday");
    });

    it("validates all days of week", () => {
      const testCases = [
        { date: "2026-01-04", day: "Sunday" },
        { date: "2026-01-05", day: "Monday" },
        { date: "2026-01-06", day: "Tuesday" },
        { date: "2026-01-07", day: "Wednesday" },
        { date: "2026-01-08", day: "Thursday" },
        { date: "2026-01-09", day: "Friday" },
        { date: "2026-01-10", day: "Saturday" },
      ];

      for (const { date, day } of testCases) {
        const result = validateDayOfWeekMatch(date, day);
        expect(result.valid).toBe(true);
        expect(result.actualDay).toBe(day);
      }
    });
  });

  describe("Label and generator alignment", () => {
    it("weekly event with matching day_of_week produces correct label and dates", () => {
      const event = {
        event_date: "2026-01-06", // Tuesday
        day_of_week: "Tuesday",
        recurrence_rule: "weekly",
      };

      // Check label
      const label = humanizeRecurrence(event.recurrence_rule, event.day_of_week);
      expect(label).toBe("Every Tuesday");

      // Check generator returns the event_date
      const occurrence = computeNextOccurrence(event, { todayKey: "2026-01-01" });
      expect(occurrence.date).toBe("2026-01-06");
      expect(getWeekdayName(occurrence.date)).toBe("Tuesday");
    });

    it("abstract weekly pattern (no event_date) generates correct weekdays", () => {
      const event = {
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      };

      // Check label
      const label = humanizeRecurrence(event.recurrence_rule, event.day_of_week);
      expect(label).toBe("Every Monday");

      // Check expansion generates Mondays
      const occurrences = expandOccurrencesForEvent(event, {
        startKey: "2026-01-01",
        endKey: "2026-01-31",
        maxOccurrences: 5,
      });

      expect(occurrences.length).toBeGreaterThan(0);
      for (const occ of occurrences) {
        const dayName = getWeekdayName(occ.dateKey);
        expect(dayName).toBe("Monday");
      }
    });

    it("weekly expansion produces correct count for 90-day window", () => {
      const event = {
        day_of_week: "Wednesday",
        recurrence_rule: "weekly",
      };

      const occurrences = expandOccurrencesForEvent(event, {
        startKey: "2026-01-01",
        endKey: "2026-04-01", // ~90 days
      });

      // Should have ~13 Wednesdays in 90 days
      expect(occurrences.length).toBeGreaterThanOrEqual(12);
      expect(occurrences.length).toBeLessThanOrEqual(14);

      // All should be Wednesdays
      for (const occ of occurrences) {
        expect(getWeekdayName(occ.dateKey)).toBe("Wednesday");
      }
    });
  });

  describe("Bug regression: mismatched event_date/day_of_week", () => {
    it("returns event_date directly when set (current behavior)", () => {
      // This documents the current behavior that caused the bug
      const event = {
        event_date: "2026-01-06", // Tuesday
        day_of_week: "Monday", // MISMATCH - this would be rejected by validation
        recurrence_rule: "weekly",
      };

      const occurrence = computeNextOccurrence(event, { todayKey: "2026-01-01" });

      // Current behavior: returns event_date, ignoring day_of_week
      expect(occurrence.date).toBe("2026-01-06");

      // This is why validation at write-time is critical
      const dayName = getWeekdayName(occurrence.date);
      expect(dayName).toBe("Tuesday"); // Not Monday!
    });

    it("label uses day_of_week regardless of event_date", () => {
      // This shows why validation is needed
      const label = humanizeRecurrence("weekly", "Monday");
      expect(label).toBe("Every Monday");
    });

    it("the original bug scenario: label says Monday, date is Tuesday", () => {
      // This is exactly the bug from Phase 4.42 investigation
      const event = {
        event_date: "2026-01-06",
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      };

      const label = getRecurrenceSummary(
        event.recurrence_rule,
        event.day_of_week,
        event.event_date
      );

      const occurrence = computeNextOccurrence(event, { todayKey: "2026-01-01" });
      const actualDay = getWeekdayName(occurrence.date);

      // The mismatch: label says Monday, actual day is Tuesday
      expect(label).toBe("Every Monday");
      expect(actualDay).toBe("Tuesday");

      // Validation would catch this
      const validation = validateDayOfWeekMatch(event.event_date, event.day_of_week);
      expect(validation.valid).toBe(false);
    });
  });

  describe("getRecurrenceSummary integration", () => {
    it("returns correct summary for weekly with day_of_week", () => {
      const summary = getRecurrenceSummary("weekly", "Friday", null);
      expect(summary).toBe("Every Friday");
    });

    it("returns One-time for event with date but no recurrence", () => {
      const summary = getRecurrenceSummary(null, null, "2026-01-15");
      expect(summary).toBe("One-time");
    });

    it("returns Every {day} for none recurrence with day_of_week", () => {
      const summary = getRecurrenceSummary("none", "Thursday", null);
      expect(summary).toBe("Every Thursday");
    });
  });

  describe("Concrete date vs abstract pattern", () => {
    it("event with only event_date returns single occurrence", () => {
      const event = {
        event_date: "2026-02-14",
      };

      const occurrences = expandOccurrencesForEvent(event, {
        startKey: "2026-01-01",
        endKey: "2026-03-31",
      });

      expect(occurrences.length).toBe(1);
      expect(occurrences[0].dateKey).toBe("2026-02-14");
    });

    it("event with only day_of_week expands to multiple dates", () => {
      const event = {
        day_of_week: "Saturday",
        recurrence_rule: "weekly",
      };

      const occurrences = expandOccurrencesForEvent(event, {
        startKey: "2026-01-01",
        endKey: "2026-01-31",
      });

      // Should have 4-5 Saturdays in January
      expect(occurrences.length).toBeGreaterThanOrEqual(4);
    });

    it("event with both uses event_date as anchor (returns single date)", () => {
      const event = {
        event_date: "2026-01-17", // Saturday
        day_of_week: "Saturday",
        recurrence_rule: "weekly",
      };

      const occurrences = expandOccurrencesForEvent(event, {
        startKey: "2026-01-01",
        endKey: "2026-01-31",
      });

      // With event_date set, returns only that date
      expect(occurrences.length).toBe(1);
      expect(occurrences[0].dateKey).toBe("2026-01-17");
    });
  });
});
