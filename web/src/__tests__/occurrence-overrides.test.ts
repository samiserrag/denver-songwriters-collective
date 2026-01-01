/**
 * Phase 4.21: Occurrence Overrides Tests
 *
 * Tests for the per-occurrence override system that allows
 * cancelling, rescheduling, or customizing individual occurrences
 * of recurring events without modifying the series template.
 */

import { describe, it, expect } from "vitest";
import {
  buildOverrideKey,
  buildOverrideMap,
  expandAndGroupEvents,
  type OccurrenceOverride,
  type EventForOccurrence,
} from "@/lib/events/nextOccurrence";

describe("buildOverrideKey", () => {
  it("creates a unique key from eventId and dateKey", () => {
    const key = buildOverrideKey("event-123", "2026-01-15");
    expect(key).toBe("event-123:2026-01-15");
  });

  it("handles UUIDs correctly", () => {
    const key = buildOverrideKey(
      "550e8400-e29b-41d4-a716-446655440000",
      "2026-02-28"
    );
    expect(key).toBe("550e8400-e29b-41d4-a716-446655440000:2026-02-28");
  });
});

describe("buildOverrideMap", () => {
  it("builds empty map from empty array", () => {
    const map = buildOverrideMap([]);
    expect(map.size).toBe(0);
  });

  it("builds map with single override", () => {
    const overrides: OccurrenceOverride[] = [
      {
        event_id: "event-1",
        date_key: "2026-01-15",
        status: "cancelled",
      },
    ];
    const map = buildOverrideMap(overrides);
    expect(map.size).toBe(1);
    expect(map.get("event-1:2026-01-15")?.status).toBe("cancelled");
  });

  it("builds map with multiple overrides for same event", () => {
    const overrides: OccurrenceOverride[] = [
      {
        event_id: "event-1",
        date_key: "2026-01-15",
        status: "cancelled",
      },
      {
        event_id: "event-1",
        date_key: "2026-01-22",
        status: "normal",
        override_start_time: "19:30",
      },
    ];
    const map = buildOverrideMap(overrides);
    expect(map.size).toBe(2);
    expect(map.get("event-1:2026-01-15")?.status).toBe("cancelled");
    expect(map.get("event-1:2026-01-22")?.status).toBe("normal");
    expect(map.get("event-1:2026-01-22")?.override_start_time).toBe("19:30");
  });

  it("builds map with overrides for multiple events", () => {
    const overrides: OccurrenceOverride[] = [
      {
        event_id: "event-1",
        date_key: "2026-01-15",
        status: "cancelled",
      },
      {
        event_id: "event-2",
        date_key: "2026-01-15",
        status: "normal",
        override_cover_image_url: "https://example.com/flyer.jpg",
      },
    ];
    const map = buildOverrideMap(overrides);
    expect(map.size).toBe(2);
    expect(map.get("event-1:2026-01-15")?.status).toBe("cancelled");
    expect(map.get("event-2:2026-01-15")?.override_cover_image_url).toBe(
      "https://example.com/flyer.jpg"
    );
  });

  it("preserves all override fields", () => {
    const override: OccurrenceOverride = {
      event_id: "event-1",
      date_key: "2026-01-15",
      status: "normal",
      override_start_time: "20:00",
      override_cover_image_url: "https://example.com/special-flyer.jpg",
      override_notes: "Special holiday edition!",
    };
    const map = buildOverrideMap([override]);
    const retrieved = map.get("event-1:2026-01-15");

    expect(retrieved?.status).toBe("normal");
    expect(retrieved?.override_start_time).toBe("20:00");
    expect(retrieved?.override_cover_image_url).toBe(
      "https://example.com/special-flyer.jpg"
    );
    expect(retrieved?.override_notes).toBe("Special holiday edition!");
  });
});

describe("expandAndGroupEvents with overrides", () => {
  // Wednesdays in January 2026: 7, 14, 21, 28
  const baseEvent: EventForOccurrence & { id: string } = {
    id: "weekly-event-1",
    day_of_week: "Wednesday",
    recurrence_rule: "weekly",
    start_time: "19:00",
  };

  it("marks cancelled occurrences as isCancelled", () => {
    const overrides: OccurrenceOverride[] = [
      {
        event_id: "weekly-event-1",
        date_key: "2026-01-14", // Second Wednesday
        status: "cancelled",
      },
    ];
    const overrideMap = buildOverrideMap(overrides);

    const result = expandAndGroupEvents([baseEvent], {
      startKey: "2026-01-01",
      endKey: "2026-01-31",
      maxOccurrences: 10,
      overrideMap,
    });

    // Cancelled occurrence should be in cancelledOccurrences, not groupedEvents
    expect(result.metrics.cancelledCount).toBe(1);
    expect(result.cancelledOccurrences.length).toBe(1);
    expect(result.cancelledOccurrences[0].dateKey).toBe("2026-01-14");
    expect(result.cancelledOccurrences[0].isCancelled).toBe(true);

    // Normal occurrences should be in groupedEvents
    const jan21Entries = result.groupedEvents.get("2026-01-21");
    expect(jan21Entries).toBeDefined();
    expect(jan21Entries?.[0].isCancelled).toBe(false);
  });

  it("attaches override data to occurrences", () => {
    const overrides: OccurrenceOverride[] = [
      {
        event_id: "weekly-event-1",
        date_key: "2026-01-21", // Third Wednesday
        status: "normal",
        override_start_time: "20:00",
        override_notes: "Starting late due to venue event",
      },
    ];
    const overrideMap = buildOverrideMap(overrides);

    const result = expandAndGroupEvents([baseEvent], {
      startKey: "2026-01-01",
      endKey: "2026-01-31",
      maxOccurrences: 10,
      overrideMap,
    });

    const jan21Entries = result.groupedEvents.get("2026-01-21");
    expect(jan21Entries).toBeDefined();
    expect(jan21Entries?.[0].override).toBeDefined();
    expect(jan21Entries?.[0].override?.override_start_time).toBe("20:00");
    expect(jan21Entries?.[0].override?.override_notes).toBe(
      "Starting late due to venue event"
    );
  });

  it("separates cancelled occurrences from normal ones", () => {
    // Mondays in Jan 1-14, 2026: 5, 12
    const events: (EventForOccurrence & { id: string })[] = [
      {
        id: "event-1",
        day_of_week: "Monday",
        recurrence_rule: "weekly",
        start_time: "19:00",
      },
      {
        id: "event-2",
        day_of_week: "Monday",
        recurrence_rule: "weekly",
        start_time: "20:00",
      },
    ];

    const overrides: OccurrenceOverride[] = [
      {
        event_id: "event-1",
        date_key: "2026-01-05", // First Monday
        status: "cancelled",
      },
    ];
    const overrideMap = buildOverrideMap(overrides);

    const result = expandAndGroupEvents(events, {
      startKey: "2026-01-01",
      endKey: "2026-01-14",
      maxOccurrences: 10,
      overrideMap,
    });

    // Event 1's first Monday is cancelled
    expect(result.cancelledOccurrences.length).toBe(1);
    expect(result.cancelledOccurrences[0].event.id).toBe("event-1");
    expect(result.cancelledOccurrences[0].dateKey).toBe("2026-01-05");

    // Event 2's first Monday is NOT cancelled
    const jan5Entries = result.groupedEvents.get("2026-01-05");
    expect(jan5Entries?.length).toBe(1);
    expect(jan5Entries?.[0].event.id).toBe("event-2");
  });

  it("handles multiple cancelled occurrences for one event", () => {
    const overrides: OccurrenceOverride[] = [
      {
        event_id: "weekly-event-1",
        date_key: "2026-01-14", // Second Wednesday
        status: "cancelled",
      },
      {
        event_id: "weekly-event-1",
        date_key: "2026-01-28", // Fourth Wednesday
        status: "cancelled",
      },
    ];
    const overrideMap = buildOverrideMap(overrides);

    const result = expandAndGroupEvents([baseEvent], {
      startKey: "2026-01-01",
      endKey: "2026-01-31",
      maxOccurrences: 10,
      overrideMap,
    });

    expect(result.metrics.cancelledCount).toBe(2);
    expect(result.cancelledOccurrences.length).toBe(2);
    expect(result.cancelledOccurrences.map((o) => o.dateKey)).toContain(
      "2026-01-14"
    );
    expect(result.cancelledOccurrences.map((o) => o.dateKey)).toContain(
      "2026-01-28"
    );

    // Non-cancelled occurrences should still be in groupedEvents (7th and 21st)
    expect(result.groupedEvents.get("2026-01-07")).toBeDefined();
    expect(result.groupedEvents.get("2026-01-21")).toBeDefined();
  });

  it("returns metrics including cancelledCount", () => {
    const overrides: OccurrenceOverride[] = [
      {
        event_id: "weekly-event-1",
        date_key: "2026-01-14", // Second Wednesday
        status: "cancelled",
      },
    ];
    const overrideMap = buildOverrideMap(overrides);

    const result = expandAndGroupEvents([baseEvent], {
      startKey: "2026-01-01",
      endKey: "2026-01-31",
      maxOccurrences: 10,
      overrideMap,
    });

    expect(result.metrics.cancelledCount).toBe(1);
    expect(result.metrics.eventsProcessed).toBe(1);
    expect(result.metrics.totalOccurrences).toBeGreaterThan(0);
  });

  it("works with no overrides (empty map)", () => {
    const overrideMap = buildOverrideMap([]);

    const result = expandAndGroupEvents([baseEvent], {
      startKey: "2026-01-01",
      endKey: "2026-01-31",
      maxOccurrences: 10,
      overrideMap,
    });

    expect(result.metrics.cancelledCount).toBe(0);
    expect(result.cancelledOccurrences.length).toBe(0);
    expect(result.groupedEvents.size).toBeGreaterThan(0);
  });

  it("works with undefined overrideMap", () => {
    const result = expandAndGroupEvents([baseEvent], {
      startKey: "2026-01-01",
      endKey: "2026-01-31",
      maxOccurrences: 10,
    });

    expect(result.metrics.cancelledCount).toBe(0);
    expect(result.cancelledOccurrences.length).toBe(0);
    expect(result.groupedEvents.size).toBeGreaterThan(0);
  });

  it("sorts cancelled occurrences by date", () => {
    // Wednesdays in January 2026: 7, 14, 21, 28
    const overrides: OccurrenceOverride[] = [
      {
        event_id: "weekly-event-1",
        date_key: "2026-01-21", // Third Wednesday
        status: "cancelled",
      },
      {
        event_id: "weekly-event-1",
        date_key: "2026-01-07", // First Wednesday
        status: "cancelled",
      },
      {
        event_id: "weekly-event-1",
        date_key: "2026-01-28", // Fourth Wednesday
        status: "cancelled",
      },
    ];
    const overrideMap = buildOverrideMap(overrides);

    const result = expandAndGroupEvents([baseEvent], {
      startKey: "2026-01-01",
      endKey: "2026-01-31",
      maxOccurrences: 10,
      overrideMap,
    });

    expect(result.cancelledOccurrences.map((o) => o.dateKey)).toEqual([
      "2026-01-07",
      "2026-01-21",
      "2026-01-28",
    ]);
  });
});

describe("Override status values", () => {
  it("treats 'normal' status as non-cancelled", () => {
    const override: OccurrenceOverride = {
      event_id: "event-1",
      date_key: "2026-01-15",
      status: "normal",
    };

    expect(override.status).toBe("normal");
    expect(override.status === "cancelled").toBe(false);
  });

  it("treats 'cancelled' status as cancelled", () => {
    const override: OccurrenceOverride = {
      event_id: "event-1",
      date_key: "2026-01-15",
      status: "cancelled",
    };

    expect(override.status).toBe("cancelled");
    expect(override.status === "cancelled").toBe(true);
  });
});
