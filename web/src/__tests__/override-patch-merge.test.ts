/**
 * Tests for applyOccurrenceOverride merge function.
 *
 * Verifies that:
 * 1. Legacy columns (override_start_time, override_cover_image_url, override_notes) apply correctly
 * 2. override_patch keys overlay on top of base event
 * 3. Only allowlisted keys from override_patch are applied
 * 4. Null/undefined overrides return base event unchanged
 * 5. override_patch takes precedence over legacy columns when both set
 * 6. Original event object is not mutated
 */

import { describe, it, expect } from "vitest";
import {
  applyOccurrenceOverride,
  ALLOWED_OVERRIDE_FIELDS,
  type OccurrenceOverride,
} from "@/lib/events/nextOccurrence";

const baseEvent = {
  id: "evt-1",
  title: "Weekly Open Mic",
  description: "A weekly open mic night",
  event_type: "open_mic",
  start_time: "19:00:00",
  end_time: "22:00:00",
  venue_id: "venue-1",
  cover_image_url: "https://example.com/base.jpg",
  host_notes: "Base notes",
  recurrence_rule: "weekly",
  day_of_week: "Monday",
  capacity: 50,
  is_free: true,
  cost_label: "Free",
  categories: ["music"],
  is_published: true,
};

describe("applyOccurrenceOverride", () => {
  describe("null/undefined override", () => {
    it("returns base event unchanged when override is null", () => {
      const result = applyOccurrenceOverride(baseEvent, null);
      expect(result).toEqual(baseEvent);
    });

    it("returns base event unchanged when override is undefined", () => {
      const result = applyOccurrenceOverride(baseEvent, undefined);
      expect(result).toEqual(baseEvent);
    });

    it("returns base event unchanged when override has no modifications", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      // Should only differ by NOT having legacy override fields applied
      expect(result.start_time).toBe("19:00:00");
      expect(result.cover_image_url).toBe("https://example.com/base.jpg");
      expect(result.host_notes).toBe("Base notes");
    });
  });

  describe("legacy columns", () => {
    it("applies override_start_time", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_start_time: "20:00:00",
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.start_time).toBe("20:00:00");
    });

    it("applies override_cover_image_url", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_cover_image_url: "https://example.com/special.jpg",
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.cover_image_url).toBe("https://example.com/special.jpg");
    });

    it("applies override_notes as host_notes", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_notes: "Special night with guest performer",
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.host_notes).toBe("Special night with guest performer");
    });

    it("does not apply null legacy columns", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_start_time: null,
        override_cover_image_url: null,
        override_notes: null,
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.start_time).toBe("19:00:00");
      expect(result.cover_image_url).toBe("https://example.com/base.jpg");
      expect(result.host_notes).toBe("Base notes");
    });
  });

  describe("override_patch", () => {
    it("applies allowlisted keys from override_patch", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_patch: {
          title: "Special Night",
          venue_id: "venue-2",
          capacity: 75,
        },
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.title).toBe("Special Night");
      expect(result.venue_id).toBe("venue-2");
      expect(result.capacity).toBe(75);
    });

    it("blocks non-allowlisted keys from override_patch", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_patch: {
          event_type: "showcase", // BLOCKED
          recurrence_rule: "monthly", // BLOCKED
          day_of_week: "Friday", // BLOCKED
          title: "Allowed Field", // ALLOWED
        },
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.event_type).toBe("open_mic"); // Unchanged
      expect(result.recurrence_rule).toBe("weekly"); // Unchanged
      expect(result.day_of_week).toBe("Monday"); // Unchanged
      expect(result.title).toBe("Allowed Field"); // Applied
    });

    it("applies null values in override_patch (field removal)", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_patch: {
          description: null,
          end_time: null,
        },
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.description).toBeNull();
      expect(result.end_time).toBeNull();
    });

    it("override_patch takes precedence over legacy columns", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_start_time: "20:00:00", // Legacy
        override_patch: {
          start_time: "21:00:00", // Patch (wins)
        },
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.start_time).toBe("21:00:00"); // Patch wins
    });

    it("applies categories array from override_patch", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_patch: {
          categories: ["music", "comedy"],
        },
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.categories).toEqual(["music", "comedy"]);
    });

    it("ignores override_patch when it is null", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_patch: null,
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.title).toBe("Weekly Open Mic");
    });

    it("ignores override_patch when it is not an object", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_patch: "not an object" as unknown as Record<string, unknown>,
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.title).toBe("Weekly Open Mic");
    });
  });

  describe("immutability", () => {
    it("does not mutate the original base event", () => {
      const original = { ...baseEvent };
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_start_time: "20:00:00",
        override_patch: {
          title: "Modified",
          capacity: 100,
        },
      };
      applyOccurrenceOverride(baseEvent, override);
      expect(baseEvent).toEqual(original);
    });

    it("returns a new object reference", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_patch: { title: "New" },
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result).not.toBe(baseEvent);
    });
  });

  describe("ALLOWED_OVERRIDE_FIELDS", () => {
    it("includes all expected per-occurrence fields", () => {
      const expectedFields = [
        "title", "description", "start_time", "end_time",
        "venue_id", "location_mode", "custom_location_name",
        "custom_address", "custom_city", "custom_state",
        "online_url", "location_notes", "capacity",
        "has_timeslots", "total_slots", "slot_duration_minutes",
        "is_free", "cost_label", "signup_url", "signup_deadline",
        "age_policy", "external_url", "categories",
        "cover_image_url", "host_notes", "is_published",
      ];
      for (const field of expectedFields) {
        expect(ALLOWED_OVERRIDE_FIELDS.has(field)).toBe(true);
      }
    });

    it("excludes series-level fields", () => {
      const blockedFields = [
        "event_type", "recurrence_rule", "day_of_week",
        "custom_dates", "max_occurrences", "series_mode",
        "is_dsc_event",
      ];
      for (const field of blockedFields) {
        expect(ALLOWED_OVERRIDE_FIELDS.has(field)).toBe(false);
      }
    });
  });

  describe("complex scenarios", () => {
    it("handles full override with all legacy + patch fields", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "normal",
        override_start_time: "20:00:00",
        override_cover_image_url: "https://example.com/special.jpg",
        override_notes: "Guest performer tonight",
        override_patch: {
          title: "Special Night Open Mic",
          venue_id: "venue-2",
          end_time: "23:00:00",
          capacity: 100,
          is_free: false,
          cost_label: "$5 cover",
        },
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      expect(result.title).toBe("Special Night Open Mic");
      expect(result.start_time).toBe("20:00:00"); // Legacy applied (patch didn't override)
      expect(result.end_time).toBe("23:00:00");
      expect(result.venue_id).toBe("venue-2");
      expect(result.cover_image_url).toBe("https://example.com/special.jpg");
      expect(result.host_notes).toBe("Guest performer tonight");
      expect(result.capacity).toBe(100);
      expect(result.is_free).toBe(false);
      expect(result.cost_label).toBe("$5 cover");
      // Unchanged fields
      expect(result.event_type).toBe("open_mic");
      expect(result.recurrence_rule).toBe("weekly");
      expect(result.day_of_week).toBe("Monday");
    });

    it("handles cancelled override (status only)", () => {
      const override: OccurrenceOverride = {
        event_id: "evt-1",
        date_key: "2026-01-20",
        status: "cancelled",
      };
      const result = applyOccurrenceOverride(baseEvent, override);
      // Base fields unchanged (status is separate from field overrides)
      expect(result.title).toBe("Weekly Open Mic");
      expect(result.start_time).toBe("19:00:00");
    });
  });
});
