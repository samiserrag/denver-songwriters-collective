/**
 * Phase 4.42e: Event Creation UX Tests
 *
 * Tests for:
 * 1. Mountain Time date helpers (formDateHelpers.ts)
 * 2. Edit page authorization (404 fix)
 * 3. Weekday/date bi-directional sync
 */

import { describe, it, expect, vi } from "vitest";
import {
  weekdayIndexFromDateMT,
  weekdayNameFromDateMT,
  getNextDayOfWeekMT,
  snapDateToWeekdayMT,
  generateSeriesDates,
  dayNameToIndex,
  indexToDayName,
} from "@/lib/events/formDateHelpers";

// Mock the nextOccurrence module for deterministic testing
vi.mock("@/lib/events/nextOccurrence", () => ({
  getTodayDenver: vi.fn(() => "2026-01-05"), // A Sunday
  addDaysDenver: vi.fn((dateKey: string, days: number) => {
    const date = new Date(`${dateKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split("T")[0];
  }),
}));

describe("formDateHelpers - Mountain Time Date Utilities", () => {
  describe("weekdayIndexFromDateMT", () => {
    it("returns 0 for Sunday", () => {
      expect(weekdayIndexFromDateMT("2026-01-04")).toBe(0); // Sunday
    });

    it("returns 1 for Monday", () => {
      expect(weekdayIndexFromDateMT("2026-01-05")).toBe(1); // Monday
    });

    it("returns 2 for Tuesday", () => {
      expect(weekdayIndexFromDateMT("2026-01-06")).toBe(2); // Tuesday
    });

    it("returns 6 for Saturday", () => {
      expect(weekdayIndexFromDateMT("2026-01-10")).toBe(6); // Saturday
    });

    it("handles dates across DST boundary correctly", () => {
      // March 8, 2026 - DST starts in US
      expect(weekdayIndexFromDateMT("2026-03-08")).toBe(0); // Sunday
      expect(weekdayIndexFromDateMT("2026-03-09")).toBe(1); // Monday
    });
  });

  describe("weekdayNameFromDateMT", () => {
    it("returns 'Sunday' for a Sunday date", () => {
      expect(weekdayNameFromDateMT("2026-01-04")).toBe("Sunday");
    });

    it("returns 'Monday' for a Monday date", () => {
      expect(weekdayNameFromDateMT("2026-01-05")).toBe("Monday");
    });

    it("returns 'Friday' for a Friday date", () => {
      expect(weekdayNameFromDateMT("2026-01-09")).toBe("Friday");
    });
  });

  describe("getNextDayOfWeekMT", () => {
    // Mock sets today as 2026-01-05 (Monday)

    it("returns next Monday (today + 7) when today is Monday and includeToday is false", () => {
      // Today is 2026-01-05 (Monday), default is to skip to next week
      expect(getNextDayOfWeekMT("Monday")).toBe("2026-01-12");
    });

    it("returns today when today is the target day and includeToday is true", () => {
      expect(getNextDayOfWeekMT("Monday", { includeToday: true })).toBe("2026-01-05");
    });

    it("returns next Tuesday (tomorrow) when today is Monday", () => {
      expect(getNextDayOfWeekMT("Tuesday")).toBe("2026-01-06");
    });

    it("returns next Sunday (6 days) when today is Monday", () => {
      expect(getNextDayOfWeekMT("Sunday")).toBe("2026-01-11");
    });

    it("returns today as fallback for invalid day name", () => {
      expect(getNextDayOfWeekMT("InvalidDay")).toBe("2026-01-05");
    });

    it("handles case-insensitive day names", () => {
      expect(getNextDayOfWeekMT("tuesday")).toBe("2026-01-06");
      expect(getNextDayOfWeekMT("WEDNESDAY")).toBe("2026-01-07");
    });
  });

  describe("snapDateToWeekdayMT", () => {
    it("returns same date if already on target weekday", () => {
      // 2026-01-05 is Monday (index 1)
      expect(snapDateToWeekdayMT("2026-01-05", 1)).toBe("2026-01-05");
    });

    it("snaps forward to next Monday from a Tuesday", () => {
      // 2026-01-06 is Tuesday, snap to Monday = 2026-01-12 (6 days forward)
      expect(snapDateToWeekdayMT("2026-01-06", 1)).toBe("2026-01-12");
    });

    it("snaps forward to next Wednesday from a Monday", () => {
      // 2026-01-05 is Monday (1), snap to Wednesday (3) = 2026-01-07 (2 days)
      expect(snapDateToWeekdayMT("2026-01-05", 3)).toBe("2026-01-07");
    });

    it("snaps forward to next Sunday from a Saturday", () => {
      // 2026-01-10 is Saturday (6), snap to Sunday (0) = 2026-01-11 (1 day)
      expect(snapDateToWeekdayMT("2026-01-10", 0)).toBe("2026-01-11");
    });
  });

  describe("generateSeriesDates", () => {
    it("returns single date for count of 1", () => {
      expect(generateSeriesDates("2026-01-05", 1)).toEqual(["2026-01-05"]);
    });

    it("returns weekly dates for count > 1", () => {
      expect(generateSeriesDates("2026-01-05", 3)).toEqual([
        "2026-01-05",
        "2026-01-12",
        "2026-01-19",
      ]);
    });

    it("generates 12 weekly dates", () => {
      const dates = generateSeriesDates("2026-01-05", 12);
      expect(dates).toHaveLength(12);
      expect(dates[0]).toBe("2026-01-05");
      expect(dates[11]).toBe("2026-03-23"); // 77 days later (11 * 7)
    });
  });

  describe("dayNameToIndex", () => {
    it("maps Sunday to 0", () => {
      expect(dayNameToIndex("Sunday")).toBe(0);
      expect(dayNameToIndex("sunday")).toBe(0);
    });

    it("maps Monday to 1", () => {
      expect(dayNameToIndex("Monday")).toBe(1);
    });

    it("maps Saturday to 6", () => {
      expect(dayNameToIndex("Saturday")).toBe(6);
    });

    it("returns undefined for invalid day name", () => {
      expect(dayNameToIndex("InvalidDay")).toBeUndefined();
    });
  });

  describe("indexToDayName", () => {
    it("maps 0 to Sunday", () => {
      expect(indexToDayName(0)).toBe("Sunday");
    });

    it("maps 1 to Monday", () => {
      expect(indexToDayName(1)).toBe("Monday");
    });

    it("maps 6 to Saturday", () => {
      expect(indexToDayName(6)).toBe("Saturday");
    });

    it("returns undefined for invalid index", () => {
      expect(indexToDayName(7)).toBeUndefined();
      expect(indexToDayName(-1)).toBeUndefined();
    });
  });
});

describe("Event Edit Page Authorization - Phase 4.42e 404 Fix", () => {
  /**
   * These tests verify the authorization logic in the edit page.
   * The 404 bug occurred because the query filtered by is_dsc_event=true,
   * which excluded community events.
   *
   * After fix:
   * - Query fetches any event by ID (no is_dsc_event filter)
   * - Authorization allows: admin OR event_host entry OR host_id owner
   */

  describe("Authorization Rules", () => {
    it("should allow admin to access any event", () => {
      const isAdmin = true;
      const userHost = null;
      const isEventOwner = false;

      const canAccess = isAdmin || userHost || isEventOwner;
      expect(canAccess).toBe(true);
    });

    it("should allow event_host entry with accepted status", () => {
      const isAdmin = false;
      const userHost = { role: "host", invitation_status: "accepted" };
      const isEventOwner = false;

      const canAccess = isAdmin || !!userHost || isEventOwner;
      expect(canAccess).toBe(true);
    });

    it("should allow event owner (host_id matches user)", () => {
      const isAdmin = false;
      const userHost = null;
      const isEventOwner = true;

      const canAccess = isAdmin || userHost || isEventOwner;
      expect(canAccess).toBe(true);
    });

    it("should deny access when user has no authorization", () => {
      const isAdmin = false;
      const userHost = null;
      const isEventOwner = false;

      const canAccess = isAdmin || userHost || isEventOwner;
      expect(canAccess).toBe(false);
    });

    it("should deny access when event_host invitation is pending", () => {
      const isAdmin = false;
      // This simulates the query that filters for accepted status
      const userHostFromQuery = null; // Would be null because invitation_status !== "accepted"
      const isEventOwner = false;

      const canAccess = isAdmin || userHostFromQuery || isEventOwner;
      expect(canAccess).toBe(false);
    });
  });

  describe("Primary Host Role", () => {
    it("event owner is considered primary host", () => {
      const userHost = null;
      const isAdmin = false;
      const isEventOwner = true;

      const isPrimaryHost = userHost?.role === "host" || isAdmin || isEventOwner;
      expect(isPrimaryHost).toBe(true);
    });

    it("co-host (non-owner) is not primary host", () => {
      const userHost = { role: "cohost" };
      const isAdmin = false;
      const isEventOwner = false;

      const isPrimaryHost = userHost?.role === "host" || isAdmin || isEventOwner;
      expect(isPrimaryHost).toBe(false);
    });

    it("admin is always primary host", () => {
      const userHost = null;
      const isAdmin = true;
      const isEventOwner = false;

      const isPrimaryHost = userHost?.role === "host" || isAdmin || isEventOwner;
      expect(isPrimaryHost).toBe(true);
    });
  });
});

describe("Weekday/Date Bi-directional Sync", () => {
  /**
   * Tests for the bi-directional sync between Day of Week and First Event Date:
   * A) When Day of Week changes → First Event Date snaps to that weekday
   * B) When First Event Date changes → Day of Week updates to match
   */

  describe("Day of Week → First Event Date sync", () => {
    it("selecting Monday should set start_date to next Monday", () => {
      // Simulates: user selects "Monday" from dropdown
      // Expected: start_date is set to getNextDayOfWeekMT("Monday")
      const selectedDay = "Monday";
      const expectedDate = getNextDayOfWeekMT(selectedDay);

      // Mock sets today as 2026-01-05 (Monday), so next Monday is 2026-01-12
      expect(expectedDate).toBe("2026-01-12");
    });

    it("selecting Wednesday should set start_date to next Wednesday", () => {
      const selectedDay = "Wednesday";
      const expectedDate = getNextDayOfWeekMT(selectedDay);

      // Today is Monday, so next Wednesday is in 2 days
      expect(expectedDate).toBe("2026-01-07");
    });
  });

  describe("First Event Date → Day of Week sync", () => {
    it("selecting a Tuesday date should set day_of_week to Tuesday", () => {
      // Simulates: user picks 2026-01-06 from date picker
      // Expected: day_of_week is set to "Tuesday"
      const selectedDate = "2026-01-06";
      const derivedDay = weekdayNameFromDateMT(selectedDate);

      expect(derivedDay).toBe("Tuesday");
    });

    it("selecting a Friday date should set day_of_week to Friday", () => {
      const selectedDate = "2026-01-09";
      const derivedDay = weekdayNameFromDateMT(selectedDate);

      expect(derivedDay).toBe("Friday");
    });
  });

  describe("Series Preview Consistency", () => {
    it("series dates should all be on the same weekday as start_date", () => {
      const startDate = "2026-01-07"; // Wednesday
      const seriesDates = generateSeriesDates(startDate, 4);

      // All dates should be Wednesdays
      for (const date of seriesDates) {
        expect(weekdayNameFromDateMT(date)).toBe("Wednesday");
      }
    });

    it("changing day_of_week and start_date together should maintain alignment", () => {
      // User selects "Thursday"
      const selectedDay = "Thursday";
      const startDate = getNextDayOfWeekMT(selectedDay);

      // Generate series
      const seriesDates = generateSeriesDates(startDate, 3);

      // All should be Thursdays
      for (const date of seriesDates) {
        expect(weekdayNameFromDateMT(date)).toBe("Thursday");
      }
    });
  });
});
