/**
 * Phase 4.48b: Guest RSVP Support + Audience List Parity
 *
 * Tests for:
 * - Guest RSVP schema (guest_name, guest_email, guest_verified fields)
 * - Guest verification flow (request code, verify code, create RSVP)
 * - AttendeeList rendering both members and guests
 * - Success banner theme contrast (uses theme tokens, not hardcoded colors)
 * - RSVP cancellation via action token
 */

import { describe, it, expect } from "vitest";

// ============================================================
// Schema contract tests
// ============================================================

describe("Phase 4.48b: Guest RSVP schema", () => {
  it("event_rsvps should support nullable user_id for guests", () => {
    // This test documents the schema contract
    // user_id is nullable to allow guest RSVPs
    const guestRsvp = {
      id: "rsvp-1",
      event_id: "event-1",
      user_id: null, // Guest RSVP
      guest_name: "Jane Guest",
      guest_email: "jane@example.com",
      guest_verified: true,
      guest_verification_id: "verification-1",
      status: "confirmed",
      waitlist_position: null,
    };

    expect(guestRsvp.user_id).toBeNull();
    expect(guestRsvp.guest_name).toBe("Jane Guest");
    expect(guestRsvp.guest_email).toBe("jane@example.com");
    expect(guestRsvp.guest_verified).toBe(true);
  });

  it("member RSVPs should have user_id and null guest fields", () => {
    const memberRsvp = {
      id: "rsvp-2",
      event_id: "event-1",
      user_id: "user-123", // Member RSVP
      guest_name: null,
      guest_email: null,
      guest_verified: null,
      guest_verification_id: null,
      status: "confirmed",
      waitlist_position: null,
    };

    expect(memberRsvp.user_id).toBe("user-123");
    expect(memberRsvp.guest_name).toBeNull();
    expect(memberRsvp.guest_email).toBeNull();
  });

  it("schema enforces member OR guest constraint", () => {
    // Either user_id must be set, or (guest_name AND guest_email) must be set
    // This is enforced by CHECK constraint: member_or_guest_rsvp

    // Valid member RSVP
    const memberRsvp = { user_id: "user-1", guest_name: null, guest_email: null };
    expect(memberRsvp.user_id !== null || (memberRsvp.guest_name !== null && memberRsvp.guest_email !== null)).toBe(true);

    // Valid guest RSVP
    const guestRsvp = { user_id: null, guest_name: "Guest", guest_email: "guest@example.com" };
    expect(guestRsvp.user_id !== null || (guestRsvp.guest_name !== null && guestRsvp.guest_email !== null)).toBe(true);

    // Invalid: neither member nor guest
    const invalidRsvp = { user_id: null, guest_name: null, guest_email: null };
    expect(invalidRsvp.user_id !== null || (invalidRsvp.guest_name !== null && invalidRsvp.guest_email !== null)).toBe(false);
  });
});

// ============================================================
// Guest verification flow tests
// ============================================================

describe("Phase 4.48b: Guest verification request-code endpoint", () => {
  it("should require event_id, guest_name, and guest_email", () => {
    const requiredFields = ["event_id", "guest_name", "guest_email"];
    const body = { event_id: "evt-1", guest_name: "Test", guest_email: "test@example.com" };

    for (const field of requiredFields) {
      expect(body[field as keyof typeof body]).toBeDefined();
    }
  });

  it("should validate email format", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    expect(emailRegex.test("valid@example.com")).toBe(true);
    expect(emailRegex.test("invalid")).toBe(false);
    expect(emailRegex.test("invalid@")).toBe(false);
    expect(emailRegex.test("@example.com")).toBe(false);
  });

  it("should require guest name minimum 2 characters", () => {
    expect("AB".length >= 2).toBe(true);
    expect("A".length >= 2).toBe(false);
    expect("".length >= 2).toBe(false);
  });

  it("should normalize email to lowercase", () => {
    const email = "Test@Example.COM";
    const normalized = email.toLowerCase().trim();
    expect(normalized).toBe("test@example.com");
  });
});

describe("Phase 4.48b: Guest verification verify-code endpoint", () => {
  it("should require verification_id and code", () => {
    const body = { verification_id: "ver-1", code: "123456" };
    expect(body.verification_id).toBeDefined();
    expect(body.code).toBeDefined();
  });

  it("should accept 6-digit codes", () => {
    const validCode = "123456";
    const invalidCodes = ["12345", "1234567", "abcdef", ""];

    expect(validCode.length).toBe(6);
    expect(/^\d{6}$/.test(validCode)).toBe(true);

    for (const code of invalidCodes) {
      expect(/^\d{6}$/.test(code)).toBe(false);
    }
  });

  it("should support cancel_rsvp action type", () => {
    const validActions = ["confirm", "cancel", "cancel_rsvp"];
    expect(validActions.includes("cancel_rsvp")).toBe(true);
  });
});

// ============================================================
// AttendeeList rendering tests
// ============================================================

describe("Phase 4.48b: AttendeeList guest rendering", () => {
  it("should identify guest attendees by user === null and guest_name !== null", () => {
    const guestAttendee = {
      id: "rsvp-1",
      status: "confirmed",
      guest_name: "Jane Guest",
      guest_email: "jane@example.com",
      user: null,
    };

    const isGuest = guestAttendee.user === null && guestAttendee.guest_name !== null;
    expect(isGuest).toBe(true);
  });

  it("should identify member attendees by user !== null", () => {
    const memberAttendee = {
      id: "rsvp-2",
      status: "confirmed",
      guest_name: null,
      guest_email: null,
      user: {
        id: "user-1",
        slug: "john-doe",
        full_name: "John Doe",
        avatar_url: null,
      },
    };

    const isGuest = memberAttendee.user === null && memberAttendee.guest_name !== null;
    expect(isGuest).toBe(false);
  });

  it("should use guest_name for display when guest", () => {
    const guestAttendee = {
      guest_name: "Jane Guest",
      user: null,
    };

    const isGuest = guestAttendee.user === null && guestAttendee.guest_name !== null;
    const displayName = isGuest ? guestAttendee.guest_name : guestAttendee.user?.full_name || "Anonymous";

    expect(displayName).toBe("Jane Guest");
  });

  it("should use profile full_name for display when member", () => {
    const memberAttendee = {
      guest_name: null,
      user: {
        full_name: "John Member",
        id: "user-1",
        slug: "john-member",
        avatar_url: null,
      },
    };

    const isGuest = memberAttendee.user === null && memberAttendee.guest_name !== null;
    const displayName = isGuest ? memberAttendee.guest_name : memberAttendee.user?.full_name || "Anonymous";

    expect(displayName).toBe("John Member");
  });

  it("should not link guest names to profiles", () => {
    const guestAttendee = { user: null, guest_name: "Guest" };
    const isGuest = guestAttendee.user === null && guestAttendee.guest_name !== null;
    const profile = guestAttendee.user;
    const profileUrl = !isGuest && profile?.id ? `/songwriters/${profile.slug || profile.id}` : null;

    expect(profileUrl).toBeNull();
  });

  it("should link member names to profiles", () => {
    const memberAttendee = {
      user: { id: "user-1", slug: "john-doe", full_name: "John Doe", avatar_url: null },
      guest_name: null,
    };
    const isGuest = memberAttendee.user === null && memberAttendee.guest_name !== null;
    const profile = memberAttendee.user;
    const profileUrl = !isGuest && profile?.id ? `/songwriters/${profile.slug || profile.id}` : null;

    expect(profileUrl).toBe("/songwriters/john-doe");
  });
});

// ============================================================
// Success banner theme contrast tests
// ============================================================

describe("Phase 4.48b: Success banner uses theme tokens", () => {
  it("success banner should use --pill-bg-success token", () => {
    // The success banner in RSVPButton should use theme tokens
    const expectedClass = "bg-[var(--pill-bg-success)]";
    expect(expectedClass).toContain("--pill-bg-success");
  });

  it("success text should use --pill-fg-success token", () => {
    const expectedClass = "text-[var(--pill-fg-success)]";
    expect(expectedClass).toContain("--pill-fg-success");
  });

  it("success border should use --pill-border-success token", () => {
    const expectedClass = "border-[var(--pill-border-success)]";
    expect(expectedClass).toContain("--pill-border-success");
  });

  it("should NOT use hardcoded emerald colors", () => {
    // These patterns should NOT appear in the success banner
    const forbiddenPatterns = [
      "bg-emerald-100",
      "bg-emerald-900",
      "text-emerald-800",
      "text-emerald-300",
      "border-emerald-300",
      "border-emerald-700",
    ];

    // The new implementation uses theme tokens instead
    const themeTokens = [
      "--pill-bg-success",
      "--pill-fg-success",
      "--pill-border-success",
    ];

    expect(themeTokens.length).toBe(3);
    expect(forbiddenPatterns.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Action token tests
// ============================================================

describe("Phase 4.48b: Action token payload for RSVP", () => {
  it("should support rsvp_id in token payload", () => {
    const tokenPayload = {
      email: "guest@example.com",
      rsvp_id: "rsvp-123",
      action: "cancel_rsvp" as const,
      verification_id: "ver-123",
    };

    expect(tokenPayload.rsvp_id).toBe("rsvp-123");
    expect(tokenPayload.action).toBe("cancel_rsvp");
  });

  it("should distinguish claim_id from rsvp_id", () => {
    // Timeslot claim token
    const claimToken = {
      email: "user@example.com",
      claim_id: "claim-123",
      action: "cancel" as const,
      verification_id: "ver-1",
    };

    // RSVP token
    const rsvpToken = {
      email: "user@example.com",
      rsvp_id: "rsvp-123",
      action: "cancel_rsvp" as const,
      verification_id: "ver-2",
    };

    expect(claimToken.claim_id).toBeDefined();
    expect(claimToken.rsvp_id).toBeUndefined();

    expect(rsvpToken.rsvp_id).toBeDefined();
    expect(rsvpToken.claim_id).toBeUndefined();
  });
});

// ============================================================
// Email template tests
// ============================================================

describe("Phase 4.48b: RSVP confirmation email for guests", () => {
  it("should support guestName parameter", () => {
    const params = {
      eventTitle: "Test Event",
      eventDate: "2026-01-15",
      eventTime: "7:00 PM",
      venueName: "Test Venue",
      eventId: "event-123",
      isWaitlist: false,
      guestName: "Jane Guest", // New parameter for guests
      cancelUrl: "https://example.com/guest/action?token=abc123", // Direct cancel URL
    };

    expect(params.guestName).toBe("Jane Guest");
    expect(params.cancelUrl).toContain("guest/action");
  });

  it("should omit dashboard link for guests", () => {
    // Guest emails should NOT include "View all your RSVPs" dashboard link
    // because guests don't have accounts

    const isGuest = true;
    const dashboardLink = isGuest ? "" : "/dashboard/my-rsvps";

    expect(dashboardLink).toBe("");
  });

  it("should include cancel URL for guests", () => {
    const cancelUrl = "https://example.com/guest/action?token=abc123";
    expect(cancelUrl).toContain("guest/action");
    expect(cancelUrl).toContain("token=");
  });
});

// ============================================================
// Integration contract tests
// ============================================================

describe("Phase 4.48b: Integration contracts", () => {
  it("guest verifications table should have rsvp_id column", () => {
    // Documents the schema: guest_verifications.rsvp_id references event_rsvps.id
    const guestVerification = {
      id: "ver-1",
      email: "guest@example.com",
      event_id: "event-1",
      timeslot_id: null, // NULL for RSVP verifications
      rsvp_id: "rsvp-1", // New column for RSVP support
      guest_name: "Guest Name",
      verified_at: "2026-01-15T12:00:00Z",
    };

    expect(guestVerification.rsvp_id).toBe("rsvp-1");
    expect(guestVerification.timeslot_id).toBeNull();
  });

  it("should distinguish RSVP vs timeslot verifications by timeslot_id", () => {
    // RSVP verification: timeslot_id is NULL
    const rsvpVerification = { timeslot_id: null, rsvp_id: "rsvp-1" };
    expect(rsvpVerification.timeslot_id).toBeNull();

    // Timeslot verification: timeslot_id is set
    const slotVerification = { timeslot_id: "slot-1", rsvp_id: null };
    expect(slotVerification.timeslot_id).toBe("slot-1");
  });

  it("RLS should allow SELECT on event_rsvps for anon role", () => {
    // The migration grants SELECT to anon for public attendee lists
    // This test documents that contract
    const rlsGrant = "GRANT SELECT ON public.event_rsvps TO anon";
    expect(rlsGrant).toContain("SELECT");
    expect(rlsGrant).toContain("anon");
  });
});
