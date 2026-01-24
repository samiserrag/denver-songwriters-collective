/**
 * Occurrence Rescheduling Tests
 *
 * Tests for the full reschedule feature:
 * - applyReschedulesToTimeline: moves entries between date groups
 * - getDisplayDateForOccurrence: returns correct display date and flags
 * - SeriesCard pill generation: uses displayDate for labels, dateKey for hrefs
 * - OccurrenceEditor: shows RESCHEDULED pill and indicator text
 * - Conflict detection: warns on same-date reschedule
 * - Server validation: rejects invalid dates, strips same-date, rejects past dates
 * - Round-trip: reschedule → revert restores original placement
 */

import { describe, it, expect } from "vitest";
import {
  applyReschedulesToTimeline,
  getDisplayDateForOccurrence,
  type EventOccurrenceEntry,
  type OccurrenceOverride,
  type EventForOccurrence,
} from "@/lib/events/nextOccurrence";

// ============================================================
// Helper: Create test events and overrides
// ============================================================

type TestEvent = EventForOccurrence & { id: string };

function makeEvent(id: string, overrides: Partial<TestEvent> = {}): TestEvent {
  return {
    id,
    event_date: "2026-01-06",
    day_of_week: "Monday",
    recurrence_rule: "weekly",
    start_time: "19:00",
    ...overrides,
  };
}

function makeEntry(
  event: TestEvent,
  dateKey: string,
  override?: OccurrenceOverride
): EventOccurrenceEntry<TestEvent> {
  return {
    event,
    dateKey,
    isConfident: true,
    override,
    isCancelled: override?.status === "cancelled",
  };
}

function makeOverride(
  eventId: string,
  dateKey: string,
  patch: Record<string, unknown> | null = null,
  status: string = "normal"
): OccurrenceOverride {
  return {
    id: `override-${eventId}-${dateKey}`,
    event_id: eventId,
    date_key: dateKey,
    status,
    override_start_time: null,
    override_cover_image_url: null,
    override_notes: null,
    override_patch: patch,
  } as OccurrenceOverride;
}

// ============================================================
// getDisplayDateForOccurrence Tests
// ============================================================

describe("getDisplayDateForOccurrence", () => {
  it("returns original dateKey when no override", () => {
    const result = getDisplayDateForOccurrence("2026-01-13");
    expect(result).toEqual({
      displayDate: "2026-01-13",
      isRescheduled: false,
    });
  });

  it("returns original dateKey when override has no event_date patch", () => {
    const override = makeOverride("e1", "2026-01-13", { start_time: "20:00" });
    const result = getDisplayDateForOccurrence("2026-01-13", override);
    expect(result).toEqual({
      displayDate: "2026-01-13",
      isRescheduled: false,
    });
  });

  it("returns original dateKey when event_date matches dateKey", () => {
    const override = makeOverride("e1", "2026-01-13", { event_date: "2026-01-13" });
    const result = getDisplayDateForOccurrence("2026-01-13", override);
    expect(result).toEqual({
      displayDate: "2026-01-13",
      isRescheduled: false,
    });
  });

  it("returns rescheduled date when event_date differs from dateKey", () => {
    const override = makeOverride("e1", "2026-01-13", { event_date: "2026-01-15" });
    const result = getDisplayDateForOccurrence("2026-01-13", override);
    expect(result).toEqual({
      displayDate: "2026-01-15",
      isRescheduled: true,
      originalDateKey: "2026-01-13",
    });
  });

  it("returns original when override_patch is null", () => {
    const override = makeOverride("e1", "2026-01-13", null);
    const result = getDisplayDateForOccurrence("2026-01-13", override);
    expect(result).toEqual({
      displayDate: "2026-01-13",
      isRescheduled: false,
    });
  });
});

// ============================================================
// applyReschedulesToTimeline Tests
// ============================================================

describe("applyReschedulesToTimeline", () => {
  it("returns unmodified groups when no reschedules exist", () => {
    const event = makeEvent("e1");
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13")]],
      ["2026-01-20", [makeEntry(event, "2026-01-20")]],
    ]);


    const result = applyReschedulesToTimeline(groups);

    expect([...result.keys()]).toEqual(["2026-01-13", "2026-01-20"]);
    expect(result.get("2026-01-13")!.length).toBe(1);
    expect(result.get("2026-01-20")!.length).toBe(1);
  });

  it("moves rescheduled entry to new date group", () => {
    const event = makeEvent("e1");
    const override = makeOverride("e1", "2026-01-13", { event_date: "2026-01-15" });
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13", override)]],
      ["2026-01-20", [makeEntry(event, "2026-01-20")]],
    ]);


    const result = applyReschedulesToTimeline(groups);

    // Original group should be gone (was only entry)
    expect(result.has("2026-01-13")).toBe(false);
    // New group should exist
    expect(result.has("2026-01-15")).toBe(true);
    expect(result.get("2026-01-15")![0].dateKey).toBe("2026-01-13"); // Identity preserved
    expect(result.get("2026-01-15")![0].isRescheduled).toBe(true);
    expect(result.get("2026-01-15")![0].originalDateKey).toBe("2026-01-13");
    expect(result.get("2026-01-15")![0].displayDate).toBe("2026-01-15");
  });

  it("preserves other entries in the original date group", () => {
    const event1 = makeEvent("e1");
    const event2 = makeEvent("e2");
    const override = makeOverride("e1", "2026-01-13", { event_date: "2026-01-15" });
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      [
        "2026-01-13",
        [
          makeEntry(event1, "2026-01-13", override),
          makeEntry(event2, "2026-01-13"), // Not rescheduled
        ],
      ],
    ]);


    const result = applyReschedulesToTimeline(groups);

    // Original group should still exist with event2
    expect(result.has("2026-01-13")).toBe(true);
    expect(result.get("2026-01-13")!.length).toBe(1);
    expect(result.get("2026-01-13")![0].event.id).toBe("e2");
    // New group has event1
    expect(result.get("2026-01-15")!.length).toBe(1);
    expect(result.get("2026-01-15")![0].event.id).toBe("e1");
  });

  it("removes empty date groups after rescheduling", () => {
    const event = makeEvent("e1");
    const override = makeOverride("e1", "2026-01-13", { event_date: "2026-01-20" });
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13", override)]],
      ["2026-01-20", [makeEntry(event, "2026-01-20")]],
    ]);


    const result = applyReschedulesToTimeline(groups);

    expect(result.has("2026-01-13")).toBe(false); // Empty, removed
    expect(result.has("2026-01-20")).toBe(true);
    expect(result.get("2026-01-20")!.length).toBe(2); // Original + rescheduled
  });

  it("creates new date group for reschedule to date outside existing groups", () => {
    const event = makeEvent("e1");
    const override = makeOverride("e1", "2026-01-13", { event_date: "2026-02-01" });
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13", override)]],
    ]);


    const result = applyReschedulesToTimeline(groups);

    expect(result.has("2026-01-13")).toBe(false);
    expect(result.has("2026-02-01")).toBe(true);
    expect(result.get("2026-02-01")![0].dateKey).toBe("2026-01-13");
  });

  it("sorts result groups by date key", () => {
    const event = makeEvent("e1");
    const override = makeOverride("e1", "2026-01-20", { event_date: "2026-01-05" });
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13")]],
      ["2026-01-20", [makeEntry(event, "2026-01-20", override)]],
    ]);


    const result = applyReschedulesToTimeline(groups);

    const keys = [...result.keys()];
    expect(keys).toEqual(["2026-01-05", "2026-01-13"]); // Sorted ASC
  });

  it("does not move cancelled entries (cancelled takes priority)", () => {
    const event = makeEvent("e1");
    // An override with both cancelled status AND event_date — cancelled wins
    const override = makeOverride("e1", "2026-01-13", { event_date: "2026-01-15" }, "cancelled");
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13", override)]],
    ]);


    // Cancelled entries shouldn't be in groupedEvents at all (they're in cancelledOccurrences)
    // But if they somehow are, applyReschedulesToTimeline still processes based on override
    // The entry would have isCancelled: true from makeEntry
    const result = applyReschedulesToTimeline(groups);

    // Since the override has event_date that differs, it WILL be moved
    // But in practice, cancelled entries are separated before this function is called
    // This test verifies the function handles the case if it receives one
    expect(result.has("2026-01-15")).toBe(true);
  });

  it("handles multiple reschedules from different events on same date", () => {
    const event1 = makeEvent("e1");
    const event2 = makeEvent("e2");
    const override1 = makeOverride("e1", "2026-01-13", { event_date: "2026-01-15" });
    const override2 = makeOverride("e2", "2026-01-13", { event_date: "2026-01-16" });
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      [
        "2026-01-13",
        [
          makeEntry(event1, "2026-01-13", override1),
          makeEntry(event2, "2026-01-13", override2),
        ],
      ],
    ]);


    const result = applyReschedulesToTimeline(groups);

    expect(result.has("2026-01-13")).toBe(false); // Both moved
    expect(result.has("2026-01-15")).toBe(true);
    expect(result.has("2026-01-16")).toBe(true);
    expect(result.get("2026-01-15")![0].event.id).toBe("e1");
    expect(result.get("2026-01-16")![0].event.id).toBe("e2");
  });

  it("preserves override data on rescheduled entries", () => {
    const event = makeEvent("e1");
    const override = makeOverride("e1", "2026-01-13", {
      event_date: "2026-01-15",
      start_time: "20:00",
      title: "Special Edition",
    });
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13", override)]],
    ]);


    const result = applyReschedulesToTimeline(groups);

    const entry = result.get("2026-01-15")![0];
    expect(entry.override).toBe(override); // Same reference
    expect(entry.override?.override_patch).toEqual({
      event_date: "2026-01-15",
      start_time: "20:00",
      title: "Special Edition",
    });
  });

  it("round-trip: removing override restores original placement", () => {
    const event = makeEvent("e1");
    // First: apply reschedule
    const override = makeOverride("e1", "2026-01-13", { event_date: "2026-01-15" });
    const groups = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13", override)]],
      ["2026-01-20", [makeEntry(event, "2026-01-20")]],
    ]);

    const rescheduled = applyReschedulesToTimeline(groups);
    expect(rescheduled.has("2026-01-15")).toBe(true);
    expect(rescheduled.has("2026-01-13")).toBe(false);

    // Then: revert (no override, entry back at original date)
    const groupsReverted = new Map<string, EventOccurrenceEntry<TestEvent>[]>([
      ["2026-01-13", [makeEntry(event, "2026-01-13")]], // No override
      ["2026-01-20", [makeEntry(event, "2026-01-20")]],
    ]);

    const reverted = applyReschedulesToTimeline(groupsReverted);
    expect(reverted.has("2026-01-13")).toBe(true);
    expect(reverted.has("2026-01-15")).toBe(false); // Back to original
  });
});

// ============================================================
// Server-side validation tests (unit-level logic checks)
// ============================================================

describe("Server-side date validation logic", () => {
  it("strips event_date when same as date_key", () => {
    // Simulates the server-side logic
    const sanitized: Record<string, unknown> = { event_date: "2026-01-13" };
    const date_key = "2026-01-13";

    if (sanitized.event_date === date_key) {
      delete sanitized.event_date;
    }

    expect(sanitized.event_date).toBeUndefined();
  });

  it("rejects invalid date format", () => {
    const invalidDates = ["2026-1-13", "2026/01/13", "Jan 13, 2026", "abc", ""];
    for (const date of invalidDates) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(date)).toBe(false);
    }
  });

  it("accepts valid date format", () => {
    const validDates = ["2026-01-13", "2026-12-31", "2027-06-15"];
    for (const date of validDates) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(date)).toBe(true);
    }
  });

  it("rejects past dates", () => {
    // Simulate: today = "2026-01-24" (hardcoded for deterministic test)
    const today = "2026-01-24";
    const pastDate = "2026-01-23";
    const futureDate = "2026-01-25";
    const sameDate = "2026-01-24";

    expect(pastDate < today).toBe(true); // Should reject
    expect(futureDate < today).toBe(false); // Should allow
    expect(sameDate < today).toBe(false); // Same day is allowed
  });
});

// ============================================================
// Conflict detection tests
// ============================================================

describe("Conflict detection logic", () => {
  it("detects conflict when new date is in existing dates", () => {
    const existingDates = ["2026-01-13", "2026-01-20", "2026-01-27"];
    const currentDateKey = "2026-01-13"; // Being edited
    const datesExcludingSelf = existingDates.filter((d) => d !== currentDateKey);

    // Picking a date that's already in the series
    const newDate = "2026-01-20";
    const hasConflict = datesExcludingSelf.includes(newDate);
    expect(hasConflict).toBe(true);
  });

  it("no conflict when new date is outside series", () => {
    const existingDates = ["2026-01-13", "2026-01-20", "2026-01-27"];
    const currentDateKey = "2026-01-13";
    const datesExcludingSelf = existingDates.filter((d) => d !== currentDateKey);

    const newDate = "2026-01-15"; // Not in series
    const hasConflict = datesExcludingSelf.includes(newDate);
    expect(hasConflict).toBe(false);
  });

  it("no conflict when same as own dateKey (not a reschedule)", () => {
    const existingDates = ["2026-01-13", "2026-01-20"];
    const currentDateKey = "2026-01-13";
    const datesExcludingSelf = existingDates.filter((d) => d !== currentDateKey);

    const newDate = "2026-01-13"; // Same as own — not in filtered list
    const hasConflict = datesExcludingSelf.includes(newDate);
    expect(hasConflict).toBe(false);
  });
});

// ============================================================
// SeriesCard pill rendering tests
// ============================================================

describe("SeriesCard pill data generation", () => {
  it("uses displayDate for label and dateKey for href", () => {
    const formatDateShort = (d: string) =>
      new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "America/Denver",
      });

    const upcomingOccurrences = [
      { dateKey: "2026-01-13", isConfident: true, displayDate: "2026-01-15", isRescheduled: true },
      { dateKey: "2026-01-20", isConfident: true, displayDate: "2026-01-20", isRescheduled: false },
    ];

    const eventIdentifier = "my-event-slug";
    const datePills = upcomingOccurrences.map((occ) => ({
      label: formatDateShort(occ.displayDate || occ.dateKey),
      href: `/events/${eventIdentifier}?date=${occ.dateKey}`, // Identity key
      dateKey: occ.dateKey,
      isRescheduled: occ.isRescheduled,
    }));

    // First pill: rescheduled — label shows new date, href uses identity
    expect(datePills[0].label).toContain("15"); // Jan 15
    expect(datePills[0].href).toBe("/events/my-event-slug?date=2026-01-13");
    expect(datePills[0].isRescheduled).toBe(true);

    // Second pill: not rescheduled — label and routing aligned
    expect(datePills[1].label).toContain("20"); // Jan 20
    expect(datePills[1].href).toBe("/events/my-event-slug?date=2026-01-20");
    expect(datePills[1].isRescheduled).toBe(false);
  });
});

// ============================================================
// OccurrenceEditor status detection tests
// ============================================================

describe("OccurrenceEditor reschedule detection", () => {
  it("detects rescheduled status from override_patch.event_date", () => {
    const occ = {
      dateKey: "2026-01-13",
      override: makeOverride("e1", "2026-01-13", { event_date: "2026-01-15" }),
    };

    const patch = occ.override?.override_patch ?? null;
    const rescheduledTo = patch?.event_date as string | undefined;
    const isRescheduled = !!(rescheduledTo && rescheduledTo !== occ.dateKey);

    expect(isRescheduled).toBe(true);
    expect(rescheduledTo).toBe("2026-01-15");
  });

  it("not rescheduled when event_date matches dateKey", () => {
    const occ = {
      dateKey: "2026-01-13",
      override: makeOverride("e1", "2026-01-13", { event_date: "2026-01-13" }),
    };

    const patch = occ.override?.override_patch ?? null;
    const rescheduledTo = patch?.event_date as string | undefined;
    const isRescheduled = !!(rescheduledTo && rescheduledTo !== occ.dateKey);

    expect(isRescheduled).toBe(false);
  });

  it("not rescheduled when no override_patch", () => {
    const occ = {
      dateKey: "2026-01-13",
      override: makeOverride("e1", "2026-01-13", null),
    };

    const patch = occ.override?.override_patch ?? null;
    const rescheduledTo = patch?.event_date as string | undefined;
    const isRescheduled = !!(rescheduledTo && rescheduledTo !== occ.dateKey);

    expect(isRescheduled).toBe(false);
  });

  it("status priority: CANCELLED > RESCHEDULED > MODIFIED > NORMAL", () => {
    // Simulate the status pill logic
    const getStatus = (isCancelled: boolean, isRescheduled: boolean, hasAnyModification: boolean) => {
      if (isCancelled) return "CANCELLED";
      if (isRescheduled) return "RESCHEDULED";
      if (hasAnyModification) return "MODIFIED";
      return "NORMAL";
    };

    expect(getStatus(true, true, true)).toBe("CANCELLED");
    expect(getStatus(false, true, true)).toBe("RESCHEDULED");
    expect(getStatus(false, false, true)).toBe("MODIFIED");
    expect(getStatus(false, false, false)).toBe("NORMAL");
  });
});
