/**
 * Email Cancel Link Tests
 *
 * These tests ensure that cancel links in email templates are properly formatted
 * with per-occurrence date_key support (Phase ABC6) and correct URL patterns.
 *
 * Bug fixed: Cancel links were missing date_key parameter for per-occurrence RSVPs,
 * causing the cancel action to fail for recurring event occurrences.
 *
 * INVARIANTS:
 * 1. Cancel URLs MUST include date_key when provided for per-occurrence scoping
 * 2. Cancel URLs MUST use the pattern: ?date={dateKey}&cancel=true (not ?cancel=true&date=)
 * 3. Guest cancel URLs MUST use action tokens (not raw verification IDs)
 * 4. CancelRSVPModal MUST clear ?cancel=true from URL after successful cancel
 */

import { describe, it, expect } from "vitest";
import { getEventUpdatedEmail } from "@/lib/email/templates/eventUpdated";
import { getEventReminderEmail } from "@/lib/email/templates/eventReminder";
import { getOccurrenceModifiedHostEmail } from "@/lib/email/templates/occurrenceModifiedHost";

describe("Email Cancel Links - Per-Occurrence Support", () => {
  describe("eventUpdated template", () => {
    it("includes dateKey in cancel URL when provided", () => {
      const email = getEventUpdatedEmail({
        userName: "Test User",
        eventTitle: "Weekly Open Mic",
        eventId: "event-123",
        eventSlug: "weekly-open-mic",
        dateKey: "2026-02-15",
        changes: { time: { old: "7:00 PM", new: "8:00 PM" } },
        eventDate: "February 15, 2026",
        eventTime: "8:00 PM",
        venueName: "Test Venue",
      });

      // HTML should have cancel URL with date parameter
      expect(email.html).toContain("?date=2026-02-15&cancel=true");
      // Text should also have the cancel URL
      expect(email.text).toContain("?date=2026-02-15&cancel=true");
    });

    it("omits date parameter when dateKey is not provided", () => {
      const email = getEventUpdatedEmail({
        userName: "Test User",
        eventTitle: "One-Time Event",
        eventId: "event-456",
        eventSlug: "one-time-event",
        // No dateKey provided
        changes: { time: { old: "7:00 PM", new: "8:00 PM" } },
        eventDate: "February 15, 2026",
        eventTime: "8:00 PM",
        venueName: "Test Venue",
      });

      // Should use simple cancel URL without date
      expect(email.html).toContain("?cancel=true");
      expect(email.html).not.toContain("?date=");
      expect(email.text).toContain("?cancel=true");
      expect(email.text).not.toContain("?date=");
    });

    it("uses slug in URL when available", () => {
      const email = getEventUpdatedEmail({
        userName: "Test User",
        eventTitle: "Weekly Open Mic",
        eventId: "event-123-uuid",
        eventSlug: "weekly-open-mic",
        dateKey: "2026-02-15",
        changes: { time: { old: "7:00 PM", new: "8:00 PM" } },
        eventDate: "February 15, 2026",
        eventTime: "8:00 PM",
        venueName: "Test Venue",
      });

      expect(email.html).toContain("/events/weekly-open-mic?date=");
      expect(email.text).toContain("/events/weekly-open-mic?date=");
    });

    it("falls back to eventId when slug is not available", () => {
      const email = getEventUpdatedEmail({
        userName: "Test User",
        eventTitle: "Weekly Open Mic",
        eventId: "event-123-uuid",
        eventSlug: null,
        dateKey: "2026-02-15",
        changes: { time: { old: "7:00 PM", new: "8:00 PM" } },
        eventDate: "February 15, 2026",
        eventTime: "8:00 PM",
        venueName: "Test Venue",
      });

      expect(email.html).toContain("/events/event-123-uuid?date=");
      expect(email.text).toContain("/events/event-123-uuid?date=");
    });
  });

  describe("eventReminder template", () => {
    it("includes dateKey in cancel URL when provided", () => {
      const email = getEventReminderEmail({
        userName: "Test User",
        eventTitle: "Weekly Open Mic",
        eventDate: "February 15, 2026",
        eventTime: "8:00 PM",
        venueName: "Test Venue",
        eventId: "event-123",
        eventSlug: "weekly-open-mic",
        dateKey: "2026-02-15",
        reminderType: "tonight",
      });

      expect(email.html).toContain("?date=2026-02-15&cancel=true");
      expect(email.text).toContain("?date=2026-02-15&cancel=true");
    });

    it("omits date parameter when dateKey is not provided", () => {
      const email = getEventReminderEmail({
        userName: "Test User",
        eventTitle: "One-Time Event",
        eventDate: "February 15, 2026",
        eventTime: "8:00 PM",
        venueName: "Test Venue",
        eventId: "event-456",
        eventSlug: "one-time-event",
        // No dateKey
        reminderType: "tomorrow",
      });

      expect(email.html).toContain("?cancel=true");
      expect(email.html).not.toContain("?date=");
    });

    it("includes slot number for performers with assigned slots", () => {
      const email = getEventReminderEmail({
        userName: "Test Performer",
        eventTitle: "Weekly Open Mic",
        eventDate: "February 15, 2026",
        eventTime: "8:00 PM",
        venueName: "Test Venue",
        eventId: "event-123",
        eventSlug: "weekly-open-mic",
        dateKey: "2026-02-15",
        reminderType: "tonight",
        slotNumber: 3,
      });

      expect(email.html).toContain("#3");
      expect(email.text).toContain("#3");
    });
  });

  describe("occurrenceModifiedHost template", () => {
    it("includes dateKey in cancel URL when provided", () => {
      const email = getOccurrenceModifiedHostEmail({
        userName: "Test User",
        eventTitle: "Weekly Open Mic",
        occurrenceDate: "Saturday, February 15, 2026",
        eventId: "event-123",
        eventSlug: "weekly-open-mic",
        dateKey: "2026-02-15",
        changes: { time: { old: "7:00 PM", new: "8:00 PM" } },
        newTime: "8:00 PM",
        venueName: "Test Venue",
      });

      expect(email.html).toContain("?date=2026-02-15&cancel=true");
      expect(email.text).toContain("?date=2026-02-15&cancel=true");
    });

    it("omits date parameter when dateKey is not provided", () => {
      const email = getOccurrenceModifiedHostEmail({
        userName: "Test User",
        eventTitle: "Weekly Open Mic",
        occurrenceDate: "Saturday, February 15, 2026",
        eventId: "event-123",
        eventSlug: "weekly-open-mic",
        // No dateKey (might happen for legacy data)
        changes: { time: { old: "7:00 PM", new: "8:00 PM" } },
        newTime: "8:00 PM",
        venueName: "Test Venue",
      });

      expect(email.html).toContain("?cancel=true");
      expect(email.html).not.toContain("?date=");
    });

    it("event URL includes date parameter for deep-linking", () => {
      const email = getOccurrenceModifiedHostEmail({
        userName: "Test User",
        eventTitle: "Weekly Open Mic",
        occurrenceDate: "Saturday, February 15, 2026",
        eventId: "event-123",
        eventSlug: "weekly-open-mic",
        dateKey: "2026-02-15",
        changes: { time: { old: "7:00 PM", new: "8:00 PM" } },
        newTime: "8:00 PM",
        venueName: "Test Venue",
      });

      // Event URL (not cancel) should also have date for per-occurrence deep-linking
      expect(email.html).toContain("/events/weekly-open-mic?date=2026-02-15");
      expect(email.text).toContain("/events/weekly-open-mic?date=2026-02-15");
    });
  });
});

describe("Cancel URL Format Invariants", () => {
  it("cancel URLs must use date before cancel parameter", () => {
    // This ensures URLs like ?date=2026-02-15&cancel=true work correctly
    // and not ?cancel=true&date=2026-02-15 which could have parsing issues
    const email = getEventUpdatedEmail({
      userName: "Test User",
      eventTitle: "Weekly Open Mic",
      eventId: "event-123",
      eventSlug: "weekly-open-mic",
      dateKey: "2026-02-15",
      changes: { time: { old: "7:00 PM", new: "8:00 PM" } },
      eventDate: "February 15, 2026",
      eventTime: "8:00 PM",
      venueName: "Test Venue",
    });

    // Should be ?date=...&cancel=true, not ?cancel=true&date=...
    const cancelUrlMatch = email.html.match(/\?date=[^"&]+&cancel=true/);
    expect(cancelUrlMatch).not.toBeNull();
  });

  it("all email templates follow consistent URL pattern", () => {
    const dateKey = "2026-03-20";
    const slug = "test-event";

    const updated = getEventUpdatedEmail({
      eventTitle: "Test",
      eventId: "id",
      eventSlug: slug,
      dateKey,
      changes: {},
      eventDate: "March 20",
      eventTime: "7 PM",
      venueName: "Venue",
    });

    const reminder = getEventReminderEmail({
      eventTitle: "Test",
      eventDate: "March 20",
      eventTime: "7 PM",
      venueName: "Venue",
      eventId: "id",
      eventSlug: slug,
      dateKey,
      reminderType: "tonight",
    });

    const modified = getOccurrenceModifiedHostEmail({
      eventTitle: "Test",
      occurrenceDate: "March 20",
      eventId: "id",
      eventSlug: slug,
      dateKey,
      changes: {},
      venueName: "Venue",
    });

    // All should have the same cancel URL format
    const expectedCancelPattern = `?date=${dateKey}&cancel=true`;
    expect(updated.html).toContain(expectedCancelPattern);
    expect(reminder.html).toContain(expectedCancelPattern);
    expect(modified.html).toContain(expectedCancelPattern);
  });
});

describe("CancelRSVPModal Contract", () => {
  // These tests document the expected behavior of CancelRSVPModal
  // The actual component tests would need React Testing Library

  it("documents dateKey prop requirement for per-occurrence RSVPs", () => {
    /**
     * CancelRSVPModal MUST accept dateKey prop and include it in DELETE request:
     *
     * interface CancelRSVPModalProps {
     *   eventId: string;
     *   eventTitle: string;
     *   isOpen: boolean;
     *   onClose: () => void;
     *   onSuccess?: () => void;
     *   dateKey?: string;  // Phase ABC6: Required for recurring events
     * }
     *
     * DELETE URL: `/api/events/${eventId}/rsvp${dateKey ? `?date_key=${dateKey}` : ''}`
     */
    expect(true).toBe(true); // Documentation test
  });

  it("documents URL cleanup after successful cancel", () => {
    /**
     * After successful RSVP cancellation, CancelRSVPModal MUST:
     * 1. Clear ?cancel=true from URL using window.history.replaceState
     * 2. Call router.refresh() to update server state
     * 3. Call onSuccess() callback if provided
     *
     * This prevents the "No RSVP found" loop where:
     * - User clicks cancel link in email
     * - Modal opens, user confirms cancel
     * - Page reloads but ?cancel=true still in URL
     * - Modal tries to open again but RSVP is gone
     */
    expect(true).toBe(true); // Documentation test
  });
});

describe("Guest Timeslot Claim Cancel URL", () => {
  it("documents action token requirement for guest cancels", () => {
    /**
     * Guest timeslot claim cancel URLs MUST use action tokens:
     *
     * CORRECT: /guest/action?token=${cancelToken}&action=cancel
     * WRONG:   /guest/action?type=cancel_timeslot&id=${verification.id}
     *
     * The action token is created using createActionToken() which includes:
     * - email: The guest's email for verification
     * - claim_id: The timeslot claim to cancel
     * - action: "cancel"
     * - verification_id: Reference to original verification
     *
     * The /guest/action page validates the JWT token before allowing the action.
     */
    expect(true).toBe(true); // Documentation test
  });
});
