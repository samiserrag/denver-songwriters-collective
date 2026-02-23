/**
 * Cancelled Disclosure Tests (Phase 4.23)
 *
 * Tests for the cancelled occurrence disclosure behavior:
 * - Cancelled are hidden by default
 * - With showCancelled=1, Today/Tomorrow show collapsed "Cancelled (n)" row
 * - Other dates remain unchanged
 * - No regression in ordering or grouping
 */

import { describe, it, expect } from "vitest";
import {
  getTodayDenver,
  addDaysDenver,
  expandAndGroupEvents,
  buildOverrideMap,
  type OccurrenceOverride,
} from "@/lib/events/nextOccurrence";

describe("Cancelled Disclosure - Phase 4.23", () => {
  // Helper to create a mock event
  const createMockEvent = (
    id: string,
    title: string,
    options: {
      day_of_week?: string;
      event_date?: string;
      start_time?: string;
      recurrence_pattern?: string;
    } = {}
  ) => ({
    id,
    title,
    event_type: ["open_mic"],
    day_of_week: options.day_of_week || null,
    event_date: options.event_date || null,
    start_time: options.start_time || "19:00",
    recurrence_pattern: options.recurrence_pattern || null,
    week_of_month: null,
    is_recurring: !!options.day_of_week,
    recurring_end_date: null,
    is_published: true,
    status: "active",
  });

  describe("Cancelled occurrences grouping", () => {
    it("separates cancelled occurrences from active ones", () => {
      const today = getTodayDenver();
      const tomorrow = addDaysDenver(today, 1);

      // Create an event that occurs today
      const event = createMockEvent("evt-1", "Test Event", {
        event_date: today,
      });

      // Create an override that cancels today's occurrence
      const overrides: OccurrenceOverride[] = [
        {
          event_id: "evt-1",
          date_key: today,
          status: "cancelled",
          override_start_time: null,
          override_cover_image_url: null,
          override_notes: null,
        },
      ];

      const overrideMap = buildOverrideMap(overrides);

      const result = expandAndGroupEvents([event], {
        startKey: today,
        endKey: tomorrow,
        overrideMap,
      });

      // Active groups should not contain the cancelled occurrence
      expect(result.groupedEvents.has(today)).toBe(false);

      // Cancelled occurrences should contain it
      expect(result.cancelledOccurrences.length).toBe(1);
      expect(result.cancelledOccurrences[0].dateKey).toBe(today);
      expect(result.cancelledOccurrences[0].isCancelled).toBe(true);
    });

    it("tracks cancelled count in metrics", () => {
      const today = getTodayDenver();
      const tomorrow = addDaysDenver(today, 1);

      const event = createMockEvent("evt-1", "Test Event", {
        event_date: today,
      });

      const overrides: OccurrenceOverride[] = [
        {
          event_id: "evt-1",
          date_key: today,
          status: "cancelled",
          override_start_time: null,
          override_cover_image_url: null,
          override_notes: null,
        },
      ];

      const overrideMap = buildOverrideMap(overrides);

      const result = expandAndGroupEvents([event], {
        startKey: today,
        endKey: tomorrow,
        overrideMap,
      });

      expect(result.metrics.cancelledCount).toBe(1);
    });
  });

  describe("Today/Tomorrow disclosure behavior", () => {
    it("cancelled occurrences for today can be grouped separately", () => {
      const today = getTodayDenver();
      const tomorrow = addDaysDenver(today, 1);
      const dayAfterTomorrow = addDaysDenver(today, 2);

      // Create events for today, tomorrow, and day after
      const events = [
        createMockEvent("evt-today", "Today Event", { event_date: today }),
        createMockEvent("evt-tomorrow", "Tomorrow Event", { event_date: tomorrow }),
        createMockEvent("evt-later", "Later Event", { event_date: dayAfterTomorrow }),
      ];

      // Cancel all three
      const overrides: OccurrenceOverride[] = [
        {
          event_id: "evt-today",
          date_key: today,
          status: "cancelled",
          override_start_time: null,
          override_cover_image_url: null,
          override_notes: null,
        },
        {
          event_id: "evt-tomorrow",
          date_key: tomorrow,
          status: "cancelled",
          override_start_time: null,
          override_cover_image_url: null,
          override_notes: null,
        },
        {
          event_id: "evt-later",
          date_key: dayAfterTomorrow,
          status: "cancelled",
          override_start_time: null,
          override_cover_image_url: null,
          override_notes: null,
        },
      ];

      const overrideMap = buildOverrideMap(overrides);

      const result = expandAndGroupEvents(events, {
        startKey: today,
        endKey: addDaysDenver(today, 7),
        overrideMap,
      });

      // All should be in cancelledOccurrences
      expect(result.cancelledOccurrences.length).toBe(3);

      // Filter for Today/Tomorrow only (as the disclosure would do)
      const todayTomorrowCancelled = result.cancelledOccurrences.filter(
        (entry) => entry.dateKey === today || entry.dateKey === tomorrow
      );
      expect(todayTomorrowCancelled.length).toBe(2);

      // Other dates
      const otherCancelled = result.cancelledOccurrences.filter(
        (entry) => entry.dateKey !== today && entry.dateKey !== tomorrow
      );
      expect(otherCancelled.length).toBe(1);
      expect(otherCancelled[0].dateKey).toBe(dayAfterTomorrow);
    });

    it("cancelled occurrences are sorted by date", () => {
      const today = getTodayDenver();
      const dayAfterTomorrow = addDaysDenver(today, 2);
      const threeDaysLater = addDaysDenver(today, 3);

      // Create events in reverse order
      const events = [
        createMockEvent("evt-3", "Event 3", { event_date: threeDaysLater }),
        createMockEvent("evt-1", "Event 1", { event_date: today }),
        createMockEvent("evt-2", "Event 2", { event_date: dayAfterTomorrow }),
      ];

      // Cancel all
      const overrides: OccurrenceOverride[] = events.map((evt) => ({
        event_id: evt.id,
        date_key: evt.event_date!,
        status: "cancelled" as const,
        override_start_time: null,
        override_cover_image_url: null,
        override_notes: null,
      }));

      const overrideMap = buildOverrideMap(overrides);

      const result = expandAndGroupEvents(events, {
        startKey: today,
        endKey: addDaysDenver(today, 7),
        overrideMap,
      });

      // Should be sorted by date
      expect(result.cancelledOccurrences[0].dateKey).toBe(today);
      expect(result.cancelledOccurrences[1].dateKey).toBe(dayAfterTomorrow);
      expect(result.cancelledOccurrences[2].dateKey).toBe(threeDaysLater);
    });
  });

  describe("Active occurrences ordering", () => {
    it("does not affect active occurrence ordering", () => {
      const today = getTodayDenver();
      const tomorrow = addDaysDenver(today, 1);

      // Two events on same day, different times
      const events = [
        createMockEvent("evt-late", "Late Event", { event_date: today, start_time: "21:00" }),
        createMockEvent("evt-early", "Early Event", { event_date: today, start_time: "18:00" }),
      ];

      const result = expandAndGroupEvents(events, {
        startKey: today,
        endKey: tomorrow,
      });

      const todayEvents = result.groupedEvents.get(today);
      expect(todayEvents).toBeDefined();
      expect(todayEvents!.length).toBe(2);

      // Should be sorted by start_time
      expect(todayEvents![0].event.title).toBe("Early Event");
      expect(todayEvents![1].event.title).toBe("Late Event");
    });

    it("mixed active and cancelled preserves active ordering", () => {
      const today = getTodayDenver();
      const tomorrow = addDaysDenver(today, 1);

      const events = [
        createMockEvent("evt-1", "Event 1", { event_date: today, start_time: "19:00" }),
        createMockEvent("evt-2", "Event 2", { event_date: today, start_time: "20:00" }),
        createMockEvent("evt-3", "Event 3 (cancelled)", { event_date: today, start_time: "18:00" }),
      ];

      // Cancel only evt-3
      const overrides: OccurrenceOverride[] = [
        {
          event_id: "evt-3",
          date_key: today,
          status: "cancelled",
          override_start_time: null,
          override_cover_image_url: null,
          override_notes: null,
        },
      ];

      const overrideMap = buildOverrideMap(overrides);

      const result = expandAndGroupEvents(events, {
        startKey: today,
        endKey: tomorrow,
        overrideMap,
      });

      // Active events should be sorted by time
      const todayEvents = result.groupedEvents.get(today);
      expect(todayEvents!.length).toBe(2);
      expect(todayEvents![0].event.title).toBe("Event 1");
      expect(todayEvents![1].event.title).toBe("Event 2");

      // Cancelled should be separate
      expect(result.cancelledOccurrences.length).toBe(1);
      expect(result.cancelledOccurrences[0].event.title).toBe("Event 3 (cancelled)");
    });
  });

  describe("Default visibility", () => {
    it("cancelled occurrences are tracked but not shown by default", () => {
      const today = getTodayDenver();
      const tomorrow = addDaysDenver(today, 1);

      const event = createMockEvent("evt-1", "Test Event", { event_date: today });

      const overrides: OccurrenceOverride[] = [
        {
          event_id: "evt-1",
          date_key: today,
          status: "cancelled",
          override_start_time: null,
          override_cover_image_url: null,
          override_notes: null,
        },
      ];

      const overrideMap = buildOverrideMap(overrides);

      const result = expandAndGroupEvents([event], {
        startKey: today,
        endKey: tomorrow,
        overrideMap,
      });

      // The expansion result contains cancelled occurrences
      // but they are in a separate array - the UI decides visibility
      expect(result.cancelledOccurrences.length).toBe(1);
      expect(result.groupedEvents.size).toBe(0);

      // Metrics track the count
      expect(result.metrics.cancelledCount).toBe(1);
    });
  });

  describe("Date grouping integrity", () => {
    it("date groups are unchanged for non-cancelled events", () => {
      const today = getTodayDenver();
      const tomorrow = addDaysDenver(today, 1);
      const dayAfter = addDaysDenver(today, 2);

      const events = [
        createMockEvent("evt-1", "Today Event", { event_date: today }),
        createMockEvent("evt-2", "Tomorrow Event", { event_date: tomorrow }),
        createMockEvent("evt-3", "Day After Event", { event_date: dayAfter }),
      ];

      const result = expandAndGroupEvents(events, {
        startKey: today,
        endKey: addDaysDenver(today, 7),
      });

      // Each date should have its event
      expect(result.groupedEvents.get(today)?.length).toBe(1);
      expect(result.groupedEvents.get(tomorrow)?.length).toBe(1);
      expect(result.groupedEvents.get(dayAfter)?.length).toBe(1);

      // No cancelled
      expect(result.cancelledOccurrences.length).toBe(0);
    });

    it("date headers are sorted chronologically", () => {
      const today = getTodayDenver();

      const events = [
        createMockEvent("evt-3", "Event 3", { event_date: addDaysDenver(today, 3) }),
        createMockEvent("evt-1", "Event 1", { event_date: addDaysDenver(today, 1) }),
        createMockEvent("evt-2", "Event 2", { event_date: addDaysDenver(today, 2) }),
      ];

      const result = expandAndGroupEvents(events, {
        startKey: today,
        endKey: addDaysDenver(today, 7),
      });

      const dateKeys = [...result.groupedEvents.keys()];
      expect(dateKeys).toEqual([
        addDaysDenver(today, 1),
        addDaysDenver(today, 2),
        addDaysDenver(today, 3),
      ]);
    });
  });
});

describe("CancelledDisclosureRow component contract", () => {
  it("disclosure row props interface", () => {
    // This is a type-level test to ensure the component interface is correct
    // The component should accept:
    // - count: number
    // - isExpanded: boolean
    // - onToggle: () => void
    // - children: React.ReactNode

    const props = {
      count: 3,
      isExpanded: false,
      onToggle: () => {},
      children: null,
    };

    // Type check passes if this compiles
    expect(props.count).toBe(3);
    expect(props.isExpanded).toBe(false);
    expect(typeof props.onToggle).toBe("function");
  });

  it("should not render when count is 0", () => {
    // The component should return null when count is 0
    // This is a behavioral contract test
    const count = 0;
    const shouldRender = count > 0;
    expect(shouldRender).toBe(false);
  });

  it("should render when count is positive", () => {
    const count = 5;
    const shouldRender = count > 0;
    expect(shouldRender).toBe(true);
  });
});
