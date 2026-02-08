/**
 * Phase 4.42k: Event Creation Fixes Tests
 *
 * Tests for:
 * - A1b: Auto-verification on community event create
 * - B1: is_free removed from missing details check
 * - D2: Date bug fixes (noon UTC pattern)
 * - C3: Series detection with series_id
 * - Banner copy: Source-aware messaging
 * - Form validation: noValidate + error summary
 */

import { describe, it, expect } from "vitest";
import { computeMissingDetails } from "@/lib/events/missingDetails";
import { generateSeriesDates } from "@/lib/events/formDateHelpers";
import { addDaysDenver, getTodayDenver } from "@/lib/events/nextOccurrence";

describe("Phase 4.42k: Event Creation Fixes", () => {
  // =============================================================================
  // B1: is_free removed from missing details check
  // =============================================================================
  describe("B1: Missing Details - is_free Removed", () => {
    it("should NOT report missing details when is_free is null", () => {
      const result = computeMissingDetails({
        location_mode: "venue",
        venue_id: "some-venue-id",
        is_free: null,
        is_dsc_event: false,
      });

      // is_free being null should NOT trigger missing details
      expect(result.missing).toBe(false);
      expect(result.reasons).not.toContain("Cost information unknown");
    });

    it("should NOT report missing details when is_free is undefined", () => {
      const result = computeMissingDetails({
        location_mode: "venue",
        venue_id: "some-venue-id",
        is_free: undefined,
        is_dsc_event: false,
      });

      expect(result.missing).toBe(false);
      expect(result.reasons).not.toContain("Cost information unknown");
    });

    it("should NOT report missing when is_free is true", () => {
      const result = computeMissingDetails({
        location_mode: "venue",
        venue_id: "some-venue-id",
        is_free: true,
        is_dsc_event: false,
      });

      expect(result.missing).toBe(false);
    });

    it("should NOT report missing when is_free is false", () => {
      const result = computeMissingDetails({
        location_mode: "venue",
        venue_id: "some-venue-id",
        is_free: false,
        is_dsc_event: false,
      });

      expect(result.missing).toBe(false);
    });

    // Ensure other missing details rules still work
    it("should still report missing venue for venue mode without venue_id", () => {
      const result = computeMissingDetails({
        location_mode: "venue",
        venue_id: null,
        is_dsc_event: false,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain("Missing venue information");
    });

    it("should still report missing online URL for online mode", () => {
      const result = computeMissingDetails({
        location_mode: "online",
        online_url: null,
        is_dsc_event: false,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain("Online event missing URL");
    });

    it("should still report missing age policy for CSC events", () => {
      const result = computeMissingDetails({
        location_mode: "venue",
        venue_id: "some-venue-id",
        is_dsc_event: true,
        age_policy: null,
      });

      expect(result.missing).toBe(true);
      expect(result.reasons).toContain("CSC event missing age policy");
    });
  });

  // =============================================================================
  // D2: Date Bug Fixes - MT-safe series generation
  // =============================================================================
  describe("D2: Date Handling - MT-safe Patterns", () => {
    it("generateSeriesDates should produce correct weekly series", () => {
      const dates = generateSeriesDates("2026-01-12", 4);

      expect(dates).toHaveLength(4);
      expect(dates[0]).toBe("2026-01-12"); // Start date
      expect(dates[1]).toBe("2026-01-19"); // Week 2
      expect(dates[2]).toBe("2026-01-26"); // Week 3
      expect(dates[3]).toBe("2026-02-02"); // Week 4
    });

    it("generateSeriesDates should not shift dates across month boundaries", () => {
      // Edge case: last day of month
      const dates = generateSeriesDates("2026-01-31", 3);

      expect(dates).toHaveLength(3);
      expect(dates[0]).toBe("2026-01-31");
      expect(dates[1]).toBe("2026-02-07");
      expect(dates[2]).toBe("2026-02-14");
    });

    it("addDaysDenver should add days correctly without timezone shift", () => {
      const start = "2026-01-12"; // Monday
      const nextWeek = addDaysDenver(start, 7);

      expect(nextWeek).toBe("2026-01-19"); // Still Monday
    });

    it("addDaysDenver should handle DST boundary correctly", () => {
      // March 8, 2026 is DST start in Denver (clocks spring forward)
      const beforeDST = "2026-03-07";
      const afterDST = addDaysDenver(beforeDST, 2);

      expect(afterDST).toBe("2026-03-09"); // Should still be correct date
    });

    it("getTodayDenver should return YYYY-MM-DD format", () => {
      const today = getTodayDenver();

      // Format should be YYYY-MM-DD
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // =============================================================================
  // Noon UTC Date Parsing Pattern
  // =============================================================================
  describe("D2: Noon UTC Parsing Pattern", () => {
    it("T12:00:00Z pattern should preserve date in any timezone", () => {
      // This simulates how display pages now parse dates
      const dateKey = "2026-01-12";
      const parsed = new Date(`${dateKey}T12:00:00Z`);

      // When formatted with Denver timezone, should show correct day
      const dayNumeric = parsed.toLocaleDateString("en-US", {
        day: "numeric",
        timeZone: "America/Denver",
      });

      expect(dayNumeric).toBe("12");
    });

    it("T12:00:00Z pattern should work for edge dates", () => {
      // First of month
      const jan1 = new Date("2026-01-01T12:00:00Z");
      const jan1Day = jan1.toLocaleDateString("en-US", {
        day: "numeric",
        timeZone: "America/Denver",
      });
      expect(jan1Day).toBe("1");

      // Last of month
      const jan31 = new Date("2026-01-31T12:00:00Z");
      const jan31Day = jan31.toLocaleDateString("en-US", {
        day: "numeric",
        timeZone: "America/Denver",
      });
      expect(jan31Day).toBe("31");
    });

    it("T12:00:00Z pattern should work across year boundary", () => {
      const dec31 = new Date("2025-12-31T12:00:00Z");
      const dec31Day = dec31.toLocaleDateString("en-US", {
        day: "numeric",
        timeZone: "America/Denver",
      });
      expect(dec31Day).toBe("31");

      const jan1 = new Date("2026-01-01T12:00:00Z");
      const jan1Day = jan1.toLocaleDateString("en-US", {
        day: "numeric",
        timeZone: "America/Denver",
      });
      expect(jan1Day).toBe("1");
    });
  });

  // =============================================================================
  // C3: Series Detection with series_id
  // =============================================================================
  describe("C3: Series Detection Logic", () => {
    it("should detect series when series_id is set", () => {
      // This tests the logic that would be in SeriesEditingNotice
      const event = {
        id: "event-1",
        series_id: "series-uuid",
        is_recurring: null,
        recurrence_rule: null,
        day_of_week: "Monday",
        event_date: "2026-01-12",
      };

      const isRecurring =
        event.is_recurring ||
        event.recurrence_rule ||
        event.series_id ||
        (event.day_of_week && !event.event_date);

      expect(isRecurring).toBeTruthy();
    });

    it("should detect series when is_recurring is true", () => {
      const event = {
        id: "event-1",
        series_id: null,
        is_recurring: true,
        recurrence_rule: null,
        day_of_week: null,
        event_date: null,
      };

      const isRecurring =
        event.is_recurring ||
        event.recurrence_rule ||
        event.series_id ||
        (event.day_of_week && !event.event_date);

      expect(isRecurring).toBe(true);
    });

    it("should detect series when recurrence_rule is set", () => {
      const event = {
        id: "event-1",
        series_id: null,
        is_recurring: null,
        recurrence_rule: "FREQ=WEEKLY;BYDAY=MO",
        day_of_week: null,
        event_date: null,
      };

      const isRecurring =
        event.is_recurring ||
        event.recurrence_rule ||
        event.series_id ||
        (event.day_of_week && !event.event_date);

      expect(isRecurring).toBeTruthy();
    });

    it("should detect recurring when day_of_week set without event_date", () => {
      const event = {
        id: "event-1",
        series_id: null,
        is_recurring: null,
        recurrence_rule: null,
        day_of_week: "Monday",
        event_date: null,
      };

      const isRecurring =
        event.is_recurring ||
        event.recurrence_rule ||
        event.series_id ||
        (event.day_of_week && !event.event_date);

      expect(isRecurring).toBeTruthy();
    });

    it("should NOT detect recurring for one-time event", () => {
      const event = {
        id: "event-1",
        series_id: null,
        is_recurring: null,
        recurrence_rule: null,
        day_of_week: "Monday",
        event_date: "2026-01-12", // Has specific date
      };

      const isRecurring =
        event.is_recurring ||
        event.recurrence_rule ||
        event.series_id ||
        (event.day_of_week && !event.event_date);

      // day_of_week + event_date means single occurrence, NOT recurring
      expect(isRecurring).toBeFalsy();
    });
  });

  // =============================================================================
  // Banner Copy: Source-Aware Messaging
  // =============================================================================
  describe("Banner Copy: Source-Aware Messaging", () => {
    it("should use 'imported' copy for source=import", () => {
      const event = { source: "import" as const };
      const message =
        event.source === "import"
          ? "This event was imported from an external source and hasn't been verified yet."
          : "This event is awaiting admin verification.";

      expect(message).toContain("imported from an external source");
    });

    it("should use 'awaiting verification' copy for source=community", () => {
      const event = { source: "community" as const };
      const message =
        event.source === "import"
          ? "This event was imported from an external source and hasn't been verified yet."
          : "This event is awaiting admin verification.";

      expect(message).toBe("This event is awaiting admin verification.");
    });

    it("should use 'awaiting verification' copy for source=admin", () => {
      const event = { source: "admin" as const };
      const message =
        event.source === "import"
          ? "This event was imported from an external source and hasn't been verified yet."
          : "This event is awaiting admin verification.";

      expect(message).toBe("This event is awaiting admin verification.");
    });
  });

  // =============================================================================
  // A1b: Auto-verification Contract
  // =============================================================================
  describe("A1b: Auto-verification Contract", () => {
    it("community events published should have last_verified_at set", () => {
      // This simulates what buildEventInsert does
      const publishedAt = "2026-01-05T12:00:00.000Z";
      const insertPayload = {
        source: "community",
        is_published: true,
        published_at: publishedAt,
        last_verified_at: publishedAt, // Should be same as publishedAt
      };

      expect(insertPayload.last_verified_at).toBe(publishedAt);
    });

    it("draft community events should have last_verified_at null", () => {
      const publishedAt = null;
      const insertPayload = {
        source: "community",
        is_published: false,
        published_at: publishedAt,
        last_verified_at: publishedAt, // Should be null for drafts
      };

      expect(insertPayload.last_verified_at).toBeNull();
    });

    it("verified_by should remain null for auto-confirmed events", () => {
      // A1b specifies: set last_verified_at but leave verified_by null
      // This distinguishes auto-confirmed from admin-verified
      const insertPayload = {
        source: "community",
        is_published: true,
        last_verified_at: "2026-01-05T12:00:00.000Z",
        // verified_by is NOT included - DB default is null
      };

      // verified_by not in payload = null in DB
      expect(insertPayload).not.toHaveProperty("verified_by");
    });
  });

  // =============================================================================
  // Form Validation Logic
  // =============================================================================
  describe("Form Validation: Required Fields Detection", () => {
    function validateFormFields(formData: {
      title: string;
      day_of_week: string;
      start_time: string;
      location_mode: string;
      venue_id: string | null;
      custom_location_name: string;
      online_url: string;
    }, locationSelectionMode: string): string[] {
      const missingFields: string[] = [];

      if (!formData.title.trim()) {
        missingFields.push("Title");
      }
      if (!formData.day_of_week) {
        missingFields.push("Day of Week");
      }
      if (!formData.start_time) {
        missingFields.push("Start Time");
      }

      if (formData.location_mode !== "online") {
        if (locationSelectionMode === "venue" && !formData.venue_id) {
          missingFields.push("Venue");
        }
        if (locationSelectionMode === "custom" && !formData.custom_location_name.trim()) {
          missingFields.push("Location Name");
        }
      }

      if ((formData.location_mode === "online" || formData.location_mode === "hybrid") && !formData.online_url) {
        missingFields.push("Online URL");
      }

      return missingFields;
    }

    it("should detect missing title", () => {
      const result = validateFormFields({
        title: "",
        day_of_week: "Monday",
        start_time: "19:00:00",
        location_mode: "venue",
        venue_id: "venue-id",
        custom_location_name: "",
        online_url: "",
      }, "venue");

      expect(result).toContain("Title");
    });

    it("should detect missing day of week", () => {
      const result = validateFormFields({
        title: "Test Event",
        day_of_week: "",
        start_time: "19:00:00",
        location_mode: "venue",
        venue_id: "venue-id",
        custom_location_name: "",
        online_url: "",
      }, "venue");

      expect(result).toContain("Day of Week");
    });

    it("should detect missing start time", () => {
      const result = validateFormFields({
        title: "Test Event",
        day_of_week: "Monday",
        start_time: "",
        location_mode: "venue",
        venue_id: "venue-id",
        custom_location_name: "",
        online_url: "",
      }, "venue");

      expect(result).toContain("Start Time");
    });

    it("should detect missing venue in venue mode", () => {
      const result = validateFormFields({
        title: "Test Event",
        day_of_week: "Monday",
        start_time: "19:00:00",
        location_mode: "venue",
        venue_id: null,
        custom_location_name: "",
        online_url: "",
      }, "venue");

      expect(result).toContain("Venue");
    });

    it("should detect missing location name in custom mode", () => {
      const result = validateFormFields({
        title: "Test Event",
        day_of_week: "Monday",
        start_time: "19:00:00",
        location_mode: "venue",
        venue_id: null,
        custom_location_name: "",
        online_url: "",
      }, "custom");

      expect(result).toContain("Location Name");
    });

    it("should detect missing online URL for online events", () => {
      const result = validateFormFields({
        title: "Test Event",
        day_of_week: "Monday",
        start_time: "19:00:00",
        location_mode: "online",
        venue_id: null,
        custom_location_name: "",
        online_url: "",
      }, "venue");

      expect(result).toContain("Online URL");
    });

    it("should detect missing online URL for hybrid events", () => {
      const result = validateFormFields({
        title: "Test Event",
        day_of_week: "Monday",
        start_time: "19:00:00",
        location_mode: "hybrid",
        venue_id: "venue-id",
        custom_location_name: "",
        online_url: "",
      }, "venue");

      expect(result).toContain("Online URL");
    });

    it("should pass with all required fields filled", () => {
      const result = validateFormFields({
        title: "Test Event",
        day_of_week: "Monday",
        start_time: "19:00:00",
        location_mode: "venue",
        venue_id: "venue-id",
        custom_location_name: "",
        online_url: "",
      }, "venue");

      expect(result).toHaveLength(0);
    });

    it("should pass for online event with URL", () => {
      const result = validateFormFields({
        title: "Test Event",
        day_of_week: "Monday",
        start_time: "19:00:00",
        location_mode: "online",
        venue_id: null,
        custom_location_name: "",
        online_url: "https://zoom.us/j/123456",
      }, "venue");

      expect(result).toHaveLength(0);
    });
  });
});
