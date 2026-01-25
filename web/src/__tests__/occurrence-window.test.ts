/**
 * Phase 4.84: Occurrence Window Helper Tests
 *
 * Tests for the rolling 90-day window notice system.
 */

import { describe, it, expect } from "vitest";
import {
  formatDateLabel,
  getOccurrenceWindowRange,
  getOccurrenceWindowNotice,
} from "@/lib/events/occurrenceWindow";
import { EXPANSION_CAPS } from "@/lib/events/nextOccurrence";

describe("occurrenceWindow", () => {
  describe("formatDateLabel", () => {
    it("formats date as Month Day", () => {
      expect(formatDateLabel("2026-01-24")).toBe("Jan 24");
      expect(formatDateLabel("2026-04-15")).toBe("Apr 15");
      expect(formatDateLabel("2026-12-31")).toBe("Dec 31");
    });

    it("handles edge cases at month boundaries", () => {
      expect(formatDateLabel("2026-01-01")).toBe("Jan 1");
      expect(formatDateLabel("2026-02-28")).toBe("Feb 28");
    });

    it("uses Mountain Time to avoid timezone drift", () => {
      // This should not produce Dec 31 when formatted in MT
      expect(formatDateLabel("2026-01-01")).toBe("Jan 1");
    });
  });

  describe("getOccurrenceWindowRange", () => {
    it("returns default 90-day window from today when no date provided", () => {
      const range = getOccurrenceWindowRange();
      expect(range.windowDays).toBe(90);
      expect(range.startKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.endKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.startLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
      expect(range.endLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it("computes window from provided start date", () => {
      const range = getOccurrenceWindowRange("2026-01-24");
      expect(range.startKey).toBe("2026-01-24");
      expect(range.startLabel).toBe("Jan 24");
      // 90 days from Jan 24 = Apr 24
      expect(range.endKey).toBe("2026-04-24");
      expect(range.endLabel).toBe("Apr 24");
    });

    it("uses EXPANSION_CAPS.DEFAULT_WINDOW_DAYS constant", () => {
      const range = getOccurrenceWindowRange("2026-01-01");
      expect(range.windowDays).toBe(EXPANSION_CAPS.DEFAULT_WINDOW_DAYS);
      expect(range.windowDays).toBe(90);
    });

    it("handles year boundary correctly", () => {
      // Nov 15 + 90 days = Feb 13 of next year
      const range = getOccurrenceWindowRange("2025-11-15");
      expect(range.startKey).toBe("2025-11-15");
      expect(range.endKey).toBe("2026-02-13");
    });
  });

  describe("getOccurrenceWindowNotice", () => {
    it("returns headline and detail strings", () => {
      const notice = getOccurrenceWindowNotice("2026-01-24");
      expect(notice.headline).toBe(
        "Occurrences are shown in a rolling 90-day window from today."
      );
      expect(notice.detail).toContain("Showing:");
      expect(notice.detail).toContain("Jan 24");
      expect(notice.detail).toContain("Apr 24");
    });

    it("uses default today when no date provided", () => {
      const notice = getOccurrenceWindowNotice();
      expect(notice.headline).toBeTruthy();
      expect(notice.detail).toContain("Showing:");
      expect(notice.detail).toContain("New dates appear automatically");
    });

    it("includes the dynamic date range in detail", () => {
      const notice = getOccurrenceWindowNotice("2026-06-01");
      // Jun 1 + 90 = Aug 30
      expect(notice.detail).toBe(
        "Showing: Jun 1 – Aug 30. New dates appear automatically as the 3 month view window advances."
      );
    });
  });

  describe("consistency with nextOccurrence", () => {
    it("windowDays matches EXPANSION_CAPS.DEFAULT_WINDOW_DAYS", () => {
      // This is the critical invariant: the notice must match the actual window
      const range = getOccurrenceWindowRange();
      expect(range.windowDays).toBe(EXPANSION_CAPS.DEFAULT_WINDOW_DAYS);
    });
  });
});
