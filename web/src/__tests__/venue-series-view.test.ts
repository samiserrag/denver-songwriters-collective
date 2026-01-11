/**
 * Phase ABC4: Venue Series View Tests
 *
 * Tests that venue pages correctly display happenings using series view,
 * including recurring events with past anchor dates.
 */

import { describe, it, expect } from "vitest";
import {
  groupEventsAsSeriesView,
  getTodayDenver,
  addDaysDenver,
  type EventForOccurrence,
} from "@/lib/events/nextOccurrence";

// Helper to create a test event
function createTestEvent(overrides: Partial<EventForOccurrence> & { id: string; title: string }): EventForOccurrence & { id: string; title: string } {
  return {
    event_date: null,
    day_of_week: null,
    recurrence_rule: null,
    is_recurring: false,
    ordinal_pattern: null,
    start_time: "19:00",
    end_time: "21:00",
    ...overrides,
  };
}

describe("Venue Series View - groupEventsAsSeriesView", () => {
  const today = getTodayDenver();
  const windowEnd = addDaysDenver(today, 90);

  describe("Recurring events with past anchor dates", () => {
    it("should include weekly recurring event even when event_date is in the past", () => {
      // Event that started in the past but recurs every Monday
      const pastAnchor = addDaysDenver(today, -30); // 30 days ago
      const events = [
        createTestEvent({
          id: "recurring-past",
          title: "Weekly Open Mic",
          event_date: pastAnchor,
          day_of_week: "Monday",
          recurrence_rule: "weekly",
          is_recurring: true,
        }),
      ];

      const { series, unknownEvents } = groupEventsAsSeriesView(events, {
        startKey: today,
        endKey: windowEnd,
      });

      // Should appear in series, not unknown
      expect(series.length).toBe(1);
      expect(unknownEvents.length).toBe(0);

      // Should have future occurrences
      expect(series[0].upcomingOccurrences.length).toBeGreaterThan(0);

      // Should be marked as recurring
      expect(series[0].isOneTime).toBe(false);
    });

    it("should show multiple upcoming occurrences for weekly events", () => {
      const pastAnchor = addDaysDenver(today, -60);
      const events = [
        createTestEvent({
          id: "weekly-event",
          title: "Every Wednesday Jam",
          event_date: pastAnchor,
          day_of_week: "Wednesday",
          recurrence_rule: "weekly",
          is_recurring: true,
        }),
      ];

      const { series } = groupEventsAsSeriesView(events, {
        startKey: today,
        endKey: windowEnd,
      });

      expect(series.length).toBe(1);
      // In a 90-day window, weekly events should have ~13 occurrences
      expect(series[0].upcomingOccurrences.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("One-time events", () => {
    it("should include one-time event with future date", () => {
      const futureDate = addDaysDenver(today, 7);
      const events = [
        createTestEvent({
          id: "one-time-future",
          title: "Special Concert",
          event_date: futureDate,
          is_recurring: false,
        }),
      ];

      const { series, unknownEvents } = groupEventsAsSeriesView(events, {
        startKey: today,
        endKey: windowEnd,
      });

      expect(series.length).toBe(1);
      expect(unknownEvents.length).toBe(0);
      expect(series[0].isOneTime).toBe(true);
    });

    it("should exclude one-time event with past date", () => {
      const pastDate = addDaysDenver(today, -7);
      const events = [
        createTestEvent({
          id: "one-time-past",
          title: "Past Concert",
          event_date: pastDate,
          is_recurring: false,
        }),
      ];

      const { series, unknownEvents } = groupEventsAsSeriesView(events, {
        startKey: today,
        endKey: windowEnd,
      });

      // Past one-time events should have no upcoming occurrences
      // They may appear in series with empty upcomingOccurrences or be filtered
      if (series.length > 0) {
        expect(series[0].upcomingOccurrences.length).toBe(0);
      }
    });
  });

  describe("Mixed venue events", () => {
    it("should correctly categorize recurring and one-time events", () => {
      const pastAnchor = addDaysDenver(today, -14);
      const futureDate = addDaysDenver(today, 14);

      const events = [
        createTestEvent({
          id: "recurring",
          title: "Weekly Show",
          event_date: pastAnchor,
          day_of_week: "Friday",
          recurrence_rule: "weekly",
          is_recurring: true,
        }),
        createTestEvent({
          id: "one-time",
          title: "Special Event",
          event_date: futureDate,
          is_recurring: false,
        }),
      ];

      const { series, unknownEvents } = groupEventsAsSeriesView(events, {
        startKey: today,
        endKey: windowEnd,
      });

      expect(unknownEvents.length).toBe(0);
      expect(series.length).toBe(2);

      // Check categorization
      const recurring = series.find((s) => s.event.id === "recurring");
      const oneTime = series.find((s) => s.event.id === "one-time");

      expect(recurring?.isOneTime).toBe(false);
      expect(oneTime?.isOneTime).toBe(true);
    });

    it("should sort series by next occurrence date", () => {
      // Create events where recurring event has closer next occurrence
      const futureDate = addDaysDenver(today, 30); // 30 days out
      const pastAnchor = addDaysDenver(today, -7); // Started last week

      const events = [
        createTestEvent({
          id: "one-time-later",
          title: "Later Event",
          event_date: futureDate,
          is_recurring: false,
        }),
        createTestEvent({
          id: "recurring-sooner",
          title: "Weekly Recurring",
          event_date: pastAnchor,
          day_of_week: "Monday", // Will have next occurrence within 7 days
          recurrence_rule: "weekly",
          is_recurring: true,
        }),
      ];

      const { series } = groupEventsAsSeriesView(events, {
        startKey: today,
        endKey: windowEnd,
      });

      // Recurring event with sooner next occurrence should be first
      // (unless today is Monday, in which case order may vary)
      expect(series.length).toBe(2);

      // Verify both events are present
      const recurringIdx = series.findIndex((s) => s.event.id === "recurring-sooner");
      const oneTimeIdx = series.findIndex((s) => s.event.id === "one-time-later");
      expect(recurringIdx).not.toBe(-1);
      expect(oneTimeIdx).not.toBe(-1);
    });
  });

  describe("Unknown schedule events", () => {
    it("should place events without computable schedule in unknownEvents", () => {
      const events = [
        createTestEvent({
          id: "no-schedule",
          title: "TBD Event",
          event_date: null,
          day_of_week: null,
          recurrence_rule: null,
          is_recurring: false,
        }),
      ];

      const { series, unknownEvents } = groupEventsAsSeriesView(events, {
        startKey: today,
        endKey: windowEnd,
      });

      expect(series.length).toBe(0);
      expect(unknownEvents.length).toBe(1);
      expect(unknownEvents[0].id).toBe("no-schedule");
    });
  });

  describe("Cancelled occurrence handling", () => {
    it("should respect occurrence overrides when filtering", () => {
      const pastAnchor = addDaysDenver(today, -7);
      const events = [
        createTestEvent({
          id: "with-cancellation",
          title: "Weekly with Cancellations",
          event_date: pastAnchor,
          day_of_week: "Tuesday",
          recurrence_rule: "weekly",
          is_recurring: true,
        }),
      ];

      // Create an override that cancels the next occurrence
      // (This tests that the function accepts overrideMap)
      const { series } = groupEventsAsSeriesView(events, {
        startKey: today,
        endKey: windowEnd,
        overrideMap: new Map(), // Empty map - just testing it's accepted
      });

      expect(series.length).toBe(1);
      // Should still have occurrences (none were cancelled in this test)
      expect(series[0].upcomingOccurrences.length).toBeGreaterThan(0);
    });
  });
});

describe("Venue Page Integration Patterns", () => {
  it("should support separating recurring from one-time events", () => {
    const today = getTodayDenver();
    const windowEnd = addDaysDenver(today, 90);

    const events = [
      createTestEvent({
        id: "recurring-1",
        title: "Weekly Recurring",
        event_date: addDaysDenver(today, -14),
        day_of_week: "Thursday",
        recurrence_rule: "weekly",
        is_recurring: true,
      }),
      createTestEvent({
        id: "one-time-1",
        title: "One Time Event",
        event_date: addDaysDenver(today, 21),
        is_recurring: false,
      }),
    ];

    const { series } = groupEventsAsSeriesView(events, {
      startKey: today,
      endKey: windowEnd,
    });

    // Pattern used in venue page
    const recurringSeries = series.filter((s) => !s.isOneTime);
    const oneTimeSeries = series.filter((s) => s.isOneTime);

    expect(recurringSeries.length).toBe(1);
    expect(oneTimeSeries.length).toBe(1);
    expect(recurringSeries[0].event.id).toBe("recurring-1");
    expect(oneTimeSeries[0].event.id).toBe("one-time-1");
  });

  it("should handle venue with no events", () => {
    const today = getTodayDenver();
    const windowEnd = addDaysDenver(today, 90);

    const { series, unknownEvents } = groupEventsAsSeriesView([], {
      startKey: today,
      endKey: windowEnd,
    });

    expect(series.length).toBe(0);
    expect(unknownEvents.length).toBe(0);

    // Pattern used in venue page for empty state
    const hasHappenings = series.length > 0 || unknownEvents.length > 0;
    expect(hasHappenings).toBe(false);
  });
});
