/**
 * Phase 4.42c: Recurrence Unification Tests
 *
 * These tests verify the unified recurrence contract ensures:
 * 1. Labels ALWAYS match what the generator produces
 * 2. Recurring events ALWAYS expand to multiple occurrences
 * 3. The bug where event_date short-circuited expansion is fixed
 */

import { describe, it, expect } from "vitest";
import {
  expandOccurrencesForEvent,
  addDaysDenver,
} from "@/lib/events/nextOccurrence";
import { getRecurrenceSummary } from "@/lib/recurrenceHumanizer";
import {
  interpretRecurrence,
  labelFromRecurrence,
  shouldExpandToMultiple,
} from "@/lib/events/recurrenceContract";

describe("Phase 4.42c: Recurrence Unification", () => {
  describe("interpretRecurrence contract", () => {
    it("identifies weekly recurrence with day_of_week", () => {
      const rec = interpretRecurrence({
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      });
      expect(rec.isRecurring).toBe(true);
      expect(rec.frequency).toBe("weekly");
      expect(rec.dayName).toBe("Monday");
      expect(rec.dayOfWeekIndex).toBe(1); // Monday = 1
    });

    it("identifies one-time event (event_date only)", () => {
      const rec = interpretRecurrence({
        event_date: "2026-01-15",
      });
      expect(rec.isRecurring).toBe(false);
      expect(rec.frequency).toBe("one-time");
    });

    it("identifies recurring event WITH event_date as series start", () => {
      // This is the exact bug case we're fixing
      const rec = interpretRecurrence({
        event_date: "2026-01-06", // Tuesday
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      });
      // Should be treated as recurring (Monday pattern), NOT one-time
      expect(rec.isRecurring).toBe(true);
      expect(rec.frequency).toBe("weekly");
      expect(rec.dayName).toBe("Monday");
    });

    it("identifies monthly ordinal patterns", () => {
      const rec = interpretRecurrence({
        day_of_week: "Tuesday",
        recurrence_rule: "2nd",
      });
      expect(rec.isRecurring).toBe(true);
      expect(rec.frequency).toBe("monthly");
      expect(rec.ordinals).toEqual([2]);
    });

    it("identifies multi-ordinal patterns (1st/3rd)", () => {
      const rec = interpretRecurrence({
        day_of_week: "Thursday",
        recurrence_rule: "1st/3rd",
      });
      expect(rec.isRecurring).toBe(true);
      expect(rec.frequency).toBe("monthly");
      expect(rec.ordinals).toContain(1);
      expect(rec.ordinals).toContain(3);
    });

    it("identifies biweekly patterns", () => {
      const rec = interpretRecurrence({
        day_of_week: "Wednesday",
        recurrence_rule: "biweekly",
      });
      expect(rec.isRecurring).toBe(true);
      expect(rec.frequency).toBe("biweekly");
      expect(rec.interval).toBe(2);
    });
  });

  describe("labelFromRecurrence consistency", () => {
    it("generates correct label for weekly Monday", () => {
      const rec = interpretRecurrence({
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      });
      expect(labelFromRecurrence(rec)).toBe("Every Monday");
    });

    it("generates correct label for biweekly", () => {
      const rec = interpretRecurrence({
        day_of_week: "Friday",
        recurrence_rule: "biweekly",
      });
      expect(labelFromRecurrence(rec)).toBe("Every Other Friday");
    });

    it("generates correct label for monthly ordinal", () => {
      const rec = interpretRecurrence({
        day_of_week: "Tuesday",
        recurrence_rule: "2nd",
      });
      expect(labelFromRecurrence(rec)).toBe("2nd Tuesday of the Month");
    });

    it("generates correct label for one-time event", () => {
      const rec = interpretRecurrence({
        event_date: "2026-01-15",
      });
      expect(labelFromRecurrence(rec)).toBe("One-time");
    });
  });

  describe("Generator expansion fixes", () => {
    const todayKey = "2026-01-05"; // Sunday
    const endKey = addDaysDenver(todayKey, 90);

    it("CRITICAL: weekly event with event_date expands to MULTIPLE occurrences", () => {
      // This is THE bug we're fixing - previously this returned only 1 occurrence
      const occurrences = expandOccurrencesForEvent(
        {
          event_date: "2026-01-06", // Tuesday
          day_of_week: "Monday",
          recurrence_rule: "weekly",
        },
        { startKey: todayKey, endKey }
      );

      // Should have ~13 Monday occurrences in 90-day window, NOT 1
      expect(occurrences.length).toBeGreaterThan(1);
      expect(occurrences.length).toBeGreaterThanOrEqual(12);

      // All should be Mondays
      for (const occ of occurrences) {
        const date = new Date(`${occ.dateKey}T12:00:00Z`);
        expect(date.getUTCDay()).toBe(1); // Monday
      }
    });

    it("one-time event (no recurrence) still returns single occurrence", () => {
      const occurrences = expandOccurrencesForEvent(
        {
          event_date: "2026-01-15",
          // No day_of_week, no recurrence_rule
        },
        { startKey: todayKey, endKey }
      );

      expect(occurrences.length).toBe(1);
      expect(occurrences[0].dateKey).toBe("2026-01-15");
    });

    it("weekly event without event_date expands correctly", () => {
      const occurrences = expandOccurrencesForEvent(
        {
          day_of_week: "Wednesday",
          recurrence_rule: "weekly",
        },
        { startKey: todayKey, endKey }
      );

      expect(occurrences.length).toBeGreaterThan(10);
      for (const occ of occurrences) {
        const date = new Date(`${occ.dateKey}T12:00:00Z`);
        expect(date.getUTCDay()).toBe(3); // Wednesday
      }
    });

    it("biweekly expands every other week", () => {
      const occurrences = expandOccurrencesForEvent(
        {
          day_of_week: "Thursday",
          recurrence_rule: "biweekly",
        },
        { startKey: todayKey, endKey }
      );

      // Biweekly should have ~6-7 occurrences in 90 days
      expect(occurrences.length).toBeGreaterThanOrEqual(6);
      expect(occurrences.length).toBeLessThanOrEqual(8);

      // Check gap between consecutive occurrences is 14 days
      if (occurrences.length >= 2) {
        const first = new Date(`${occurrences[0].dateKey}T12:00:00Z`);
        const second = new Date(`${occurrences[1].dateKey}T12:00:00Z`);
        const daysBetween = (second.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
        expect(daysBetween).toBe(14);
      }
    });

    it("monthly ordinal expands correctly", () => {
      const occurrences = expandOccurrencesForEvent(
        {
          day_of_week: "Tuesday",
          recurrence_rule: "2nd",
        },
        { startKey: todayKey, endKey }
      );

      // Should have 3-4 occurrences in 90 days
      expect(occurrences.length).toBeGreaterThanOrEqual(3);
      expect(occurrences.length).toBeLessThanOrEqual(4);
    });

    it("multi-ordinal monthly expands correctly (1st/3rd)", () => {
      const occurrences = expandOccurrencesForEvent(
        {
          day_of_week: "Thursday",
          recurrence_rule: "1st/3rd",
        },
        { startKey: todayKey, endKey }
      );

      // Should have 6-8 occurrences in 90 days (2 per month)
      expect(occurrences.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("Label-generator consistency (THE KEY INVARIANT)", () => {
    it("label says 'Every Monday' AND generator produces Mondays", () => {
      const event = {
        event_date: "2026-01-06",
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      };

      const label = getRecurrenceSummary(
        event.recurrence_rule,
        event.day_of_week,
        event.event_date
      );

      const occurrences = expandOccurrencesForEvent(event, {
        startKey: "2026-01-05",
        endKey: "2026-04-05",
      });

      // Label must say "Every Monday"
      expect(label).toBe("Every Monday");

      // Generator must produce Mondays
      expect(occurrences.length).toBeGreaterThan(1);
      for (const occ of occurrences) {
        const date = new Date(`${occ.dateKey}T12:00:00Z`);
        expect(date.getUTCDay()).toBe(1); // Monday
      }
    });

    it("label says 'One-time' AND generator produces single occurrence", () => {
      const event = {
        event_date: "2026-02-15",
        // No day_of_week, no recurrence_rule = one-time
      };

      const label = getRecurrenceSummary(null, null, event.event_date);

      const occurrences = expandOccurrencesForEvent(event, {
        startKey: "2026-01-05",
        endKey: "2026-04-05",
      });

      expect(label).toBe("One-time");
      expect(occurrences.length).toBe(1);
    });

    it("label says '2nd Tuesday of the Month' AND generator produces 2nd Tuesdays", () => {
      const event = {
        day_of_week: "Tuesday",
        recurrence_rule: "2nd",
      };

      const label = getRecurrenceSummary(
        event.recurrence_rule,
        event.day_of_week,
        null
      );

      const occurrences = expandOccurrencesForEvent(event, {
        startKey: "2026-01-05",
        endKey: "2026-04-05",
      });

      expect(label).toBe("2nd Tuesday of the Month");
      expect(occurrences.length).toBeGreaterThan(1);

      // All should be Tuesdays
      for (const occ of occurrences) {
        const date = new Date(`${occ.dateKey}T12:00:00Z`);
        expect(date.getUTCDay()).toBe(2); // Tuesday
      }
    });
  });

  describe("shouldExpandToMultiple helper", () => {
    it("returns true for recurring events", () => {
      const rec = interpretRecurrence({
        day_of_week: "Monday",
        recurrence_rule: "weekly",
      });
      expect(shouldExpandToMultiple(rec)).toBe(true);
    });

    it("returns false for one-time events", () => {
      const rec = interpretRecurrence({
        event_date: "2026-01-15",
      });
      expect(shouldExpandToMultiple(rec)).toBe(false);
    });

    it("returns false for unknown schedules", () => {
      const rec = interpretRecurrence({});
      expect(shouldExpandToMultiple(rec)).toBe(false);
    });
  });

  describe("THE BROKEN TEST EVENT (real data)", () => {
    // This is the exact event that exposed the bug
    const brokenEvent = {
      id: "42d7e4c6-49e9-4169-830e-040d6a911c62",
      title: "TEST TIME SLOT EVENT",
      event_date: "2026-01-06", // Tuesday
      day_of_week: "Monday", // Mismatch!
      recurrence_rule: "weekly",
    };

    it("NOW expands to multiple Monday occurrences (not single Tuesday)", () => {
      const occurrences = expandOccurrencesForEvent(brokenEvent, {
        startKey: "2026-01-05",
        endKey: "2026-04-05",
      });

      // Should have ~13 occurrences, NOT 1
      expect(occurrences.length).toBeGreaterThan(10);

      // First occurrence should be Monday (day_of_week), not Tuesday (event_date)
      const firstDate = new Date(`${occurrences[0].dateKey}T12:00:00Z`);
      expect(firstDate.getUTCDay()).toBe(1); // Monday
    });

    it("label says 'Every Monday' (consistent with expansion)", () => {
      const label = getRecurrenceSummary(
        brokenEvent.recurrence_rule,
        brokenEvent.day_of_week,
        brokenEvent.event_date
      );

      expect(label).toBe("Every Monday");
    });
  });

  /**
   * Phase 4.86 Work Item D: "Today occurrence missing" proof
   *
   * These tests prove that when today matches a recurrence pattern,
   * today's occurrence appears in the expansion (not skipped or excluded).
   */
  describe("Today occurrence always appears in timeline", () => {
    it("weekly event: today IS included when today matches the day_of_week", () => {
      // 2026-01-05 is a Monday (verified via Date calculation)
      const todayKey = "2026-01-05"; // Monday
      const endKey = addDaysDenver(todayKey, 90);

      const occurrences = expandOccurrencesForEvent(
        {
          day_of_week: "Monday",
          recurrence_rule: "weekly",
        },
        { startKey: todayKey, endKey }
      );

      // First occurrence should be today (Monday)
      expect(occurrences.length).toBeGreaterThan(0);
      expect(occurrences[0].dateKey).toBe("2026-01-05");
    });

    it("monthly ordinal event: today IS included when today matches pattern", () => {
      // 2nd Tuesday of January 2026 is January 13 (verified via Date calculation)
      const todayKey = "2026-01-13"; // 2nd Tuesday
      const endKey = addDaysDenver(todayKey, 90);

      const occurrences = expandOccurrencesForEvent(
        {
          day_of_week: "Tuesday",
          recurrence_rule: "2nd",
        },
        { startKey: todayKey, endKey }
      );

      // First occurrence should be 2nd Tuesday of January (Jan 13)
      expect(occurrences.length).toBeGreaterThan(0);
      expect(occurrences[0].dateKey).toBe("2026-01-13");
    });

    it("one-time event: today IS included when event_date is today", () => {
      const todayKey = "2026-02-15";
      const endKey = addDaysDenver(todayKey, 90);

      const occurrences = expandOccurrencesForEvent(
        {
          event_date: "2026-02-15",
        },
        { startKey: todayKey, endKey }
      );

      expect(occurrences.length).toBe(1);
      expect(occurrences[0].dateKey).toBe("2026-02-15");
    });

    it("custom dates event: today IS included when today is in custom_dates", () => {
      const todayKey = "2026-03-10";
      const endKey = addDaysDenver(todayKey, 90);

      const occurrences = expandOccurrencesForEvent(
        {
          recurrence_rule: "custom",
          custom_dates: ["2026-03-10", "2026-03-20", "2026-04-05"],
        },
        { startKey: todayKey, endKey }
      );

      // Today (Mar 10) should be included as first occurrence
      expect(occurrences.length).toBe(3);
      expect(occurrences[0].dateKey).toBe("2026-03-10");
    });

    it("window starts exactly on occurrence date (boundary test)", () => {
      // 2026-01-07 is a Wednesday (verified via Date calculation)
      const todayKey = "2026-01-07"; // Wednesday
      const endKey = addDaysDenver(todayKey, 90);

      const occurrences = expandOccurrencesForEvent(
        {
          day_of_week: "Wednesday",
          recurrence_rule: "weekly",
        },
        { startKey: todayKey, endKey }
      );

      // First occurrence should be exactly today (Wednesday)
      expect(occurrences[0].dateKey).toBe("2026-01-07");
    });
  });
});
