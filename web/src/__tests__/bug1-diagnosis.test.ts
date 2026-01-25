/**
 * Bug #1 and #3 Diagnostic Test
 *
 * PHASE 4.83: This test now validates the FIX behavior.
 * The defensive fallback in interpretRecurrence() now derives day_of_week
 * from event_date when day_of_week is null.
 */

import { describe, it, expect } from "vitest";
import { interpretRecurrence, labelFromRecurrence } from "@/lib/events/recurrenceContract";
import { expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";

describe("Bug #1 FIX: Monthly ordinal with missing day_of_week now derives from event_date", () => {
  // Production data: Lone Tree Open Mic (before fix: day_of_week was null)
  // 2026-01-24 is a Saturday
  const bug1Event = {
    event_date: "2026-01-24",
    day_of_week: null, // Missing, but now derived from event_date
    recurrence_rule: "4th",
  };

  it("interpretRecurrence derives dayOfWeekIndex from event_date when day_of_week is null", () => {
    const rec = interpretRecurrence(bug1Event);
    expect(rec.isRecurring).toBe(true);
    expect(rec.frequency).toBe("monthly");
    expect(rec.ordinals).toEqual([4]);
    // FIX: dayOfWeekIndex is now derived from event_date (2026-01-24 = Saturday = 6)
    expect(rec.dayOfWeekIndex).toBe(6);
    expect(rec.dayName).toBe("Saturday");
    expect(rec.isConfident).toBe(true);
  });

  it("labelFromRecurrence returns full label with derived day", () => {
    const rec = interpretRecurrence(bug1Event);
    const label = labelFromRecurrence(rec);
    // FIX: Now correctly returns "4th Saturday of the Month"
    expect(label).toBe("4th Saturday of the Month");
  });

  it("expandOccurrencesForEvent returns occurrences using derived day", () => {
    const occurrences = expandOccurrencesForEvent(bug1Event, {
      startKey: "2026-01-24",
      endKey: "2026-04-24",
    });
    // FIX: Now returns 4th Saturdays: Jan 24, Feb 28, Mar 28
    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences[0].dateKey).toBe("2026-01-24");
  });

  // Explicit day_of_week still works
  it("still works when day_of_week is explicitly set", () => {
    const explicitEvent = {
      ...bug1Event,
      day_of_week: "Saturday",
    };
    const rec = interpretRecurrence(explicitEvent);
    expect(rec.isConfident).toBe(true);
    expect(rec.dayName).toBe("Saturday");

    const occurrences = expandOccurrencesForEvent(explicitEvent, {
      startKey: "2026-01-24",
      endKey: "2026-04-24",
    });
    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences[0].dateKey).toBe("2026-01-24");
  });
});

describe("Bug #3: Event with event_date today but missing occurrences", () => {
  // Zymos Brewing - has event_date='2026-01-24' but no day_of_week, no recurrence_rule
  const bug3Event = {
    event_date: "2026-01-24",
    day_of_week: null,
    recurrence_rule: null,
  };

  it("treats as one-time event", () => {
    const rec = interpretRecurrence(bug3Event);
    expect(rec.isRecurring).toBe(false);
    expect(rec.frequency).toBe("one-time");
    expect(rec.isConfident).toBe(true);
  });

  it("expands to single occurrence on event_date", () => {
    const occurrences = expandOccurrencesForEvent(bug3Event, {
      startKey: "2026-01-24",
      endKey: "2026-04-24",
    });
    expect(occurrences.length).toBe(1);
    expect(occurrences[0].dateKey).toBe("2026-01-24");
  });
});
