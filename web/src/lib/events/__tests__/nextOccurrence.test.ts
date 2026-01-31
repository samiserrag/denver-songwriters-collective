/**
 * Phase 4.17: Tests for next occurrence computation
 *
 * All date keys must be in America/Denver timezone.
 * These tests verify no UTC/local timezone leakage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeNextOccurrence,
  formatDateGroupHeader,
  groupEventsByNextOccurrence,
  getTodayDenver,
  denverDateKeyFromDate,
  addDaysDenver,
} from "../nextOccurrence";

// Mock date for consistent tests
const mockDate = (dateStr: string) => {
  const date = new Date(dateStr + "T12:00:00-07:00"); // Denver time
  vi.setSystemTime(date);
};

describe("nextOccurrence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getTodayDenver", () => {
    it("returns today's date in Denver timezone", () => {
      mockDate("2025-01-15");
      const today = getTodayDenver();
      expect(today).toBe("2025-01-15");
    });
  });

  describe("computeNextOccurrence", () => {
    describe("one-time events (event_date)", () => {
      it("returns the event_date for one-time events", () => {
        mockDate("2025-01-15");
        const event = { event_date: "2025-01-20" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-20");
        expect(result.isToday).toBe(false);
        expect(result.isTomorrow).toBe(false);
        expect(result.isConfident).toBe(true);
      });

      it("identifies today correctly", () => {
        mockDate("2025-01-15");
        const event = { event_date: "2025-01-15" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-15");
        expect(result.isToday).toBe(true);
        expect(result.isTomorrow).toBe(false);
      });

      it("identifies tomorrow correctly", () => {
        mockDate("2025-01-15");
        const event = { event_date: "2025-01-16" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-16");
        expect(result.isToday).toBe(false);
        expect(result.isTomorrow).toBe(true);
      });

      it("handles past one-time events", () => {
        mockDate("2025-01-15");
        const event = { event_date: "2025-01-10" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-10");
        expect(result.isConfident).toBe(true);
      });
    });

    describe("weekly recurring events (day_of_week)", () => {
      it("returns next occurrence of the target day", () => {
        // Wednesday, Jan 15, 2025
        mockDate("2025-01-15");
        const event = { day_of_week: "Friday" };
        const result = computeNextOccurrence(event);

        // Next Friday is Jan 17
        expect(result.date).toBe("2025-01-17");
        expect(result.isConfident).toBe(true);
      });

      it("returns today if event is on today's day", () => {
        // Wednesday, Jan 15, 2025
        mockDate("2025-01-15");
        const event = { day_of_week: "Wednesday" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-15");
        expect(result.isToday).toBe(true);
      });

      it("handles case-insensitive day names", () => {
        mockDate("2025-01-15");
        const event = { day_of_week: "MONDAY" };
        const result = computeNextOccurrence(event);

        // Next Monday is Jan 20
        expect(result.date).toBe("2025-01-20");
      });

      it("handles lowercase day names", () => {
        mockDate("2025-01-15");
        const event = { day_of_week: "thursday" };
        const result = computeNextOccurrence(event);

        // Next Thursday is Jan 16
        expect(result.date).toBe("2025-01-16");
      });

      /**
       * Phase 4.105.1: Recurring events with past anchor dates
       *
       * CRITICAL BUG FIX: Previously, computeNextOccurrence() would return
       * event_date (anchor date) immediately for ANY event with event_date,
       * even if the event was recurring. This caused bugs where:
       *
       * - Event: Weekly Thursday recurring, anchor date = 2025-01-09 (past Thursday)
       * - Today: 2025-01-31 (Friday)
       * - Expected: 2025-02-06 (next Thursday)
       * - Actual (bug): 2025-01-09 (past anchor date)
       *
       * The fix uses interpretRecurrence() to check if event is recurring
       * before returning event_date.
       */
      it("returns next future occurrence for recurring events with past anchor dates", () => {
        // Friday, Jan 31, 2025
        mockDate("2025-01-31");
        const event = {
          event_date: "2025-01-09", // Past Thursday (anchor date)
          day_of_week: "Thursday",
          recurrence_rule: "weekly",
        };
        const result = computeNextOccurrence(event);

        // Should return next Thursday (Feb 6), NOT the past anchor date
        expect(result.date).toBe("2025-02-06");
        expect(result.isConfident).toBe(true);
      });

      it("returns anchor date for one-time events (no day_of_week)", () => {
        // Friday, Jan 31, 2025
        mockDate("2025-01-31");
        const event = {
          event_date: "2025-01-09", // Past date (one-time event)
          // No day_of_week, no recurrence_rule = one-time event
        };
        const result = computeNextOccurrence(event);

        // One-time event returns event_date even if in past
        expect(result.date).toBe("2025-01-09");
        expect(result.isConfident).toBe(true);
      });
    });

    describe("nth weekday of month (RRULE)", () => {
      it("computes 2nd Tuesday of month correctly", () => {
        // Jan 15, 2025 - 2nd Tuesday is Jan 14 (past), so next is Feb 11
        mockDate("2025-01-15");
        const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=2TU" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-02-11");
        expect(result.isConfident).toBe(true);
      });

      it("returns today if it is the nth weekday", () => {
        // Jan 14, 2025 is the 2nd Tuesday
        mockDate("2025-01-14");
        const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=2TU" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-14");
        expect(result.isToday).toBe(true);
      });

      it("does not falsely show TONIGHT on wrong week", () => {
        // Jan 7, 2025 is the 1st Tuesday, not the 2nd
        mockDate("2025-01-07");
        const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=2TU" };
        const result = computeNextOccurrence(event);

        // Should show Jan 14 (2nd Tuesday), NOT today
        expect(result.date).toBe("2025-01-14");
        expect(result.isToday).toBe(false);
      });

      it("handles 1st weekday correctly", () => {
        // Jan 15, 2025 - 1st Wednesday is Jan 1 (past), next is Feb 5
        mockDate("2025-01-15");
        const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=1WE" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-02-05");
      });

      it("handles 3rd weekday correctly", () => {
        // Jan 15, 2025 - 3rd Thursday is Jan 16
        mockDate("2025-01-15");
        const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=3TH" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-16");
      });

      it("handles last weekday (-1) correctly", () => {
        // Jan 15, 2025 - last Friday of Jan is Jan 31
        mockDate("2025-01-15");
        const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=-1FR" };
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-31");
      });
    });

    describe("fallback behavior", () => {
      it("falls back to today with low confidence for empty event", () => {
        mockDate("2025-01-15");
        const event = {};
        const result = computeNextOccurrence(event);

        expect(result.date).toBe("2025-01-15");
        expect(result.isConfident).toBe(false);
      });
    });
  });

  describe("formatDateGroupHeader", () => {
    it("returns 'Today' for today's date", () => {
      const result = formatDateGroupHeader("2025-01-15", "2025-01-15");
      expect(result).toBe("Today");
    });

    it("returns 'Tomorrow' for tomorrow's date", () => {
      const result = formatDateGroupHeader("2025-01-16", "2025-01-15");
      expect(result).toBe("Tomorrow");
    });

    it("returns formatted date for other days", () => {
      const result = formatDateGroupHeader("2025-01-20", "2025-01-15");
      // Should be like "Mon, Jan 20"
      expect(result).toMatch(/Mon.*Jan.*20/);
    });
  });

  describe("groupEventsByNextOccurrence", () => {
    it("groups events by their next occurrence date", () => {
      mockDate("2025-01-15");
      const events = [
        { id: "1", event_date: "2025-01-15" },
        { id: "2", event_date: "2025-01-17" },
        { id: "3", event_date: "2025-01-15" },
        { id: "4", day_of_week: "Friday" }, // Jan 17
      ];

      const groups = groupEventsByNextOccurrence(events);

      expect(groups.size).toBe(2);
      expect(groups.get("2025-01-15")?.length).toBe(2);
      expect(groups.get("2025-01-17")?.length).toBe(2);
    });

    it("returns groups sorted by date (Today first)", () => {
      mockDate("2025-01-15");
      const events = [
        { id: "1", event_date: "2025-01-20" },
        { id: "2", event_date: "2025-01-15" },
        { id: "3", event_date: "2025-01-17" },
      ];

      const groups = groupEventsByNextOccurrence(events);
      const keys = [...groups.keys()];

      expect(keys[0]).toBe("2025-01-15"); // Today first
      expect(keys[1]).toBe("2025-01-17");
      expect(keys[2]).toBe("2025-01-20");
    });

    it("places nth-weekday events under correct date", () => {
      // Jan 14, 2025 is the 2nd Tuesday
      mockDate("2025-01-10");
      const events = [
        { id: "1", recurrence_rule: "FREQ=MONTHLY;BYDAY=2TU" },
      ];

      const groups = groupEventsByNextOccurrence(events);
      const keys = [...groups.keys()];

      expect(keys[0]).toBe("2025-01-14");
    });
  });

  describe("Denver timezone helpers", () => {
    it("denverDateKeyFromDate produces YYYY-MM-DD in Denver timezone", () => {
      // 11pm Denver time on Jan 15 = 6am UTC on Jan 16
      const lateNightDenver = new Date("2025-01-16T06:00:00Z");
      const dateKey = denverDateKeyFromDate(lateNightDenver);
      // Should be Jan 15 in Denver, not Jan 16
      expect(dateKey).toBe("2025-01-15");
    });

    it("addDaysDenver correctly steps calendar days", () => {
      const todayKey = "2025-01-15";
      expect(addDaysDenver(todayKey, 1)).toBe("2025-01-16");
      expect(addDaysDenver(todayKey, 7)).toBe("2025-01-22");
      expect(addDaysDenver(todayKey, -1)).toBe("2025-01-14");
    });

    it("addDaysDenver handles month boundaries", () => {
      expect(addDaysDenver("2025-01-31", 1)).toBe("2025-02-01");
      expect(addDaysDenver("2025-02-01", -1)).toBe("2025-01-31");
    });

    it("addDaysDenver handles year boundaries", () => {
      expect(addDaysDenver("2025-12-31", 1)).toBe("2026-01-01");
      expect(addDaysDenver("2026-01-01", -1)).toBe("2025-12-31");
    });
  });

  describe("Phase 4.17.2 timezone bug fixes", () => {
    it("no duplicate Tomorrow + Thursday headers for the same Denver day", () => {
      // If tomorrow is Thursday (Jan 16), there should only be one group key
      mockDate("2025-01-15"); // Wednesday
      const events = [
        { id: "1", event_date: "2025-01-16" }, // Thursday
        { id: "2", day_of_week: "Thursday" },   // Also next Thursday (Jan 16)
      ];

      const groups = groupEventsByNextOccurrence(events);
      const keys = [...groups.keys()];

      // Both events should be in the same group
      expect(keys.length).toBe(1);
      expect(keys[0]).toBe("2025-01-16");
      expect(groups.get("2025-01-16")?.length).toBe(2);
    });

    it("Friday event in Denver never buckets under Thursday", () => {
      mockDate("2025-01-15"); // Wednesday
      const fridayEvent = { id: "1", event_date: "2025-01-17" }; // Friday

      const result = computeNextOccurrence(fridayEvent);
      expect(result.date).toBe("2025-01-17");

      // Also verify grouping
      const groups = groupEventsByNextOccurrence([{ ...fridayEvent }]);
      expect(groups.has("2025-01-17")).toBe(true);
      expect(groups.has("2025-01-16")).toBe(false); // NOT Thursday
    });

    it("Tomorrow label corresponds to addDaysDenver(todayKey, 1)", () => {
      mockDate("2025-01-15");
      const todayKey = getTodayDenver();
      const tomorrowKey = addDaysDenver(todayKey, 1);

      // formatDateGroupHeader should return "Tomorrow" for tomorrowKey
      expect(formatDateGroupHeader(tomorrowKey, todayKey)).toBe("Tomorrow");

      // And an event on that date should have isTomorrow = true
      const tomorrowEvent = { event_date: tomorrowKey };
      const result = computeNextOccurrence(tomorrowEvent);
      expect(result.isTomorrow).toBe(true);
    });

    it("weekly recurring event computes correct Denver date key", () => {
      // Wednesday, Jan 15, 2025
      mockDate("2025-01-15");
      const event = { day_of_week: "Friday" };
      const result = computeNextOccurrence(event);

      // Next Friday is Jan 17 - verify it's exactly that date key
      expect(result.date).toBe("2025-01-17");

      // Verify it matches what addDaysDenver would produce
      const expectedFriday = addDaysDenver("2025-01-15", 2); // Wed + 2 = Fri
      expect(result.date).toBe(expectedFriday);
    });
  });

  describe("Phase 4.17.3 - 5th weekday must not match 1st-4th ordinal", () => {
    /**
     * January 2025 Wednesdays:
     * - 1st Wednesday: Jan 1
     * - 2nd Wednesday: Jan 8
     * - 3rd Wednesday: Jan 15
     * - 4th Wednesday: Jan 22
     * - 5th Wednesday: Jan 29 (this should NOT match any 1WE, 2WE, 3WE, 4WE)
     *
     * February 2025 Wednesdays:
     * - 1st Wednesday: Feb 5
     * - 2nd Wednesday: Feb 12
     * - 3rd Wednesday: Feb 19
     * - 4th Wednesday: Feb 26
     */

    it("on 5th Wednesday (Jan 29), 1WE event should show Feb 5 (next 1st Wed)", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=1WE" };
      const result = computeNextOccurrence(event);

      // Should NOT be today (Jan 29 is 5th Wed, not 1st)
      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-05"); // Next 1st Wednesday
    });

    it("on 5th Wednesday (Jan 29), 2WE event should show Feb 12 (next 2nd Wed)", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=2WE" };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-12"); // Next 2nd Wednesday
    });

    it("on 5th Wednesday (Jan 29), 3WE event should show Feb 19 (next 3rd Wed)", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=3WE" };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-19"); // Next 3rd Wednesday
    });

    it("on 5th Wednesday (Jan 29), 4WE event should show Feb 26 (next 4th Wed)", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=4WE" };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-26"); // Next 4th Wednesday
    });

    it("grouping places 5th Wednesday events under future correct ordinal date", () => {
      mockDate("2025-01-29"); // 5th Wednesday
      const events = [
        { id: "1", recurrence_rule: "FREQ=MONTHLY;BYDAY=1WE" },
        { id: "2", recurrence_rule: "FREQ=MONTHLY;BYDAY=2WE" },
        { id: "3", recurrence_rule: "FREQ=MONTHLY;BYDAY=3WE" },
        { id: "4", recurrence_rule: "FREQ=MONTHLY;BYDAY=4WE" },
      ];

      const groups = groupEventsByNextOccurrence(events);

      // None should be grouped under today (2025-01-29)
      expect(groups.has("2025-01-29")).toBe(false);

      // Each should be under its correct February date
      expect(groups.has("2025-02-05")).toBe(true);  // 1WE
      expect(groups.has("2025-02-12")).toBe(true);  // 2WE
      expect(groups.has("2025-02-19")).toBe(true);  // 3WE
      expect(groups.has("2025-02-26")).toBe(true);  // 4WE
    });

    it("on the true 3rd Wednesday (Jan 15), 3WE event should show today", () => {
      mockDate("2025-01-15"); // 3rd Wednesday of Jan
      const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=3WE" };
      const result = computeNextOccurrence(event);

      expect(result.date).toBe("2025-01-15");
      expect(result.isToday).toBe(true);
    });

    it("on 4th Wednesday (Jan 22), 3WE event should show Feb 19 (past this month)", () => {
      mockDate("2025-01-22"); // 4th Wednesday of Jan
      const event = { recurrence_rule: "FREQ=MONTHLY;BYDAY=3WE" };
      const result = computeNextOccurrence(event);

      // Jan 15 (3rd Wed) is past, so next is Feb 19
      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-19");
    });
  });

  describe("Phase 4.17.4 - Legacy ordinal format (recurrence_rule='1st' + day_of_week)", () => {
    /**
     * This tests the actual database schema where:
     * - recurrence_rule = "1st", "2nd", "3rd", "4th", "last"
     * - day_of_week = "Wednesday", "Tuesday", etc.
     *
     * Examples:
     * - Two Moons: recurrence_rule="1st", day_of_week="Wednesday"
     * - Scully's Cafe: recurrence_rule="2nd", day_of_week="Wednesday"
     */

    it("1st Wednesday event (legacy format) should NOT show on 5th Wednesday", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = {
        recurrence_rule: "1st",
        day_of_week: "Wednesday",
      };
      const result = computeNextOccurrence(event);

      // Should NOT be today (Jan 29 is 5th Wed, not 1st)
      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-05"); // Next 1st Wednesday
    });

    it("2nd Wednesday event (legacy format) should NOT show on 5th Wednesday", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = {
        recurrence_rule: "2nd",
        day_of_week: "Wednesday",
      };
      const result = computeNextOccurrence(event);

      // Should NOT be today
      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-12"); // Next 2nd Wednesday
    });

    it("3rd Wednesday event (legacy format) should NOT show on 5th Wednesday", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = {
        recurrence_rule: "3rd",
        day_of_week: "Wednesday",
      };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-19"); // Next 3rd Wednesday
    });

    it("4th Wednesday event (legacy format) should NOT show on 5th Wednesday", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = {
        recurrence_rule: "4th",
        day_of_week: "Wednesday",
      };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-26"); // Next 4th Wednesday
    });

    it("last Wednesday event (legacy format) should show on 5th Wednesday if it's the last", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan, also the last
      const event = {
        recurrence_rule: "last",
        day_of_week: "Wednesday",
      };
      const result = computeNextOccurrence(event);

      // Jan 29 IS the last Wednesday of Jan
      expect(result.isToday).toBe(true);
      expect(result.date).toBe("2025-01-29");
    });

    it("1st Tuesday event (legacy format) should show on actual 1st Tuesday", () => {
      mockDate("2025-01-07"); // 1st Tuesday of Jan
      const event = {
        recurrence_rule: "1st",
        day_of_week: "Tuesday",
      };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(true);
      expect(result.date).toBe("2025-01-07");
    });

    it("2nd Tuesday event (legacy format) should NOT show on 1st Tuesday", () => {
      mockDate("2025-01-07"); // 1st Tuesday of Jan
      const event = {
        recurrence_rule: "2nd",
        day_of_week: "Tuesday",
      };
      const result = computeNextOccurrence(event);

      // 2nd Tuesday is Jan 14
      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-01-14");
    });

    it("legacy format handles mixed case", () => {
      mockDate("2025-01-29"); // 5th Wednesday
      const event = {
        recurrence_rule: "1ST",
        day_of_week: "WEDNESDAY",
      };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-05");
    });

    it("legacy format handles whitespace", () => {
      mockDate("2025-01-29"); // 5th Wednesday
      const event = {
        recurrence_rule: " 2nd ",
        day_of_week: " Wednesday ",
      };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-02-12");
    });

    it("grouping with legacy format separates ordinals correctly", () => {
      mockDate("2025-01-29"); // 5th Wednesday
      const events = [
        { id: "two-moons", recurrence_rule: "1st", day_of_week: "Wednesday" },
        { id: "scullys", recurrence_rule: "2nd", day_of_week: "Wednesday" },
        { id: "third-wed", recurrence_rule: "3rd", day_of_week: "Wednesday" },
        { id: "fourth-wed", recurrence_rule: "4th", day_of_week: "Wednesday" },
      ];

      const groups = groupEventsByNextOccurrence(events);

      // None should be grouped under today (5th Wednesday)
      expect(groups.has("2025-01-29")).toBe(false);

      // Each should be under its correct February date
      expect(groups.get("2025-02-05")).toContainEqual(expect.objectContaining({ id: "two-moons" }));
      expect(groups.get("2025-02-12")).toContainEqual(expect.objectContaining({ id: "scullys" }));
      expect(groups.get("2025-02-19")).toContainEqual(expect.objectContaining({ id: "third-wed" }));
      expect(groups.get("2025-02-26")).toContainEqual(expect.objectContaining({ id: "fourth-wed" }));
    });

    it("non-ordinal recurrence_rule falls back to weekly", () => {
      // Events with recurrence_rule like "weekly" or "none" should use day_of_week as weekly
      mockDate("2025-01-15"); // Wednesday
      const event = {
        recurrence_rule: "weekly",
        day_of_week: "Wednesday",
      };
      const result = computeNextOccurrence(event);

      // Should treat as weekly Wednesday = today
      expect(result.isToday).toBe(true);
      expect(result.date).toBe("2025-01-15");
    });
  });

  describe("Phase 4.17.5 - Canonical todayKey option", () => {
    it("uses provided todayKey instead of computing fresh", () => {
      // Set real time to Jan 15
      mockDate("2025-01-15");

      // But pass todayKey as Jan 20
      const event = { day_of_week: "Friday" };
      const result = computeNextOccurrence(event, { todayKey: "2025-01-20" });

      // Next Friday from Jan 20 (Monday) is Jan 24, not Jan 17
      expect(result.date).toBe("2025-01-24");
      expect(result.isToday).toBe(false);
    });

    it("marks isToday correctly relative to provided todayKey", () => {
      mockDate("2025-01-15");

      // Pass todayKey as a Friday
      const event = { day_of_week: "Friday" };
      const result = computeNextOccurrence(event, { todayKey: "2025-01-17" });

      // Friday Jan 17 is "today" relative to the provided key
      expect(result.date).toBe("2025-01-17");
      expect(result.isToday).toBe(true);
    });

    it("marks isTomorrow correctly relative to provided todayKey", () => {
      mockDate("2025-01-15");

      // Pass todayKey as Thursday Jan 16
      const event = { day_of_week: "Friday" };
      const result = computeNextOccurrence(event, { todayKey: "2025-01-16" });

      // Friday Jan 17 is "tomorrow" relative to Thursday Jan 16
      expect(result.date).toBe("2025-01-17");
      expect(result.isTomorrow).toBe(true);
    });

    it("groupEventsByNextOccurrence uses provided todayKey", () => {
      mockDate("2025-01-15"); // Wednesday

      const events = [
        { id: "1", day_of_week: "Friday" },
        { id: "2", day_of_week: "Monday" },
      ];

      // Group with a different todayKey (Monday Jan 20)
      const groups = groupEventsByNextOccurrence(events, { todayKey: "2025-01-20" });
      const keys = [...groups.keys()];

      // From Monday Jan 20: Friday = Jan 24, Monday = Jan 20 (today)
      expect(keys).toContain("2025-01-20"); // Monday
      expect(keys).toContain("2025-01-24"); // Friday
      expect(keys).not.toContain("2025-01-17"); // Would be next Friday from Jan 15
    });
  });

  describe("Invariant: occurrence.date === group key", () => {
    it("every grouped event has occurrence.date matching its group key", () => {
      mockDate("2025-01-15");
      const todayKey = "2025-01-15";

      const events = [
        { id: "1", event_date: "2025-01-15" },
        { id: "2", event_date: "2025-01-17" },
        { id: "3", day_of_week: "Friday" }, // Jan 17
        { id: "4", recurrence_rule: "FREQ=MONTHLY;BYDAY=3WE" }, // Jan 15
        { id: "5", recurrence_rule: "2nd", day_of_week: "Tuesday" }, // Jan 14 (past) -> Feb 11
      ];

      const groups = groupEventsByNextOccurrence(events, { todayKey });

      for (const [groupKey, groupEvents] of groups) {
        for (const event of groupEvents) {
          // Re-compute occurrence with same todayKey to verify
          const occurrence = computeNextOccurrence(event, { todayKey });
          expect(occurrence.date).toBe(groupKey);
        }
      }
    });

    it("5th Wednesday events do not appear in 1st-4th Wednesday groups", () => {
      mockDate("2025-01-29"); // 5th Wednesday
      const todayKey = "2025-01-29";

      const events = [
        { id: "1st-wed", recurrence_rule: "1st", day_of_week: "Wednesday" },
        { id: "2nd-wed", recurrence_rule: "2nd", day_of_week: "Wednesday" },
        { id: "3rd-wed", recurrence_rule: "3rd", day_of_week: "Wednesday" },
        { id: "4th-wed", recurrence_rule: "4th", day_of_week: "Wednesday" },
      ];

      const groups = groupEventsByNextOccurrence(events, { todayKey });

      // None of these should be grouped under today (Jan 29)
      expect(groups.has("2025-01-29")).toBe(false);

      // Each should be in their respective February dates
      expect(groups.get("2025-02-05")?.some(e => e.id === "1st-wed")).toBe(true);
      expect(groups.get("2025-02-12")?.some(e => e.id === "2nd-wed")).toBe(true);
      expect(groups.get("2025-02-19")?.some(e => e.id === "3rd-wed")).toBe(true);
      expect(groups.get("2025-02-26")?.some(e => e.id === "4th-wed")).toBe(true);
    });
  });

  describe("Phase 4.17.6 Investigation - Weekly events in forward horizon", () => {
    /**
     * These tests verify that weekly events appear correctly in all future
     * weeks, not just Today/Tomorrow. This confirms the occurrence computation
     * is correct and any display issues are data problems, not logic bugs.
     */

    it("weekly Wednesday event on Today (Wed) should show today", () => {
      mockDate("2025-01-15"); // Wednesday
      const event = { day_of_week: "Wednesday", recurrence_rule: "weekly" };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(true);
      expect(result.date).toBe("2025-01-15");
    });

    it("weekly Wednesday event on Thursday should show next Wed (6 days)", () => {
      mockDate("2025-01-16"); // Thursday
      const event = { day_of_week: "Wednesday", recurrence_rule: "weekly" };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(false);
      expect(result.date).toBe("2025-01-22"); // Next Wednesday
    });

    it("weekly Wednesday event on 5th Wednesday should show 5th Wednesday (today)", () => {
      mockDate("2025-01-29"); // 5th Wednesday of Jan
      const event = { day_of_week: "Wednesday", recurrence_rule: "weekly" };
      const result = computeNextOccurrence(event);

      // This is the key test: weekly events SHOULD appear on 5th Wed
      expect(result.isToday).toBe(true);
      expect(result.date).toBe("2025-01-29");
    });

    it("weekly Wednesday with NULL recurrence_rule still computes correctly", () => {
      mockDate("2025-01-15"); // Wednesday
      // This matches Velvet Banjo's data: day_of_week=Wednesday, recurrence_rule=NULL
      const event = { day_of_week: "Wednesday", recurrence_rule: null };
      const result = computeNextOccurrence(event);

      expect(result.isToday).toBe(true);
      expect(result.date).toBe("2025-01-15");
    });

    it("event with NULL day_of_week and NULL recurrence_rule falls back to today", () => {
      mockDate("2025-01-15");
      // This matches Hooked on Colfax's data: both NULL
      const event = { day_of_week: null, recurrence_rule: null };
      const result = computeNextOccurrence(event);

      // Falls back to today but NOT confident
      expect(result.isToday).toBe(true);
      expect(result.date).toBe("2025-01-15");
      expect(result.isConfident).toBe(false);
    });

    it("event with recurrence_rule='none' and NULL day_of_week falls back to today", () => {
      mockDate("2025-01-15");
      // This matches Joe Willy's data: recurrence_rule="none", day_of_week=NULL
      const event = { day_of_week: null, recurrence_rule: "none" };
      const result = computeNextOccurrence(event);

      // "none" is not a recognized ordinal, so falls through to Case 3/fallback
      expect(result.date).toBe("2025-01-15");
      expect(result.isConfident).toBe(false);
    });

    it("grouping correctly separates weekly vs monthly ordinal events", () => {
      mockDate("2025-01-29"); // 5th Wednesday
      const events = [
        { id: "weekly-wed", day_of_week: "Wednesday", recurrence_rule: "weekly" },
        { id: "1st-wed", day_of_week: "Wednesday", recurrence_rule: "1st" },
        { id: "2nd-wed", day_of_week: "Wednesday", recurrence_rule: "2nd" },
      ];

      const groups = groupEventsByNextOccurrence(events);

      // Weekly should be TODAY (5th Wed)
      expect(groups.get("2025-01-29")?.some(e => e.id === "weekly-wed")).toBe(true);

      // Ordinals should be in FEBRUARY
      expect(groups.get("2025-02-05")?.some(e => e.id === "1st-wed")).toBe(true);
      expect(groups.get("2025-02-12")?.some(e => e.id === "2nd-wed")).toBe(true);
    });
  });
});
