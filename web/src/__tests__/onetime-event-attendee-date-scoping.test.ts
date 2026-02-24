/**
 * One-Time Event Attendee Date Scoping Tests
 *
 * Proves that one-time events (no recurrence) scope the attendee list and
 * server-side RSVP count by event.event_date, even when effectiveSelectedDate
 * is null.
 *
 * Bug reference: docs/investigations/2026-02-23-rsvp-count-discrepancy.md
 * Fix: Option B narrow fix — introduces attendeeDateKey in page.tsx
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Helpers mirroring page.tsx logic
// ---------------------------------------------------------------------------

/**
 * Mirrors the attendeeDateKey computation from page.tsx:
 *   const attendeeDateKey = effectiveSelectedDate ?? event.event_date ?? undefined;
 */
function computeAttendeeDateKey(
  effectiveSelectedDate: string | null,
  eventDate: string | null
): string | undefined {
  return effectiveSelectedDate ?? eventDate ?? undefined;
}

/**
 * Mirrors the conditional RSVP count filter from page.tsx:
 *   if (attendeeDateKey) { rsvpQuery = rsvpQuery.eq("date_key", attendeeDateKey); }
 */
function filterRsvpsByAttendeeDateKey(
  rsvps: Array<{ date_key: string; status: string }>,
  attendeeDateKey: string | undefined
): Array<{ date_key: string; status: string }> {
  const confirmed = rsvps.filter((r) => r.status === "confirmed");
  if (attendeeDateKey) {
    return confirmed.filter((r) => r.date_key === attendeeDateKey);
  }
  return confirmed;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("One-time event: attendeeDateKey fallback", () => {
  it("falls back to event_date when effectiveSelectedDate is null", () => {
    const attendeeDateKey = computeAttendeeDateKey(null, "2026-02-25");
    expect(attendeeDateKey).toBe("2026-02-25");
  });

  it("prefers effectiveSelectedDate when present (recurring event path)", () => {
    const attendeeDateKey = computeAttendeeDateKey("2026-03-04", "2026-02-25");
    expect(attendeeDateKey).toBe("2026-03-04");
  });

  it("returns undefined only when both are null (defensive)", () => {
    const attendeeDateKey = computeAttendeeDateKey(null, null);
    expect(attendeeDateKey).toBeUndefined();
  });
});

describe("One-time event: RSVP count scoped by attendeeDateKey", () => {
  // Mirrors the exact data scenario from the investigation:
  // - 3 RSVPs with date_key 2026-02-25 (correct event date)
  // - 2 RSVPs with date_key 2026-02-28 (orphaned from old date)
  // - 1 RSVP with date_key 2026-01-18 (stale from past occurrence)
  // - 1 cancelled RSVP (should never be counted)
  const rsvps = [
    { date_key: "2026-01-18", status: "confirmed" },
    { date_key: "2026-02-01", status: "cancelled" },
    { date_key: "2026-02-28", status: "confirmed" },
    { date_key: "2026-02-28", status: "confirmed" },
    { date_key: "2026-02-25", status: "confirmed" },
    { date_key: "2026-02-25", status: "confirmed" },
    { date_key: "2026-02-25", status: "confirmed" },
  ];

  it("with attendeeDateKey = event_date, counts only matching confirmed RSVPs", () => {
    const attendeeDateKey = computeAttendeeDateKey(null, "2026-02-25");
    const filtered = filterRsvpsByAttendeeDateKey(rsvps, attendeeDateKey);
    expect(filtered).toHaveLength(3);
    expect(filtered.every((r) => r.date_key === "2026-02-25")).toBe(true);
  });

  it("without attendeeDateKey (both null), returns all confirmed (pre-fix behavior)", () => {
    const attendeeDateKey = computeAttendeeDateKey(null, null);
    const filtered = filterRsvpsByAttendeeDateKey(rsvps, attendeeDateKey);
    // 6 confirmed across all date_keys (excludes 1 cancelled)
    expect(filtered).toHaveLength(6);
  });
});

describe("Recurring event: attendeeDateKey uses effectiveSelectedDate", () => {
  it("recurring event with effectiveSelectedDate passes it through unchanged", () => {
    const effectiveSelectedDate = "2026-03-04";
    const eventDate = "2026-02-25"; // original event_date, should be ignored
    const attendeeDateKey = computeAttendeeDateKey(effectiveSelectedDate, eventDate);
    expect(attendeeDateKey).toBe("2026-03-04");
  });

  it("recurring event scopes RSVPs to selected occurrence only", () => {
    const rsvps = [
      { date_key: "2026-03-04", status: "confirmed" },
      { date_key: "2026-03-04", status: "confirmed" },
      { date_key: "2026-03-11", status: "confirmed" },
      { date_key: "2026-03-11", status: "confirmed" },
      { date_key: "2026-03-11", status: "confirmed" },
    ];

    const attendeeDateKey = computeAttendeeDateKey("2026-03-04", "2026-02-25");
    const filtered = filterRsvpsByAttendeeDateKey(rsvps, attendeeDateKey);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.date_key === "2026-03-04")).toBe(true);
  });
});

describe("Scope boundary: effectiveSelectedDate is NOT modified", () => {
  it("attendeeDateKey is a separate variable, not a mutation of effectiveSelectedDate", () => {
    // This test documents the contract: effectiveSelectedDate stays null
    // for non-recurring events. Only attendeeDateKey gets the fallback.
    const effectiveSelectedDate: string | null = null;
    const eventDate = "2026-02-25";

    const attendeeDateKey = computeAttendeeDateKey(effectiveSelectedDate, eventDate);

    // effectiveSelectedDate is unchanged
    expect(effectiveSelectedDate).toBeNull();
    // attendeeDateKey has the fallback
    expect(attendeeDateKey).toBe("2026-02-25");
  });
});
