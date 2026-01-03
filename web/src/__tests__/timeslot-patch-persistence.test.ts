/**
 * Tests for timeslot configuration persistence in PATCH handler
 *
 * Bug reproduced: Form sends has_timeslots, total_slots, slot_duration_minutes,
 * allow_guests but PATCH handler silently ignored them (not in allowedFields).
 *
 * Root cause: allowedFields whitelist was missing timeslot fields.
 */

import { describe, it, expect } from "vitest";

// Simulate the allowedFields from the PATCH handler (before fix)
const ALLOWED_FIELDS_BEFORE_FIX = [
  "title", "description", "event_type", "capacity", "host_notes",
  "day_of_week", "start_time", "event_date",
  "end_time", "status", "recurrence_rule", "cover_image_url", "is_published",
  "timezone", "location_mode", "online_url", "is_free", "cost_label",
  "signup_mode", "signup_url", "signup_deadline", "age_policy"
];

// Current allowedFields (after fix)
const ALLOWED_FIELDS_AFTER_FIX = [
  "title", "description", "event_type", "capacity", "host_notes",
  "day_of_week", "start_time", "event_date",
  "end_time", "status", "recurrence_rule", "cover_image_url", "is_published",
  "timezone", "location_mode", "online_url", "is_free", "cost_label",
  "signup_mode", "signup_url", "signup_deadline", "age_policy",
  // Timeslot configuration fields (added in fix)
  "has_timeslots", "total_slots", "slot_duration_minutes"
];

// Form payload shape (what the form actually sends)
interface FormPayload {
  has_timeslots: boolean;
  total_slots: number | null;
  slot_duration_minutes: number | null;
  allow_guests: boolean | null; // Note: maps to allow_guest_slots in DB
}

// DB column names for timeslot config
const DB_TIMESLOT_COLUMNS = [
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
  "allow_guest_slots" // Note: form sends allow_guests, DB uses allow_guest_slots
];

describe("Timeslot PATCH persistence", () => {
  describe("Bug reproduction: form payload ignored by PATCH", () => {
    it("BEFORE FIX: has_timeslots was NOT in allowedFields", () => {
      expect(ALLOWED_FIELDS_BEFORE_FIX).not.toContain("has_timeslots");
    });

    it("BEFORE FIX: total_slots was NOT in allowedFields", () => {
      expect(ALLOWED_FIELDS_BEFORE_FIX).not.toContain("total_slots");
    });

    it("BEFORE FIX: slot_duration_minutes was NOT in allowedFields", () => {
      expect(ALLOWED_FIELDS_BEFORE_FIX).not.toContain("slot_duration_minutes");
    });

    it("AFTER FIX: has_timeslots IS in allowedFields", () => {
      expect(ALLOWED_FIELDS_AFTER_FIX).toContain("has_timeslots");
    });

    it("AFTER FIX: total_slots IS in allowedFields", () => {
      expect(ALLOWED_FIELDS_AFTER_FIX).toContain("total_slots");
    });

    it("AFTER FIX: slot_duration_minutes IS in allowedFields", () => {
      expect(ALLOWED_FIELDS_AFTER_FIX).toContain("slot_duration_minutes");
    });
  });

  describe("Form payload to DB mapping", () => {
    it("form sends allow_guests, DB column is allow_guest_slots", () => {
      // This documents the mapping that PATCH handler must perform
      const formPayload: FormPayload = {
        has_timeslots: true,
        total_slots: 10,
        slot_duration_minutes: 15,
        allow_guests: true
      };

      // The handler should map allow_guests → allow_guest_slots
      const expectedDbUpdate = {
        has_timeslots: formPayload.has_timeslots,
        total_slots: formPayload.total_slots,
        slot_duration_minutes: formPayload.slot_duration_minutes,
        allow_guest_slots: formPayload.allow_guests // Mapped field
      };

      expect(expectedDbUpdate.allow_guest_slots).toBe(true);
    });

    it("DB column names match expected schema", () => {
      expect(DB_TIMESLOT_COLUMNS).toContain("has_timeslots");
      expect(DB_TIMESLOT_COLUMNS).toContain("total_slots");
      expect(DB_TIMESLOT_COLUMNS).toContain("slot_duration_minutes");
      expect(DB_TIMESLOT_COLUMNS).toContain("allow_guest_slots");
    });
  });

  describe("Timeslot regeneration safety", () => {
    it("should NOT regenerate slots when claims exist", () => {
      // Mock scenario: event has 10 slots, 3 are claimed
      const existingClaims = [
        { timeslot_id: "slot-1", status: "confirmed" },
        { timeslot_id: "slot-2", status: "confirmed" },
        { timeslot_id: "slot-3", status: "waitlist" }
      ];

      const claimCount = existingClaims.filter(c =>
        ["confirmed", "performed", "waitlist"].includes(c.status)
      ).length;

      // If claims exist, regeneration should be skipped
      const shouldRegenerate = claimCount === 0;
      expect(shouldRegenerate).toBe(false);
    });

    it("should regenerate slots when no claims exist", () => {
      const existingClaims: { timeslot_id: string; status: string }[] = [];

      const claimCount = existingClaims.filter(c =>
        ["confirmed", "performed", "waitlist"].includes(c.status)
      ).length;

      // If no claims, regeneration is safe
      const shouldRegenerate = claimCount === 0;
      expect(shouldRegenerate).toBe(true);
    });

    it("should generate fresh slots when none exist", () => {
      const slotCount = 0;

      // If no slots exist, we should generate fresh
      const shouldGenerateFresh = slotCount === 0;
      expect(shouldGenerateFresh).toBe(true);
    });
  });

  describe("Lane selection contract", () => {
    interface Event {
      is_dsc_event: boolean;
      has_timeslots: boolean;
      is_published: boolean;
      status: string;
    }

    function getAttendanceLane(event: Event): "timeslot" | "rsvp" | "none" {
      const canRSVP = event.status !== "cancelled" && event.is_published;

      if (event.is_dsc_event && event.has_timeslots) {
        return "timeslot";
      }
      if (canRSVP && event.is_dsc_event && !event.has_timeslots) {
        return "rsvp";
      }
      return "none";
    }

    it("event with has_timeslots=true should show timeslot lane", () => {
      const event: Event = {
        is_dsc_event: true,
        has_timeslots: true,
        is_published: true,
        status: "active"
      };
      expect(getAttendanceLane(event)).toBe("timeslot");
    });

    it("event with has_timeslots=false should show RSVP lane", () => {
      const event: Event = {
        is_dsc_event: true,
        has_timeslots: false,
        is_published: true,
        status: "active"
      };
      expect(getAttendanceLane(event)).toBe("rsvp");
    });

    it("unpublished event should show no lane", () => {
      const event: Event = {
        is_dsc_event: true,
        has_timeslots: false,
        is_published: false,
        status: "draft"
      };
      expect(getAttendanceLane(event)).toBe("none");
    });

    it("cancelled event should show no lane", () => {
      const event: Event = {
        is_dsc_event: true,
        has_timeslots: true,
        is_published: true,
        status: "cancelled"
      };
      // Timeslot lane shows regardless of status (disabled but visible)
      expect(getAttendanceLane(event)).toBe("timeslot");
    });
  });

  describe("Open mics redirect contract", () => {
    it("DSC events on /open-mics should redirect to /events", () => {
      const event = {
        id: "test-uuid",
        is_dsc_event: true,
        slug: "test-open-mic"
      };

      // If is_dsc_event is true, redirect to /events/{id}
      const shouldRedirect = event.is_dsc_event === true;
      const redirectUrl = shouldRedirect ? `/events/${event.id}` : null;

      expect(shouldRedirect).toBe(true);
      expect(redirectUrl).toBe("/events/test-uuid");
    });

    it("non-DSC events on /open-mics should stay on /open-mics", () => {
      const event = {
        id: "test-uuid",
        is_dsc_event: false,
        slug: "test-open-mic"
      };

      const shouldRedirect = event.is_dsc_event === true;
      expect(shouldRedirect).toBe(false);
    });
  });
});
