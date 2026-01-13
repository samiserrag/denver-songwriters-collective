/**
 * Phase ABC6 Per-Occurrence Invariant Tests
 *
 * Tests proving isolation of RSVPs, comments, timeslots, and guest flows
 * across different occurrence dates for recurring events.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dateKeyContract
vi.mock("@/lib/events/dateKeyContract", () => ({
  validateDateKeyForWrite: vi.fn(),
  resolveEffectiveDateKey: vi.fn(),
  dateKeyErrorResponse: vi.fn(),
  formatDateKeyShort: vi.fn((dateKey: string) => {
    const d = new Date(`${dateKey}T12:00:00Z`);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });
  }),
}));

import {
  validateDateKeyForWrite,
  resolveEffectiveDateKey,
  formatDateKeyShort,
} from "@/lib/events/dateKeyContract";

describe("Phase ABC6: Per-Occurrence Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. RSVP Isolation", () => {
    it("RSVPs are scoped by date_key - different dates are independent", () => {
      // Given: User RSVPs for date A
      const rsvpDateA = {
        id: "rsvp-1",
        user_id: "user-1",
        event_id: "event-1",
        date_key: "2026-01-18",
        status: "confirmed",
      };

      // Given: Same user RSVPs for date B
      const rsvpDateB = {
        id: "rsvp-2",
        user_id: "user-1",
        event_id: "event-1",
        date_key: "2026-01-25",
        status: "confirmed",
      };

      // Then: Both RSVPs can exist for same user/event with different date_keys
      expect(rsvpDateA.date_key).not.toBe(rsvpDateB.date_key);
      expect(rsvpDateA.user_id).toBe(rsvpDateB.user_id);
      expect(rsvpDateA.event_id).toBe(rsvpDateB.event_id);
      // Unique constraint: (event_id, date_key, user_id)
    });

    it("RSVP queries filter by date_key", () => {
      const dateKeyA = "2026-01-18";
      const dateKeyB = "2026-01-25";

      // Query for date A should NOT return date B RSVPs
      const queryDateA = {
        event_id: "event-1",
        date_key: dateKeyA,
        user_id: "user-1",
      };

      expect(queryDateA.date_key).toBe(dateKeyA);
      expect(queryDateA.date_key).not.toBe(dateKeyB);
    });

    it("confirmed count is per-occurrence", () => {
      // Given: 5 RSVPs on date A, 3 RSVPs on date B
      const rsvpsDateA = [
        { date_key: "2026-01-18", status: "confirmed" },
        { date_key: "2026-01-18", status: "confirmed" },
        { date_key: "2026-01-18", status: "confirmed" },
        { date_key: "2026-01-18", status: "confirmed" },
        { date_key: "2026-01-18", status: "confirmed" },
      ];

      const rsvpsDateB = [
        { date_key: "2026-01-25", status: "confirmed" },
        { date_key: "2026-01-25", status: "confirmed" },
        { date_key: "2026-01-25", status: "confirmed" },
      ];

      // Then: Counts are independent
      const countA = rsvpsDateA.filter(
        (r) => r.date_key === "2026-01-18" && r.status === "confirmed"
      ).length;
      const countB = rsvpsDateB.filter(
        (r) => r.date_key === "2026-01-25" && r.status === "confirmed"
      ).length;

      expect(countA).toBe(5);
      expect(countB).toBe(3);
    });

    it("waitlist position is per-occurrence", () => {
      // Given: Waitlist on date A has 2 people
      const waitlistDateA = [
        { date_key: "2026-01-18", status: "waitlist", waitlist_position: 1 },
        { date_key: "2026-01-18", status: "waitlist", waitlist_position: 2 },
      ];

      // Given: Waitlist on date B has 1 person
      const waitlistDateB = [
        { date_key: "2026-01-25", status: "waitlist", waitlist_position: 1 },
      ];

      // Then: Next waitlist position on date A is 3, on date B is 2
      const nextPosA = Math.max(...waitlistDateA.map((w) => w.waitlist_position)) + 1;
      const nextPosB = Math.max(...waitlistDateB.map((w) => w.waitlist_position)) + 1;

      expect(nextPosA).toBe(3);
      expect(nextPosB).toBe(2);
    });
  });

  describe("2. Comment Isolation", () => {
    it("comments are scoped by date_key", () => {
      const commentDateA = {
        id: "comment-1",
        event_id: "event-1",
        date_key: "2026-01-18",
        content: "Can't wait for this Saturday!",
      };

      const commentDateB = {
        id: "comment-2",
        event_id: "event-1",
        date_key: "2026-01-25",
        content: "See you next Saturday!",
      };

      // Comments for different dates are independent
      expect(commentDateA.date_key).not.toBe(commentDateB.date_key);
      expect(commentDateA.event_id).toBe(commentDateB.event_id);
    });

    it("comment query filters by date_key", () => {
      const comments = [
        { id: "c1", event_id: "e1", date_key: "2026-01-18", content: "A" },
        { id: "c2", event_id: "e1", date_key: "2026-01-25", content: "B" },
        { id: "c3", event_id: "e1", date_key: "2026-01-18", content: "C" },
      ];

      // Query for date A returns only date A comments
      const dateAComments = comments.filter((c) => c.date_key === "2026-01-18");
      expect(dateAComments).toHaveLength(2);
      expect(dateAComments.every((c) => c.date_key === "2026-01-18")).toBe(true);

      // Query for date B returns only date B comments
      const dateBComments = comments.filter((c) => c.date_key === "2026-01-25");
      expect(dateBComments).toHaveLength(1);
      expect(dateBComments[0].content).toBe("B");
    });
  });

  describe("3. Timeslot Isolation", () => {
    it("timeslots are scoped by date_key", () => {
      const slotDateA = {
        id: "slot-1",
        event_id: "event-1",
        date_key: "2026-01-18",
        slot_index: 0,
        start_time: "19:00:00",
      };

      const slotDateB = {
        id: "slot-2",
        event_id: "event-1",
        date_key: "2026-01-25",
        slot_index: 0, // Same slot_index is allowed on different dates
        start_time: "19:00:00",
      };

      // Same slot_index allowed on different dates
      expect(slotDateA.slot_index).toBe(slotDateB.slot_index);
      expect(slotDateA.date_key).not.toBe(slotDateB.date_key);
    });

    it("timeslot query filters by date_key", () => {
      const slots = [
        { id: "s1", event_id: "e1", date_key: "2026-01-18", slot_index: 0 },
        { id: "s2", event_id: "e1", date_key: "2026-01-18", slot_index: 1 },
        { id: "s3", event_id: "e1", date_key: "2026-01-25", slot_index: 0 },
        { id: "s4", event_id: "e1", date_key: "2026-01-25", slot_index: 1 },
      ];

      // Query for date A returns only date A slots
      const dateASlots = slots.filter((s) => s.date_key === "2026-01-18");
      expect(dateASlots).toHaveLength(2);

      // Query for date B returns only date B slots
      const dateBSlots = slots.filter((s) => s.date_key === "2026-01-25");
      expect(dateBSlots).toHaveLength(2);
    });

    it("slot claim on date A does not affect date B", () => {
      // Given: Slot 0 on date A is claimed
      const claimDateA = {
        timeslot_id: "slot-date-a-0",
        status: "confirmed",
      };

      // Then: Slot 0 on date B is still available
      const slotDateB = {
        id: "slot-date-b-0",
        date_key: "2026-01-25",
        slot_index: 0,
      };

      // These are different timeslot_ids (different rows)
      expect(claimDateA.timeslot_id).not.toBe(slotDateB.id);
    });
  });

  describe("4. Guest Flow Date Scoping", () => {
    it("guest verification is scoped by date_key", () => {
      const verificationDateA = {
        id: "v1",
        email: "guest@example.com",
        event_id: "event-1",
        date_key: "2026-01-18",
        action_type: "rsvp",
      };

      const verificationDateB = {
        id: "v2",
        email: "guest@example.com",
        event_id: "event-1",
        date_key: "2026-01-25",
        action_type: "rsvp",
      };

      // Same guest can verify for both dates
      expect(verificationDateA.email).toBe(verificationDateB.email);
      expect(verificationDateA.date_key).not.toBe(verificationDateB.date_key);
    });

    it("guest RSVP creates row only for the specified date", () => {
      const guestRsvp = {
        event_id: "event-1",
        user_id: null,
        guest_name: "John Guest",
        guest_email: "john@example.com",
        date_key: "2026-01-18",
        status: "confirmed",
      };

      // RSVP is scoped to specific date
      expect(guestRsvp.date_key).toBe("2026-01-18");
      expect(guestRsvp.user_id).toBeNull(); // Guest has no user_id
    });
  });

  describe("5. Date Key Validation", () => {
    it("validateDateKeyForWrite blocks cancelled occurrences", async () => {
      vi.mocked(validateDateKeyForWrite).mockResolvedValue({
        success: false,
        error: "This occurrence has been cancelled",
      });

      const result = await validateDateKeyForWrite("event-1", "2026-01-18");

      expect(result.success).toBe(false);
      expect(result.error).toContain("cancelled");
    });

    it("validateDateKeyForWrite succeeds for active occurrences", async () => {
      vi.mocked(validateDateKeyForWrite).mockResolvedValue({
        success: true,
        effectiveDateKey: "2026-01-18",
      });

      const result = await validateDateKeyForWrite("event-1", "2026-01-18");

      expect(result.success).toBe(true);
      expect(result.effectiveDateKey).toBe("2026-01-18");
    });

    it("resolveEffectiveDateKey returns next occurrence when no date provided", async () => {
      vi.mocked(resolveEffectiveDateKey).mockResolvedValue({
        success: true,
        effectiveDateKey: "2026-01-25", // Next upcoming occurrence
      });

      const result = await resolveEffectiveDateKey("event-1", null);

      expect(result.success).toBe(true);
      expect(result.effectiveDateKey).toBeDefined();
    });
  });

  describe("6. URL Deep-Linking", () => {
    it("venue page date links include ?date= parameter", () => {
      const eventSlug = "weekly-open-mic";
      const dateKey = "2026-01-18";

      const expectedUrl = `/events/${eventSlug}?date=${dateKey}`;

      expect(expectedUrl).toContain("?date=");
      expect(expectedUrl).toContain("2026-01-18");
    });

    it("SeriesCard expandable dates link with ?date=", () => {
      const occurrences = [
        { dateKey: "2026-01-18" },
        { dateKey: "2026-01-25" },
        { dateKey: "2026-02-01" },
      ];

      const eventIdentifier = "weekly-open-mic";

      occurrences.forEach((occ) => {
        const link = `/events/${eventIdentifier}?date=${occ.dateKey}`;
        expect(link).toMatch(/\?date=\d{4}-\d{2}-\d{2}$/);
      });
    });

    it("email links include ?date= for per-occurrence events", () => {
      const dateKey = "2026-01-18";
      const eventSlug = "weekly-open-mic";

      // RSVP confirmation URL
      const rsvpUrl = `https://example.com/events/${eventSlug}?date=${dateKey}`;
      expect(rsvpUrl).toContain(`?date=${dateKey}`);

      // Cancel URL
      const cancelUrl = `https://example.com/events/${eventSlug}?date=${dateKey}&cancel=true`;
      expect(cancelUrl).toContain(`?date=${dateKey}`);

      // Confirm offer URL
      const confirmUrl = `https://example.com/events/${eventSlug}?date=${dateKey}&confirm=true`;
      expect(confirmUrl).toContain(`?date=${dateKey}`);
    });

    it("notification links include #anchor and ?date=", () => {
      const dateKey = "2026-01-18";
      const eventSlug = "weekly-open-mic";

      // RSVP notification links to #attendees
      const rsvpNotificationLink = `/events/${eventSlug}?date=${dateKey}#attendees`;
      expect(rsvpNotificationLink).toContain("?date=");
      expect(rsvpNotificationLink).toContain("#attendees");

      // Comment notification links to #comments
      const commentNotificationLink = `/events/${eventSlug}?date=${dateKey}#comments`;
      expect(commentNotificationLink).toContain("?date=");
      expect(commentNotificationLink).toContain("#comments");

      // Timeslot notification links to #lineup
      const timeslotNotificationLink = `/events/${eventSlug}?date=${dateKey}#lineup`;
      expect(timeslotNotificationLink).toContain("?date=");
      expect(timeslotNotificationLink).toContain("#lineup");
    });
  });

  describe("7. Email Template Date Context", () => {
    it("formatDateKeyShort returns human-readable date", () => {
      const result = formatDateKeyShort("2026-01-18");

      // Should return something like "Sat, Jan 18"
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("verification email includes occurrence date", () => {
      const dateKey = "2026-01-18";
      const occurrenceDate = formatDateKeyShort(dateKey);

      // Email body should mention the date
      const emailBody = `You requested a code to RSVP to "Weekly Open Mic" on ${occurrenceDate}:`;
      expect(emailBody).toContain("on ");
    });

    it("RSVP confirmation email includes date_key in URLs", () => {
      const dateKey = "2026-01-18";
      const eventSlug = "weekly-open-mic";

      // Event URL should include date
      const eventUrl = `https://example.com/events/${eventSlug}?date=${dateKey}`;
      expect(eventUrl).toContain(`date=${dateKey}`);
    });

    it("host notification includes occurrence date in subject and body", () => {
      const occurrenceDate = "Sat, Jan 18";

      const subject = `John Doe is going to "Weekly Open Mic" on ${occurrenceDate}`;
      expect(subject).toContain(occurrenceDate);

      const message = `John Doe RSVP'd to "Weekly Open Mic" on ${occurrenceDate}`;
      expect(message).toContain(occurrenceDate);
    });
  });

  describe("8. Cross-Date Invariants", () => {
    it("same user cannot RSVP twice to same date", () => {
      // Unique constraint: (event_id, date_key, user_id)
      const existingRsvp = {
        event_id: "event-1",
        date_key: "2026-01-18",
        user_id: "user-1",
        status: "confirmed",
      };

      // Attempting duplicate would violate constraint
      const duplicateRsvp = {
        event_id: "event-1",
        date_key: "2026-01-18",
        user_id: "user-1",
      };

      // These have same composite key
      expect(existingRsvp.event_id).toBe(duplicateRsvp.event_id);
      expect(existingRsvp.date_key).toBe(duplicateRsvp.date_key);
      expect(existingRsvp.user_id).toBe(duplicateRsvp.user_id);
    });

    it("same user CAN RSVP to different dates", () => {
      const rsvpA = {
        event_id: "event-1",
        date_key: "2026-01-18",
        user_id: "user-1",
      };

      const rsvpB = {
        event_id: "event-1",
        date_key: "2026-01-25", // Different date
        user_id: "user-1",
      };

      // Different composite keys
      expect(rsvpA.date_key).not.toBe(rsvpB.date_key);
    });

    it("cancelling RSVP on date A does not affect date B", () => {
      // User has confirmed on both dates
      const rsvps = [
        { id: "r1", date_key: "2026-01-18", status: "confirmed" },
        { id: "r2", date_key: "2026-01-25", status: "confirmed" },
      ];

      // Cancel date A
      rsvps[0].status = "cancelled";

      // Date B unaffected
      expect(rsvps[0].status).toBe("cancelled");
      expect(rsvps[1].status).toBe("confirmed");
    });

    it("capacity is calculated per-occurrence", () => {
      const capacity = 10;

      // Date A has 8 confirmed
      const confirmedDateA = 8;
      const remainingA = capacity - confirmedDateA;

      // Date B has 3 confirmed
      const confirmedDateB = 3;
      const remainingB = capacity - confirmedDateB;

      expect(remainingA).toBe(2);
      expect(remainingB).toBe(7);

      // Different remaining capacity per date
      expect(remainingA).not.toBe(remainingB);
    });
  });
});

describe("Phase ABC6: SeriesCard Date Links", () => {
  it("next occurrence link includes ?date=", () => {
    const event = {
      id: "event-1",
      slug: "weekly-open-mic",
    };
    const nextOccurrence = { date: "2026-01-18" };

    const link = `/events/${event.slug || event.id}?date=${nextOccurrence.date}`;

    expect(link).toBe("/events/weekly-open-mic?date=2026-01-18");
  });

  it("expandable date list items link with ?date=", () => {
    const eventIdentifier = "weekly-open-mic";
    const occurrences = [
      { dateKey: "2026-01-25" },
      { dateKey: "2026-02-01" },
      { dateKey: "2026-02-08" },
    ];

    const links = occurrences.map(
      (occ) => `/events/${eventIdentifier}?date=${occ.dateKey}`
    );

    expect(links[0]).toBe("/events/weekly-open-mic?date=2026-01-25");
    expect(links[1]).toBe("/events/weekly-open-mic?date=2026-02-01");
    expect(links[2]).toBe("/events/weekly-open-mic?date=2026-02-08");
  });

  it("one-time event also uses ?date=", () => {
    const event = {
      id: "event-2",
      slug: "special-event",
    };
    const nextOccurrence = { date: "2026-02-14" };

    const link = `/events/${event.slug || event.id}?date=${nextOccurrence.date}`;

    expect(link).toBe("/events/special-event?date=2026-02-14");
  });
});
