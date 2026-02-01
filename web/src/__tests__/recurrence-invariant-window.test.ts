/**
 * Tests for recurrence invariant with window-aware logic.
 *
 * Phase 1.5.1: Fixed false positives where weekly events in 7-day windows
 * were incorrectly flagged as "only 1 occurrence" bugs.
 *
 * Key invariants:
 * - Weekly in 7-day window → 0-2 occurrences is VALID (no warning)
 * - Weekly in 14-day window → 1 occurrence is a BUG (warning)
 * - Biweekly in 7-day window → 0-1 occurrence is VALID (no warning)
 * - Monthly in 7-day window → 0-1 occurrence is VALID (no warning)
 * - Log messages include event ID/title and window bounds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assertRecurrenceInvariant, interpretRecurrence } from "@/lib/events/recurrenceContract";
import { expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";

describe("assertRecurrenceInvariant - window-aware logic", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("weekly events", () => {
    const weeklyRecurrence = interpretRecurrence({
      recurrence_rule: "weekly",
      day_of_week: "Monday",
    });

    it("does NOT warn for 1 occurrence in 7-day window", () => {
      assertRecurrenceInvariant(weeklyRecurrence, 1, "test-event-1", 7, "2026-01-26", "2026-02-01");

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("does NOT warn for 2 occurrences in 14-day window", () => {
      assertRecurrenceInvariant(weeklyRecurrence, 2, "test-event-2", 14, "2026-01-26", "2026-02-08");

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("WARNS for 1 occurrence in 14-day window (bug)", () => {
      // In production mode (not test), this would warn
      // We test the function logic directly
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      assertRecurrenceInvariant(weeklyRecurrence, 1, "test-event-3", 14, "2026-01-26", "2026-02-08");

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[RECURRENCE INVARIANT VIOLATION]")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("test-event-3")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("14-day window")
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("WARNS for 1 occurrence in 90-day window (bug)", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      assertRecurrenceInvariant(weeklyRecurrence, 1, "test-event-4", 90, "2026-01-26", "2026-04-26");

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Expected ≥2")
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("biweekly events", () => {
    const biweeklyRecurrence = interpretRecurrence({
      recurrence_rule: "biweekly",
      day_of_week: "Tuesday",
    });

    it("does NOT warn for 0-1 occurrence in 7-day window", () => {
      assertRecurrenceInvariant(biweeklyRecurrence, 1, "biweekly-1", 7);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("does NOT warn for 1 occurrence in 14-day window", () => {
      assertRecurrenceInvariant(biweeklyRecurrence, 1, "biweekly-2", 14);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("WARNS for 1 occurrence in 28-day window (bug)", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      assertRecurrenceInvariant(biweeklyRecurrence, 1, "biweekly-3", 28);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("monthly events", () => {
    const monthlyRecurrence = interpretRecurrence({
      recurrence_rule: "1st",
      day_of_week: "Wednesday",
    });

    it("does NOT warn for 0-1 occurrence in 7-day window", () => {
      assertRecurrenceInvariant(monthlyRecurrence, 1, "monthly-1", 7);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("does NOT warn for 1 occurrence in 28-day window", () => {
      assertRecurrenceInvariant(monthlyRecurrence, 1, "monthly-2", 28);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("WARNS for 1 occurrence in 56-day window (bug)", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      assertRecurrenceInvariant(monthlyRecurrence, 1, "monthly-3", 56);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("log message format", () => {
    const weeklyRecurrence = interpretRecurrence({
      recurrence_rule: "weekly",
      day_of_week: "Friday",
    });

    it("includes event identifier in warning message", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      assertRecurrenceInvariant(
        weeklyRecurrence,
        1,
        'abc123 "Test Open Mic"',
        14,
        "2026-01-26",
        "2026-02-08"
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('abc123 "Test Open Mic"')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("includes window start and end dates in warning message", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      assertRecurrenceInvariant(
        weeklyRecurrence,
        1,
        "event-id",
        14,
        "2026-01-26",
        "2026-02-08"
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[2026-01-26→2026-02-08]")
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("includes frequency in warning message", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      assertRecurrenceInvariant(weeklyRecurrence, 1, "event-id", 14);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("(weekly)")
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("shows 'unknown' when eventId is not provided", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      assertRecurrenceInvariant(weeklyRecurrence, 1, undefined, 14);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Event unknown")
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("bounded events (count/endDate)", () => {
    it("does NOT warn for bounded events even with small occurrence count", () => {
      const boundedRecurrence = {
        ...interpretRecurrence({
          recurrence_rule: "weekly",
          day_of_week: "Monday",
        }),
        count: 5, // Has explicit count
      };

      assertRecurrenceInvariant(boundedRecurrence, 1, "bounded-event", 90);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("does NOT warn for events with endDate", () => {
      const boundedRecurrence = {
        ...interpretRecurrence({
          recurrence_rule: "weekly",
          day_of_week: "Monday",
        }),
        endDate: "2026-02-01", // Has explicit end date
      };

      assertRecurrenceInvariant(boundedRecurrence, 1, "bounded-event-2", 90);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});

describe("expandOccurrencesForEvent - passes event identifier to invariant", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("passes id and title to invariant when provided", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    // This should NOT trigger a warning (7-day window)
    // 2026-01-26 is a Monday, 2026-02-01 is a Sunday
    expandOccurrencesForEvent(
      {
        id: "test-uuid-123",
        title: "Words Open Mic",
        slug: "words-open-mic",
        event_date: "2026-01-26", // Monday (start of window)
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      },
      {
        startKey: "2026-01-26", // Monday
        endKey: "2026-02-01", // Sunday (7-day window)
      }
    );

    // No warning expected for 7-day window
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it("does NOT warn for weekly event in weekly digest 7-day window producing 1 occurrence", () => {
    // This is the exact scenario from the Vercel logs
    // 2026-01-26 is a MONDAY, 2026-02-01 is a SUNDAY (7-day window)
    const occurrences = expandOccurrencesForEvent(
      {
        id: "weekly-event-id",
        title: "Weekly Monday Open Mic",
        event_date: "2026-01-19", // Previous Monday (Jan 19, 2026)
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      },
      {
        startKey: "2026-01-26", // Monday
        endKey: "2026-02-01", // Sunday (7-day window)
      }
    );

    // Should produce exactly 1 occurrence (Jan 26, the Monday that starts the window)
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].dateKey).toBe("2026-01-26");

    // No warning should be logged
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("does NOT warn for monthly event in 7-day window producing 1 occurrence", () => {
    const occurrences = expandOccurrencesForEvent(
      {
        id: "monthly-event-id",
        title: "1st Saturday Open Mic",
        event_date: "2026-01-04", // First Saturday of Jan
        day_of_week: "Saturday",
        recurrence_rule: "1st",
      },
      {
        startKey: "2026-02-01", // Sunday
        endKey: "2026-02-07", // Saturday (7-day window)
      }
    );

    // First Saturday of Feb is Feb 7
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].dateKey).toBe("2026-02-07");

    // No warning should be logged
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
