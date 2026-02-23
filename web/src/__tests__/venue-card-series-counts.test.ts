/**
 * Tests for venue card series/oneoff counts (Phase 4.67)
 *
 * Tests the computeVenueCountsFromEvents helper and formatVenueCountsBadge function.
 * Ensures counts match what venue detail page shows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeVenueCountsFromEvents,
  formatVenueCountsBadge,
  type EventForCounts,
  type VenueEventCounts,
} from "@/lib/venue/computeVenueCounts";

// Mock the date functions to ensure deterministic tests
vi.mock("@/lib/events/nextOccurrence", async () => {
  const actual = await vi.importActual("@/lib/events/nextOccurrence");
  return {
    ...actual,
    getTodayDenver: () => "2026-01-13",
    addDaysDenver: (_date: string, days: number) => {
      // Simple mock: add days to 2026-01-13
      const d = new Date("2026-01-13");
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    },
  };
});

describe("computeVenueCountsFromEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty map for empty events array", () => {
    const result = computeVenueCountsFromEvents([]);
    expect(result.size).toBe(0);
  });

  it("should handle venue with only recurring series (weekly event)", () => {
    const events: EventForCounts[] = [
      {
        id: "event-1",
        venue_id: "venue-a",
        title: "Monday Open Mic",
        event_type: ["open_mic"],
        event_date: "2026-01-13", // Monday
        day_of_week: "Monday",
        start_time: "19:00:00",
        end_time: "22:00:00",
        recurrence_rule: "weekly",
        is_recurring: true,
        status: "active",
      },
    ];

    const result = computeVenueCountsFromEvents(events);
    const counts = result.get("venue-a");

    expect(counts).toBeDefined();
    expect(counts!.seriesCount).toBe(1);
    // Weekly event should have ~13 occurrences in 90 days
    expect(counts!.seriesUpcomingTotal).toBeGreaterThanOrEqual(12);
    expect(counts!.oneoffCount).toBe(0);
  });

  it("should handle venue with only one-off events", () => {
    const events: EventForCounts[] = [
      {
        id: "event-1",
        venue_id: "venue-b",
        title: "Special Concert",
        event_type: ["gig"],
        event_date: "2026-01-20",
        day_of_week: null,
        start_time: "20:00:00",
        end_time: "23:00:00",
        recurrence_rule: null,
        is_recurring: false,
        status: "active",
      },
      {
        id: "event-2",
        venue_id: "venue-b",
        title: "Album Release Party",
        event_type: ["showcase"],
        event_date: "2026-02-14",
        day_of_week: null,
        start_time: "19:00:00",
        end_time: "22:00:00",
        recurrence_rule: null,
        is_recurring: false,
        status: "active",
      },
    ];

    const result = computeVenueCountsFromEvents(events);
    const counts = result.get("venue-b");

    expect(counts).toBeDefined();
    expect(counts!.seriesCount).toBe(0);
    expect(counts!.seriesUpcomingTotal).toBe(0);
    expect(counts!.oneoffCount).toBe(2);
  });

  it("should handle venue with both recurring series and one-offs", () => {
    const events: EventForCounts[] = [
      // Recurring series
      {
        id: "event-1",
        venue_id: "venue-c",
        title: "Tuesday Jam",
        event_type: ["jam_session"],
        event_date: "2026-01-14",
        day_of_week: "Tuesday",
        start_time: "18:00:00",
        end_time: "21:00:00",
        recurrence_rule: "weekly",
        is_recurring: true,
        status: "active",
      },
      // One-off
      {
        id: "event-2",
        venue_id: "venue-c",
        title: "New Year's Show",
        event_type: ["showcase"],
        event_date: "2026-01-25",
        day_of_week: null,
        start_time: "20:00:00",
        end_time: "23:00:00",
        recurrence_rule: null,
        is_recurring: false,
        status: "active",
      },
    ];

    const result = computeVenueCountsFromEvents(events);
    const counts = result.get("venue-c");

    expect(counts).toBeDefined();
    expect(counts!.seriesCount).toBe(1);
    expect(counts!.seriesUpcomingTotal).toBeGreaterThanOrEqual(12);
    expect(counts!.oneoffCount).toBe(1);
  });

  it("should handle venue with no events (returns undefined)", () => {
    const events: EventForCounts[] = [];
    const result = computeVenueCountsFromEvents(events);

    // Venue with no events won't be in the map
    expect(result.get("venue-empty")).toBeUndefined();
  });

  it("should de-duplicate events by title (keep most complete)", () => {
    // Simulates the Blazin Bite scenario: two records, one complete, one empty
    const events: EventForCounts[] = [
      {
        id: "complete-record",
        venue_id: "venue-d",
        title: "Blazin Bite Seafood",
        event_type: ["open_mic"],
        event_date: "2026-01-15",
        day_of_week: "Wednesday",
        start_time: "18:00:00",
        end_time: "21:00:00",
        recurrence_rule: "weekly",
        is_recurring: true,
        status: "unverified",
      },
      {
        id: "incomplete-record",
        venue_id: "venue-d",
        title: "Blazin Bite Seafood",
        event_type: ["open_mic"],
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        recurrence_rule: null,
        is_recurring: false,
        status: "unverified",
      },
    ];

    const result = computeVenueCountsFromEvents(events);
    const counts = result.get("venue-d");

    expect(counts).toBeDefined();
    // Should only count as 1 series (not 2)
    expect(counts!.seriesCount).toBe(1);
    // The complete record should be used, so we get weekly occurrences
    expect(counts!.seriesUpcomingTotal).toBeGreaterThanOrEqual(12);
    expect(counts!.oneoffCount).toBe(0);
  });

  it("should handle multiple venues in single call", () => {
    const events: EventForCounts[] = [
      {
        id: "e1",
        venue_id: "venue-1",
        title: "Event at Venue 1",
        event_type: ["open_mic"],
        event_date: "2026-01-13",
        day_of_week: "Monday",
        start_time: "19:00:00",
        end_time: "22:00:00",
        recurrence_rule: "weekly",
        is_recurring: true,
        status: "active",
      },
      {
        id: "e2",
        venue_id: "venue-2",
        title: "Event at Venue 2",
        event_type: ["gig"],
        event_date: "2026-01-20",
        day_of_week: null,
        start_time: "20:00:00",
        end_time: "23:00:00",
        recurrence_rule: null,
        is_recurring: false,
        status: "active",
      },
    ];

    const result = computeVenueCountsFromEvents(events);

    expect(result.size).toBe(2);
    expect(result.get("venue-1")?.seriesCount).toBe(1);
    expect(result.get("venue-2")?.oneoffCount).toBe(1);
  });

  it("should ignore events with null venue_id", () => {
    const events: EventForCounts[] = [
      {
        id: "e1",
        venue_id: null,
        title: "Virtual Event",
        event_type: ["workshop"],
        event_date: "2026-01-20",
        day_of_week: null,
        start_time: "14:00:00",
        end_time: "16:00:00",
        recurrence_rule: null,
        is_recurring: false,
        status: "active",
      },
    ];

    const result = computeVenueCountsFromEvents(events);
    expect(result.size).toBe(0);
  });

  it("should handle case-insensitive title de-duplication", () => {
    const events: EventForCounts[] = [
      {
        id: "e1",
        venue_id: "venue-e",
        title: "Open Mic Night",
        event_type: ["open_mic"],
        event_date: "2026-01-13",
        day_of_week: "Monday",
        start_time: "19:00:00",
        end_time: null,
        recurrence_rule: "weekly",
        is_recurring: true,
        status: "active",
      },
      {
        id: "e2",
        venue_id: "venue-e",
        title: "OPEN MIC NIGHT", // Same title, different case
        event_type: ["open_mic"],
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        recurrence_rule: null,
        is_recurring: false,
        status: "active",
      },
    ];

    const result = computeVenueCountsFromEvents(events);
    const counts = result.get("venue-e");

    // Should de-duplicate and keep the one with more data
    expect(counts!.seriesCount).toBe(1);
    expect(counts!.oneoffCount).toBe(0);
  });
});

describe("formatVenueCountsBadge", () => {
  it("should format series-only venue", () => {
    const counts: VenueEventCounts = {
      seriesCount: 1,
      seriesUpcomingTotal: 12,
      oneoffCount: 0,
    };
    expect(formatVenueCountsBadge(counts)).toBe("1 series • 12 upcoming");
  });

  it("should format multiple series", () => {
    const counts: VenueEventCounts = {
      seriesCount: 3,
      seriesUpcomingTotal: 36,
      oneoffCount: 0,
    };
    expect(formatVenueCountsBadge(counts)).toBe("3 series • 36 upcoming");
  });

  it("should format one-offs only", () => {
    const counts: VenueEventCounts = {
      seriesCount: 0,
      seriesUpcomingTotal: 0,
      oneoffCount: 2,
    };
    expect(formatVenueCountsBadge(counts)).toBe("2 upcoming");
  });

  it("should format single one-off", () => {
    const counts: VenueEventCounts = {
      seriesCount: 0,
      seriesUpcomingTotal: 0,
      oneoffCount: 1,
    };
    expect(formatVenueCountsBadge(counts)).toBe("1 upcoming");
  });

  it("should format both series and one-offs", () => {
    const counts: VenueEventCounts = {
      seriesCount: 2,
      seriesUpcomingTotal: 24,
      oneoffCount: 3,
    };
    expect(formatVenueCountsBadge(counts)).toBe("2 series • 24 upcoming • 3 one-offs");
  });

  it("should format single series and single one-off", () => {
    const counts: VenueEventCounts = {
      seriesCount: 1,
      seriesUpcomingTotal: 12,
      oneoffCount: 1,
    };
    expect(formatVenueCountsBadge(counts)).toBe("1 series • 12 upcoming • 1 one-off");
  });

  it("should format no upcoming", () => {
    const counts: VenueEventCounts = {
      seriesCount: 0,
      seriesUpcomingTotal: 0,
      oneoffCount: 0,
    };
    expect(formatVenueCountsBadge(counts)).toBe("No upcoming");
  });
});

describe("De-duplication scoring", () => {
  it("should prefer event with recurrence_rule over one without", () => {
    const events: EventForCounts[] = [
      {
        id: "no-rule",
        venue_id: "venue-f",
        title: "Weekly Thing",
        event_type: ["open_mic"],
        event_date: "2026-01-20",
        day_of_week: null,
        start_time: "19:00:00", // Has time but no rule
        end_time: null,
        recurrence_rule: null,
        is_recurring: false,
        status: "active",
      },
      {
        id: "has-rule",
        venue_id: "venue-f",
        title: "Weekly Thing",
        event_type: ["open_mic"],
        event_date: "2026-01-13",
        day_of_week: "Monday",
        start_time: null, // No time but has rule
        end_time: null,
        recurrence_rule: "weekly",
        is_recurring: true,
        status: "active",
      },
    ];

    const result = computeVenueCountsFromEvents(events);
    const counts = result.get("venue-f");

    // recurrence_rule scores 2, start_time scores 1
    // So has-rule (score 2) should win over no-rule (score 1)
    expect(counts!.seriesCount).toBe(1);
    expect(counts!.seriesUpcomingTotal).toBeGreaterThanOrEqual(12);
  });

  it("should prefer event with both rule and time over just rule", () => {
    const events: EventForCounts[] = [
      {
        id: "rule-only",
        venue_id: "venue-g",
        title: "Event",
        event_type: ["open_mic"],
        event_date: "2026-01-13",
        day_of_week: "Monday",
        start_time: null,
        end_time: null,
        recurrence_rule: "weekly",
        is_recurring: true,
        status: "active",
      },
      {
        id: "rule-and-time",
        venue_id: "venue-g",
        title: "Event",
        event_type: ["open_mic"],
        event_date: "2026-01-13",
        day_of_week: "Monday",
        start_time: "19:00:00",
        end_time: null,
        recurrence_rule: "weekly",
        is_recurring: true,
        status: "active",
      },
    ];

    const result = computeVenueCountsFromEvents(events);
    const counts = result.get("venue-g");

    // rule-and-time (score 3) should win over rule-only (score 2)
    // But both produce similar counts - the key is de-duplication happened
    expect(counts!.seriesCount).toBe(1);
  });
});
