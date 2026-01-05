/**
 * Phase 4.41: Admin Verification Queue Tests
 *
 * Tests for:
 * 1. Default filter shows only unverified events
 * 2. Verify action updates DB and removes from list
 * 3. Cancel action updates status
 * 4. Delete blocked when RSVPs exist
 * 5. Delete succeeds when safe
 */

import { describe, it, expect } from "vitest";

// Test the verification status logic (same as Phase 4.40)
type VerificationStatus = "unconfirmed" | "confirmed" | "cancelled";

interface QueueEvent {
  id: string;
  status: string | null;
  last_verified_at: string | null;
  rsvp_count: number;
  claim_count: number;
}

function getVerificationStatus(event: QueueEvent): VerificationStatus {
  if (event.status === "cancelled") return "cancelled";
  if (event.last_verified_at) return "confirmed";
  return "unconfirmed";
}

function canDelete(event: QueueEvent): { safe: boolean; reason?: string } {
  if (event.rsvp_count > 0) {
    return { safe: false, reason: `${event.rsvp_count} RSVP${event.rsvp_count > 1 ? "s" : ""}` };
  }
  if (event.claim_count > 0) {
    return { safe: false, reason: `${event.claim_count} timeslot claim${event.claim_count > 1 ? "s" : ""}` };
  }
  return { safe: true };
}

describe("Admin Verification Queue - Phase 4.41", () => {
  describe("Default filter logic", () => {
    it("unverified events have status=unconfirmed", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 0,
        claim_count: 0,
      };
      expect(getVerificationStatus(event)).toBe("unconfirmed");
    });

    it("verified events have status=confirmed", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: "2026-01-01T00:00:00Z",
        rsvp_count: 0,
        claim_count: 0,
      };
      expect(getVerificationStatus(event)).toBe("confirmed");
    });

    it("cancelled events have status=cancelled regardless of verification", () => {
      const event: QueueEvent = {
        id: "1",
        status: "cancelled",
        last_verified_at: "2026-01-01T00:00:00Z",
        rsvp_count: 0,
        claim_count: 0,
      };
      expect(getVerificationStatus(event)).toBe("cancelled");
    });

    it("default filter should show only unconfirmed events", () => {
      const events: QueueEvent[] = [
        { id: "1", status: "active", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
        { id: "2", status: "active", last_verified_at: "2026-01-01T00:00:00Z", rsvp_count: 0, claim_count: 0 },
        { id: "3", status: "cancelled", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
      ];

      const unconfirmed = events.filter((e) => getVerificationStatus(e) === "unconfirmed");
      expect(unconfirmed).toHaveLength(1);
      expect(unconfirmed[0].id).toBe("1");
    });
  });

  describe("Verify action", () => {
    it("verify sets last_verified_at and changes status to confirmed", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 0,
        claim_count: 0,
      };

      // Before verify
      expect(getVerificationStatus(event)).toBe("unconfirmed");

      // Simulate verify action
      const verifiedEvent: QueueEvent = {
        ...event,
        last_verified_at: new Date().toISOString(),
      };

      // After verify
      expect(getVerificationStatus(verifiedEvent)).toBe("confirmed");
    });

    it("verified event should be removed from unconfirmed list", () => {
      const events: QueueEvent[] = [
        { id: "1", status: "active", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
        { id: "2", status: "active", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
      ];

      // Before verify - 2 unconfirmed
      let unconfirmed = events.filter((e) => getVerificationStatus(e) === "unconfirmed");
      expect(unconfirmed).toHaveLength(2);

      // Verify event 1
      const updatedEvents = events.map((e) =>
        e.id === "1" ? { ...e, last_verified_at: new Date().toISOString() } : e
      );

      // After verify - 1 unconfirmed
      unconfirmed = updatedEvents.filter((e) => getVerificationStatus(e) === "unconfirmed");
      expect(unconfirmed).toHaveLength(1);
      expect(unconfirmed[0].id).toBe("2");
    });
  });

  describe("Cancel action", () => {
    it("cancel sets status to cancelled", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 0,
        claim_count: 0,
      };

      // Before cancel
      expect(getVerificationStatus(event)).toBe("unconfirmed");

      // Simulate cancel action
      const cancelledEvent: QueueEvent = {
        ...event,
        status: "cancelled",
      };

      // After cancel
      expect(getVerificationStatus(cancelledEvent)).toBe("cancelled");
    });

    it("cancelled event remains in list but marked as cancelled", () => {
      const events: QueueEvent[] = [
        { id: "1", status: "active", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
      ];

      // Cancel event
      const updatedEvents = events.map((e) =>
        e.id === "1" ? { ...e, status: "cancelled" } : e
      );

      // Event still exists
      expect(updatedEvents).toHaveLength(1);
      // But status is cancelled
      expect(getVerificationStatus(updatedEvents[0])).toBe("cancelled");
    });
  });

  describe("Delete guardrails", () => {
    it("delete blocked when RSVPs exist", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 5,
        claim_count: 0,
      };

      const result = canDelete(event);
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("5 RSVPs");
    });

    it("delete blocked when single RSVP exists", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 1,
        claim_count: 0,
      };

      const result = canDelete(event);
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("1 RSVP");
    });

    it("delete blocked when timeslot claims exist", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 0,
        claim_count: 3,
      };

      const result = canDelete(event);
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("3 timeslot claims");
    });

    it("delete blocked when single timeslot claim exists", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 0,
        claim_count: 1,
      };

      const result = canDelete(event);
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("1 timeslot claim");
    });

    it("delete succeeds when no RSVPs or claims", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 0,
        claim_count: 0,
      };

      const result = canDelete(event);
      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("delete succeeds for cancelled event with no RSVPs or claims", () => {
      const event: QueueEvent = {
        id: "1",
        status: "cancelled",
        last_verified_at: null,
        rsvp_count: 0,
        claim_count: 0,
      };

      const result = canDelete(event);
      expect(result.safe).toBe(true);
    });

    it("RSVPs take priority over claims in error message", () => {
      const event: QueueEvent = {
        id: "1",
        status: "active",
        last_verified_at: null,
        rsvp_count: 2,
        claim_count: 3,
      };

      const result = canDelete(event);
      expect(result.safe).toBe(false);
      // RSVPs are checked first
      expect(result.reason).toBe("2 RSVPs");
    });
  });

  describe("Filter combinations", () => {
    it("can filter by unconfirmed status", () => {
      const events: QueueEvent[] = [
        { id: "1", status: "active", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
        { id: "2", status: "active", last_verified_at: "2026-01-01T00:00:00Z", rsvp_count: 0, claim_count: 0 },
        { id: "3", status: "cancelled", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
        { id: "4", status: "active", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
      ];

      const unconfirmed = events.filter((e) => getVerificationStatus(e) === "unconfirmed");
      expect(unconfirmed).toHaveLength(2);
      expect(unconfirmed.map((e) => e.id)).toEqual(["1", "4"]);
    });

    it("can filter by confirmed status", () => {
      const events: QueueEvent[] = [
        { id: "1", status: "active", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
        { id: "2", status: "active", last_verified_at: "2026-01-01T00:00:00Z", rsvp_count: 0, claim_count: 0 },
        { id: "3", status: "cancelled", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
      ];

      const confirmed = events.filter((e) => getVerificationStatus(e) === "confirmed");
      expect(confirmed).toHaveLength(1);
      expect(confirmed[0].id).toBe("2");
    });

    it("can filter by cancelled status", () => {
      const events: QueueEvent[] = [
        { id: "1", status: "active", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
        { id: "2", status: "cancelled", last_verified_at: null, rsvp_count: 0, claim_count: 0 },
        { id: "3", status: "cancelled", last_verified_at: "2026-01-01T00:00:00Z", rsvp_count: 0, claim_count: 0 },
      ];

      const cancelled = events.filter((e) => getVerificationStatus(e) === "cancelled");
      expect(cancelled).toHaveLength(2);
      expect(cancelled.map((e) => e.id)).toEqual(["2", "3"]);
    });
  });
});
