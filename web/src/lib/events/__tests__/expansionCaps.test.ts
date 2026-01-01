/**
 * Performance Caps Regression Tests
 *
 * Ensures the occurrence expansion function enforces hard caps
 * to prevent runaway processing on large datasets.
 */

import { describe, it, expect } from "vitest";
import {
  expandAndGroupEvents,
  expandOccurrencesForEvent,
  EXPANSION_CAPS,
  type EventForOccurrence,
} from "../nextOccurrence";

// Helper to create mock events
function createMockEvent(
  id: string,
  overrides: Partial<EventForOccurrence & { id: string }> = {}
): EventForOccurrence & { id: string } {
  return {
    id,
    day_of_week: "Wednesday",
    recurrence_rule: "weekly",
    start_time: "19:00",
    ...overrides,
  };
}

describe("EXPANSION_CAPS constants", () => {
  it("should have reasonable default values", () => {
    expect(EXPANSION_CAPS.MAX_EVENTS).toBeGreaterThanOrEqual(100);
    expect(EXPANSION_CAPS.MAX_EVENTS).toBeLessThanOrEqual(500);

    expect(EXPANSION_CAPS.MAX_TOTAL_OCCURRENCES).toBeGreaterThanOrEqual(100);
    expect(EXPANSION_CAPS.MAX_TOTAL_OCCURRENCES).toBeLessThanOrEqual(1000);

    expect(EXPANSION_CAPS.MAX_PER_EVENT).toBeGreaterThanOrEqual(10);
    expect(EXPANSION_CAPS.MAX_PER_EVENT).toBeLessThanOrEqual(100);

    expect(EXPANSION_CAPS.DEFAULT_WINDOW_DAYS).toBeGreaterThanOrEqual(30);
    expect(EXPANSION_CAPS.DEFAULT_WINDOW_DAYS).toBeLessThanOrEqual(180);
  });

  it("should be exported for use in queries", () => {
    // Ensure constants are accessible for query limits
    expect(typeof EXPANSION_CAPS.MAX_EVENTS).toBe("number");
    expect(typeof EXPANSION_CAPS.MAX_TOTAL_OCCURRENCES).toBe("number");
    expect(typeof EXPANSION_CAPS.MAX_PER_EVENT).toBe("number");
  });
});

describe("expandOccurrencesForEvent - per-event cap", () => {
  it("should limit occurrences per event to MAX_PER_EVENT", () => {
    const event = createMockEvent("weekly-event", {
      day_of_week: "Monday",
      recurrence_rule: "weekly",
    });

    const occurrences = expandOccurrencesForEvent(event, {
      startKey: "2025-01-01",
      endKey: "2025-12-31", // 365 days = ~52 Mondays
    });

    // Should cap at MAX_PER_EVENT (40)
    expect(occurrences.length).toBeLessThanOrEqual(EXPANSION_CAPS.MAX_PER_EVENT);
  });

  it("should respect custom maxOccurrences option", () => {
    const event = createMockEvent("weekly-event", {
      day_of_week: "Monday",
      recurrence_rule: "weekly",
    });

    const occurrences = expandOccurrencesForEvent(event, {
      startKey: "2025-01-01",
      endKey: "2025-12-31",
      maxOccurrences: 5,
    });

    expect(occurrences.length).toBeLessThanOrEqual(5);
  });
});

describe("expandAndGroupEvents - event cap", () => {
  it("should limit events processed to maxEvents", () => {
    // Create 300 events (more than MAX_EVENTS=200)
    const events = Array.from({ length: 300 }, (_, i) =>
      createMockEvent(`event-${i}`, {
        event_date: "2025-01-15", // One-time events for simplicity
      })
    );

    const result = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-01-31",
    });

    // Should process at most MAX_EVENTS
    expect(result.metrics.eventsProcessed).toBeLessThanOrEqual(EXPANSION_CAPS.MAX_EVENTS);
    expect(result.metrics.eventsSkipped).toBe(300 - EXPANSION_CAPS.MAX_EVENTS);
    expect(result.metrics.wasCapped).toBe(true);
  });

  it("should respect custom maxEvents option", () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      createMockEvent(`event-${i}`, {
        event_date: "2025-01-15",
      })
    );

    const result = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-01-31",
      maxEvents: 10,
    });

    expect(result.metrics.eventsProcessed).toBeLessThanOrEqual(10);
    expect(result.metrics.eventsSkipped).toBe(40);
    expect(result.metrics.wasCapped).toBe(true);
  });

  it("should not cap when under limit", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      createMockEvent(`event-${i}`, {
        event_date: "2025-01-15",
      })
    );

    const result = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-01-31",
    });

    expect(result.metrics.eventsProcessed).toBe(10);
    expect(result.metrics.eventsSkipped).toBe(0);
    expect(result.metrics.wasCapped).toBe(false);
  });
});

describe("expandAndGroupEvents - total occurrences cap", () => {
  it("should limit total occurrences to maxTotalOccurrences", () => {
    // Create 100 weekly events, each generating ~13 occurrences in 90 days
    // Total potential: 100 * 13 = 1300 occurrences (exceeds 500)
    const events = Array.from({ length: 100 }, (_, i) =>
      createMockEvent(`weekly-${i}`, {
        day_of_week: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i % 7],
        recurrence_rule: "weekly",
      })
    );

    const result = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-03-31", // 90 days
    });

    // Should cap total occurrences at MAX_TOTAL_OCCURRENCES
    expect(result.metrics.totalOccurrences).toBeLessThanOrEqual(EXPANSION_CAPS.MAX_TOTAL_OCCURRENCES);
    expect(result.metrics.wasCapped).toBe(true);
  });

  it("should respect custom maxTotalOccurrences option", () => {
    // Create 10 weekly events
    const events = Array.from({ length: 10 }, (_, i) =>
      createMockEvent(`weekly-${i}`, {
        day_of_week: "Wednesday",
        recurrence_rule: "weekly",
      })
    );

    const result = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-03-31",
      maxTotalOccurrences: 20,
    });

    expect(result.metrics.totalOccurrences).toBeLessThanOrEqual(20);
    expect(result.metrics.wasCapped).toBe(true);
  });
});

describe("expandAndGroupEvents - metrics reporting", () => {
  it("should return accurate metrics", () => {
    const events = [
      createMockEvent("single", { event_date: "2025-01-15" }),
      createMockEvent("weekly", { day_of_week: "Monday", recurrence_rule: "weekly" }),
      // Event with no date info will be marked as unknown
      createMockEvent("unknown", { day_of_week: undefined, event_date: undefined, recurrence_rule: undefined }),
    ];

    const result = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-01-31",
    });

    expect(result.metrics.eventsProcessed).toBe(3);
    expect(result.metrics.eventsSkipped).toBe(0);
    // 1 occurrence from single + ~4-5 from weekly
    expect(result.metrics.totalOccurrences).toBeGreaterThanOrEqual(1);
    expect(result.unknownEvents).toHaveLength(1);
    expect(result.unknownEvents[0].id).toBe("unknown");
  });

  it("should indicate wasCapped when hitting any cap", () => {
    // Test event cap
    const manyEvents = Array.from({ length: 250 }, (_, i) =>
      createMockEvent(`event-${i}`, { event_date: "2025-01-15" })
    );
    const result1 = expandAndGroupEvents(manyEvents, {
      startKey: "2025-01-01",
      endKey: "2025-01-31",
    });
    expect(result1.metrics.wasCapped).toBe(true);

    // Test occurrence cap with fewer events but many occurrences
    const fewWeeklyEvents = Array.from({ length: 50 }, (_, i) =>
      createMockEvent(`weekly-${i}`, {
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      })
    );
    const result2 = expandAndGroupEvents(fewWeeklyEvents, {
      startKey: "2025-01-01",
      endKey: "2025-12-31", // Year-long window
      maxTotalOccurrences: 100, // Force cap
    });
    expect(result2.metrics.wasCapped).toBe(true);
  });
});

describe("expandAndGroupEvents - deterministic behavior", () => {
  it("should process events in order when capped", () => {
    // Events should be processed in array order
    const events = Array.from({ length: 20 }, (_, i) =>
      createMockEvent(`event-${i.toString().padStart(2, "0")}`, {
        event_date: "2025-01-15",
      })
    );

    const result = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-01-31",
      maxEvents: 5,
    });

    // Check that first 5 events were processed
    const processedEventIds = new Set<string>();
    for (const entries of result.groupedEvents.values()) {
      for (const entry of entries) {
        processedEventIds.add(entry.event.id);
      }
    }

    // Should have exactly the first 5 events
    expect(processedEventIds.size).toBe(5);
    expect(processedEventIds.has("event-00")).toBe(true);
    expect(processedEventIds.has("event-04")).toBe(true);
    expect(processedEventIds.has("event-05")).toBe(false);
  });

  it("should be deterministic with same input", () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      createMockEvent(`event-${i}`, {
        day_of_week: "Wednesday",
        recurrence_rule: "weekly",
      })
    );

    const result1 = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-02-28",
      maxTotalOccurrences: 100,
    });

    const result2 = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-02-28",
      maxTotalOccurrences: 100,
    });

    expect(result1.metrics).toEqual(result2.metrics);
    expect([...result1.groupedEvents.keys()]).toEqual([...result2.groupedEvents.keys()]);
  });
});

describe("Homepage-specific scenarios", () => {
  it("should handle single-day window efficiently (Tonight's Happenings)", () => {
    // Simulate homepage query: single day, many events
    const events = Array.from({ length: 100 }, (_, i) =>
      createMockEvent(`event-${i}`, {
        day_of_week: "Wednesday",
        recurrence_rule: "weekly",
        start_time: `${18 + (i % 4)}:00`,
      })
    );

    const today = "2025-01-08"; // A Wednesday
    const result = expandAndGroupEvents(events, {
      startKey: today,
      endKey: today, // Same day = single day window
    });

    // Should only generate 1 occurrence per matching event
    // (only Wednesday events match)
    expect(result.metrics.totalOccurrences).toBeLessThanOrEqual(100);

    // All occurrences should be for today
    const todaysEvents = result.groupedEvents.get(today) ?? [];
    expect(todaysEvents.length).toBe(result.metrics.totalOccurrences);
  });

  it("should complete expansion in reasonable time", () => {
    // Stress test: maximum allowed events with weekly recurrence
    const events = Array.from({ length: EXPANSION_CAPS.MAX_EVENTS }, (_, i) =>
      createMockEvent(`event-${i}`, {
        day_of_week: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i % 7],
        recurrence_rule: "weekly",
      })
    );

    const start = performance.now();
    const result = expandAndGroupEvents(events, {
      startKey: "2025-01-01",
      endKey: "2025-03-31", // 90 days
    });
    const elapsed = performance.now() - start;

    // Should complete within 100ms even with max events
    expect(elapsed).toBeLessThan(100);

    // Verify caps were applied
    expect(result.metrics.totalOccurrences).toBeLessThanOrEqual(EXPANSION_CAPS.MAX_TOTAL_OCCURRENCES);
  });
});
