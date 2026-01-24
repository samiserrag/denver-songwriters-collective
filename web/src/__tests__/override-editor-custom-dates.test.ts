/**
 * Tests for override editor custom-date series enumeration.
 *
 * Verifies that:
 * 1. expandOccurrencesForEvent() handles recurrence_rule='custom' with custom_dates
 * 2. The window logic includes past custom dates (not just next 90 days)
 * 3. All dates in the custom_dates array are returned when window spans them
 */

import { describe, it, expect } from "vitest";
import { expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";

describe("Override Editor: Custom-date series enumeration", () => {
  const customDates = [
    "2025-01-15",
    "2025-02-05",
    "2025-02-19",
    "2025-03-05",
    "2025-03-19",
    "2025-04-02",
    "2025-04-16",
    "2025-05-07",
    "2025-05-21",
    "2025-06-04",
    "2025-06-18",
    "2025-07-02",
  ];

  it("returns all custom dates when window spans the full range", () => {
    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: customDates,
      },
      { startKey: "2025-01-15", endKey: "2025-07-02", maxOccurrences: 40 }
    );

    expect(occurrences).toHaveLength(12);
    expect(occurrences[0].dateKey).toBe("2025-01-15");
    expect(occurrences[11].dateKey).toBe("2025-07-02");
  });

  it("returns only dates within the specified window", () => {
    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: customDates,
      },
      { startKey: "2025-03-01", endKey: "2025-04-30", maxOccurrences: 40 }
    );

    expect(occurrences).toHaveLength(4);
    expect(occurrences.map(o => o.dateKey)).toEqual([
      "2025-03-05",
      "2025-03-19",
      "2025-04-02",
      "2025-04-16",
    ]);
  });

  it("returns 0 occurrences when window is entirely outside custom dates", () => {
    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: customDates,
      },
      { startKey: "2026-01-01", endKey: "2026-03-31", maxOccurrences: 40 }
    );

    expect(occurrences).toHaveLength(0);
  });

  it("returns past dates when window includes them (override editor behavior)", () => {
    // This simulates the override editor window: spanning the full custom_dates range
    const sortedDates = [...customDates].sort();
    const windowStartKey = sortedDates[0];
    const windowEndKey = sortedDates[sortedDates.length - 1];

    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: customDates,
      },
      { startKey: windowStartKey, endKey: windowEndKey, maxOccurrences: 40 }
    );

    expect(occurrences).toHaveLength(12);
    // All dates returned including past ones
    expect(occurrences[0].dateKey).toBe("2025-01-15");
  });

  it("handles unsorted custom_dates array correctly", () => {
    const unsorted = ["2025-03-05", "2025-01-15", "2025-06-04", "2025-02-19"];

    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: unsorted,
      },
      { startKey: "2025-01-01", endKey: "2025-12-31", maxOccurrences: 40 }
    );

    expect(occurrences).toHaveLength(4);
    // Should still return dates that fall within the window
    expect(occurrences.map(o => o.dateKey).sort()).toEqual([
      "2025-01-15",
      "2025-02-19",
      "2025-03-05",
      "2025-06-04",
    ]);
  });

  it("returns empty array when custom_dates is null/undefined", () => {
    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: undefined,
      },
      { startKey: "2025-01-01", endKey: "2025-12-31", maxOccurrences: 40 }
    );

    expect(occurrences).toHaveLength(0);
  });

  it("returns empty array when custom_dates is empty", () => {
    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: [],
      },
      { startKey: "2025-01-01", endKey: "2025-12-31", maxOccurrences: 40 }
    );

    expect(occurrences).toHaveLength(0);
  });

  it("respects maxOccurrences limit", () => {
    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: customDates,
      },
      { startKey: "2025-01-15", endKey: "2025-07-02", maxOccurrences: 5 }
    );

    expect(occurrences).toHaveLength(5);
  });

  it("marks all custom occurrences as isConfident=true", () => {
    const occurrences = expandOccurrencesForEvent(
      {
        event_date: "2025-01-15",
        day_of_week: null,
        recurrence_rule: "custom",
        start_time: "19:00:00",
        custom_dates: customDates,
      },
      { startKey: "2025-01-15", endKey: "2025-07-02", maxOccurrences: 40 }
    );

    expect(occurrences.every(o => o.isConfident)).toBe(true);
  });

  describe("Override editor window computation", () => {
    it("computes correct window for custom schedule (all past dates)", () => {
      // Simulating the override page logic for a past-only custom schedule
      const sortedDates = [...customDates].sort();
      const windowStartKey = sortedDates[0]; // "2025-01-15"
      const windowEndKey = sortedDates[sortedDates.length - 1]; // "2025-07-02"

      expect(windowStartKey).toBe("2025-01-15");
      expect(windowEndKey).toBe("2025-07-02");
    });

    it("computes correct window for custom schedule with future dates", () => {
      const futureDates = ["2026-02-01", "2026-03-15", "2026-04-20"];
      const sortedDates = [...futureDates].sort();
      const windowStartKey = sortedDates[0];
      const windowEndKey = sortedDates[sortedDates.length - 1];

      expect(windowStartKey).toBe("2026-02-01");
      expect(windowEndKey).toBe("2026-04-20");

      const occurrences = expandOccurrencesForEvent(
        {
          event_date: "2026-02-01",
          day_of_week: null,
          recurrence_rule: "custom",
          start_time: "19:00:00",
          custom_dates: futureDates,
        },
        { startKey: windowStartKey, endKey: windowEndKey, maxOccurrences: 40 }
      );

      expect(occurrences).toHaveLength(3);
    });

    it("weekly series still uses standard 90-day forward window", () => {
      // For non-custom series, the override page uses todayKey → today+90
      // This test verifies weekly expansion works with a 90-day window
      const occurrences = expandOccurrencesForEvent(
        {
          event_date: "2026-01-06",
          day_of_week: "Monday",
          recurrence_rule: "weekly",
          start_time: "19:00:00",
        },
        { startKey: "2026-01-06", endKey: "2026-04-06", maxOccurrences: 40 }
      );

      // ~13 weeks in 90 days
      expect(occurrences.length).toBeGreaterThanOrEqual(12);
      expect(occurrences.length).toBeLessThanOrEqual(14);
      // First occurrence is the first Monday in the window
      expect(occurrences[0].dateKey).toMatch(/^2026-01-/);
    });
  });
});
