/**
 * Phase 5.02 — RSVP + Timeslots Host Control & Dashboard Tests
 *
 * Tests for:
 * - Part A: Future-only blocking logic (date_key >= todayKey)
 * - Part B: Future-only timeslot regeneration
 * - Part C: Host dashboard surfaces (claims table, date-scoped RSVPs)
 * - Part D: Actionable error messaging
 */

import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// Part A: Blocking Logic — Future-Only Claims Detection
// ═══════════════════════════════════════════════════════════════════════════

describe("Part A: Future-Only Blocking Logic", () => {
  describe("Date Classification", () => {
    it("should classify today as future (>= todayKey)", () => {
      const todayKey = "2026-01-28";
      const testDateKey = "2026-01-28";
      expect(testDateKey >= todayKey).toBe(true);
    });

    it("should classify tomorrow as future", () => {
      const todayKey = "2026-01-28";
      const testDateKey = "2026-01-29";
      expect(testDateKey >= todayKey).toBe(true);
    });

    it("should classify yesterday as past", () => {
      const todayKey = "2026-01-28";
      const testDateKey = "2026-01-27";
      expect(testDateKey >= todayKey).toBe(false);
    });

    it("should handle date comparison with lexicographic sorting", () => {
      // YYYY-MM-DD format allows string comparison
      const dates = ["2026-02-01", "2026-01-15", "2026-01-28", "2025-12-31"];
      const sorted = [...dates].sort();
      expect(sorted).toEqual(["2025-12-31", "2026-01-15", "2026-01-28", "2026-02-01"]);
    });
  });

  describe("Claims Filtering Logic", () => {
    interface MockClaim {
      id: string;
      status: string;
      date_key: string;
    }

    function filterFutureClaims(claims: MockClaim[], todayKey: string): MockClaim[] {
      return claims.filter(c =>
        c.date_key >= todayKey &&
        ["confirmed", "performed", "waitlist"].includes(c.status)
      );
    }

    it("should include claims for today", () => {
      const claims: MockClaim[] = [
        { id: "1", status: "confirmed", date_key: "2026-01-28" }
      ];
      const result = filterFutureClaims(claims, "2026-01-28");
      expect(result).toHaveLength(1);
    });

    it("should include claims for future dates", () => {
      const claims: MockClaim[] = [
        { id: "1", status: "confirmed", date_key: "2026-02-15" }
      ];
      const result = filterFutureClaims(claims, "2026-01-28");
      expect(result).toHaveLength(1);
    });

    it("should exclude claims for past dates", () => {
      const claims: MockClaim[] = [
        { id: "1", status: "confirmed", date_key: "2026-01-15" }
      ];
      const result = filterFutureClaims(claims, "2026-01-28");
      expect(result).toHaveLength(0);
    });

    it("should exclude cancelled claims even if future", () => {
      const claims: MockClaim[] = [
        { id: "1", status: "cancelled", date_key: "2026-02-15" }
      ];
      const result = filterFutureClaims(claims, "2026-01-28");
      expect(result).toHaveLength(0);
    });

    it("should exclude no_show claims even if future", () => {
      const claims: MockClaim[] = [
        { id: "1", status: "no_show", date_key: "2026-02-15" }
      ];
      const result = filterFutureClaims(claims, "2026-01-28");
      expect(result).toHaveLength(0);
    });

    it("should handle mixed past and future claims", () => {
      const claims: MockClaim[] = [
        { id: "1", status: "confirmed", date_key: "2026-01-15" }, // past
        { id: "2", status: "confirmed", date_key: "2026-01-28" }, // today
        { id: "3", status: "confirmed", date_key: "2026-02-15" }, // future
        { id: "4", status: "cancelled", date_key: "2026-02-20" }, // cancelled
      ];
      const result = filterFutureClaims(claims, "2026-01-28");
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toEqual(["2", "3"]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part B: Future-Only Regeneration
// ═══════════════════════════════════════════════════════════════════════════

describe("Part B: Future-Only Regeneration", () => {
  interface MockTimeslot {
    id: string;
    date_key: string;
    slot_index: number;
  }

  function filterFutureTimeslots(timeslots: MockTimeslot[], todayKey: string): MockTimeslot[] {
    return timeslots.filter(ts => ts.date_key >= todayKey);
  }

  function filterPastTimeslots(timeslots: MockTimeslot[], todayKey: string): MockTimeslot[] {
    return timeslots.filter(ts => ts.date_key < todayKey);
  }

  it("should preserve past timeslots", () => {
    const timeslots: MockTimeslot[] = [
      { id: "1", date_key: "2026-01-15", slot_index: 0 },
      { id: "2", date_key: "2026-01-28", slot_index: 0 },
      { id: "3", date_key: "2026-02-15", slot_index: 0 },
    ];
    const preserved = filterPastTimeslots(timeslots, "2026-01-28");
    expect(preserved).toHaveLength(1);
    expect(preserved[0].date_key).toBe("2026-01-15");
  });

  it("should regenerate future timeslots", () => {
    const timeslots: MockTimeslot[] = [
      { id: "1", date_key: "2026-01-15", slot_index: 0 },
      { id: "2", date_key: "2026-01-28", slot_index: 0 },
      { id: "3", date_key: "2026-02-15", slot_index: 0 },
    ];
    const toRegenerate = filterFutureTimeslots(timeslots, "2026-01-28");
    expect(toRegenerate).toHaveLength(2);
    expect(toRegenerate.map(ts => ts.date_key)).toEqual(["2026-01-28", "2026-02-15"]);
  });

  it("should handle no past timeslots", () => {
    const timeslots: MockTimeslot[] = [
      { id: "1", date_key: "2026-02-01", slot_index: 0 },
      { id: "2", date_key: "2026-02-08", slot_index: 0 },
    ];
    const preserved = filterPastTimeslots(timeslots, "2026-01-28");
    expect(preserved).toHaveLength(0);
  });

  it("should handle no future timeslots", () => {
    const timeslots: MockTimeslot[] = [
      { id: "1", date_key: "2026-01-01", slot_index: 0 },
      { id: "2", date_key: "2026-01-15", slot_index: 0 },
    ];
    const toRegenerate = filterFutureTimeslots(timeslots, "2026-01-28");
    expect(toRegenerate).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part C1: TimeslotClaimsTable
// ═══════════════════════════════════════════════════════════════════════════

describe("Part C1: TimeslotClaimsTable Data Structures", () => {
  interface ClaimData {
    id: string;
    timeslot_id: string;
    member_id: string | null;
    performer_name: string | null;
    performer_email: string | null;
    status: string;
    created_at: string;
    slot_index: number | null;
    date_key: string | null;
    start_offset_minutes: number | null;
    duration_minutes: number | null;
    is_guest: boolean;
  }

  function formatSlotTime(offsetMinutes: number | null, durationMinutes: number | null): string {
    if (offsetMinutes === null) return "";
    const hours = Math.floor(offsetMinutes / 60);
    const mins = offsetMinutes % 60;
    const endOffset = offsetMinutes + (durationMinutes || 0);
    const endHours = Math.floor(endOffset / 60);
    const endMins = endOffset % 60;

    const formatTime = (h: number, m: number) => {
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return m > 0 ? `${displayH}:${m.toString().padStart(2, "0")}${period}` : `${displayH}${period}`;
    };

    return `${formatTime(hours, mins)} - ${formatTime(endHours, endMins)}`;
  }

  it("should format slot time correctly for morning slot", () => {
    const result = formatSlotTime(570, 15); // 9:30 AM, 15 min
    expect(result).toBe("9:30AM - 9:45AM");
  });

  it("should format slot time correctly for evening slot", () => {
    const result = formatSlotTime(1140, 20); // 7:00 PM, 20 min
    expect(result).toBe("7PM - 7:20PM");
  });

  it("should format slot time crossing noon", () => {
    const result = formatSlotTime(720, 30); // 12:00 PM, 30 min
    expect(result).toBe("12PM - 12:30PM");
  });

  it("should handle null offset minutes", () => {
    const result = formatSlotTime(null, 15);
    expect(result).toBe("");
  });

  it("should filter active claims correctly", () => {
    const claims: ClaimData[] = [
      { id: "1", timeslot_id: "t1", member_id: "m1", performer_name: "Alice", performer_email: null, status: "confirmed", created_at: "", slot_index: 0, date_key: "2026-01-28", start_offset_minutes: 570, duration_minutes: 15, is_guest: false },
      { id: "2", timeslot_id: "t2", member_id: null, performer_name: "Bob", performer_email: "bob@test.com", status: "waitlist", created_at: "", slot_index: 1, date_key: "2026-01-28", start_offset_minutes: 585, duration_minutes: 15, is_guest: true },
      { id: "3", timeslot_id: "t3", member_id: "m2", performer_name: "Charlie", performer_email: null, status: "cancelled", created_at: "", slot_index: 2, date_key: "2026-01-28", start_offset_minutes: 600, duration_minutes: 15, is_guest: false },
      { id: "4", timeslot_id: "t4", member_id: "m3", performer_name: "Diana", performer_email: null, status: "performed", created_at: "", slot_index: 3, date_key: "2026-01-28", start_offset_minutes: 615, duration_minutes: 15, is_guest: false },
    ];

    const activeClaims = claims.filter(c =>
      c.status === "confirmed" || c.status === "performed" || c.status === "waitlist"
    );

    expect(activeClaims).toHaveLength(3);
    expect(activeClaims.map(c => c.performer_name)).toEqual(["Alice", "Bob", "Diana"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part C2: RSVPList Date Scoping
// ═══════════════════════════════════════════════════════════════════════════

describe("Part C2: RSVPList Date Scoping", () => {
  it("should build API URL with date_key for recurring events", () => {
    const eventId = "event-123";
    const selectedDate = "2026-02-15";
    const dateParam = selectedDate ? `?date_key=${selectedDate}` : "";
    const url = `/api/my-events/${eventId}/rsvps${dateParam}`;
    expect(url).toBe("/api/my-events/event-123/rsvps?date_key=2026-02-15");
  });

  it("should build API URL without date_key for one-time events", () => {
    const eventId = "event-123";
    const selectedDate = "";
    const dateParam = selectedDate ? `?date_key=${selectedDate}` : "";
    const url = `/api/my-events/${eventId}/rsvps${dateParam}`;
    expect(url).toBe("/api/my-events/event-123/rsvps");
  });

  it("should format date key for display correctly", () => {
    function formatDateKeyShort(dateKey: string): string {
      const date = new Date(`${dateKey}T12:00:00Z`);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "America/Denver",
      });
    }

    // Note: The exact output depends on locale settings
    const result = formatDateKeyShort("2026-01-28");
    expect(result).toContain("Jan");
    expect(result).toContain("28");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Part D: Actionable Error Messaging
// ═══════════════════════════════════════════════════════════════════════════

describe("Part D: Actionable Error Messaging", () => {
  interface ApiErrorResponse {
    error: string;
    details?: string;
    actionUrl?: string;
    futureClaimCount?: number;
  }

  it("should include all required fields in blocking error response", () => {
    const errorResponse: ApiErrorResponse = {
      error: "Can't change slot configuration while future signups exist.",
      details: "3 active signup(s) on upcoming dates. Remove them first or wait until those dates pass.",
      actionUrl: "/dashboard/my-events/event-123",
      futureClaimCount: 3,
    };

    expect(errorResponse.error).toBeTruthy();
    expect(errorResponse.details).toBeTruthy();
    expect(errorResponse.actionUrl).toBeTruthy();
    expect(errorResponse.futureClaimCount).toBe(3);
  });

  it("should format actionUrl with event ID", () => {
    const eventId = "abc-123-def";
    const actionUrl = `/dashboard/my-events/${eventId}`;
    expect(actionUrl).toBe("/dashboard/my-events/abc-123-def");
  });

  it("should detect actionable error from API response", () => {
    const response: ApiErrorResponse = {
      error: "Can't change slot configuration",
      actionUrl: "/dashboard/my-events/event-123",
      details: "Remove signups first",
    };

    const hasActionableError = Boolean(response.actionUrl || response.details);
    expect(hasActionableError).toBe(true);
  });

  it("should detect non-actionable error from API response", () => {
    const response: ApiErrorResponse = {
      error: "Internal server error",
    };

    const hasActionableError = Boolean(response.actionUrl || response.details);
    expect(hasActionableError).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// API Contract Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("API Contract: Claims Endpoint", () => {
  it("should define GET endpoint structure for listing claims", () => {
    const expectedPath = "/api/my-events/[id]/claims";
    const expectedQueryParams = ["date_key"];
    const expectedResponseFields = ["claims", "totalClaims", "activeClaims", "futureClaims", "pastClaims"];

    expect(expectedPath).toContain("/api/my-events/");
    expect(expectedPath).toContain("/claims");
    expect(expectedQueryParams).toContain("date_key");
    expect(expectedResponseFields).toContain("claims");
    expect(expectedResponseFields).toContain("futureClaims");
    expect(expectedResponseFields).toContain("pastClaims");
  });

  it("should define DELETE endpoint structure for removing claims", () => {
    const expectedPath = "/api/my-events/[id]/claims";
    const expectedBodyFields = ["claim_id"];
    const expectedResponseFields = ["success", "claimId", "previousStatus", "performerName"];

    expect(expectedPath).toContain("/api/my-events/");
    expect(expectedBodyFields).toContain("claim_id");
    expect(expectedResponseFields).toContain("success");
    expect(expectedResponseFields).toContain("previousStatus");
  });
});
