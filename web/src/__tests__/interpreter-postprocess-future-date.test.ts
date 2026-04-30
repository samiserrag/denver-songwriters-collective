import { describe, expect, it } from "vitest";
import { nextFutureMonthDayDate } from "@/lib/events/interpreterPostprocess";

describe("nextFutureMonthDayDate", () => {
  const cases: Array<{
    name: string;
    todayIso: string;
    month: number;
    day: number;
    expected: string;
  }> = [
    {
      name: "today's date is a valid future occurrence (regression)",
      todayIso: "2026-04-30",
      month: 4,
      day: 30,
      expected: "2026-04-30",
    },
    {
      name: "yesterday rolls to next year",
      todayIso: "2026-04-30",
      month: 4,
      day: 29,
      expected: "2027-04-29",
    },
    {
      name: "tomorrow returns this year",
      todayIso: "2026-04-30",
      month: 5,
      day: 1,
      expected: "2026-05-01",
    },
    {
      name: "earlier in current year rolls to next year",
      todayIso: "2026-04-30",
      month: 1,
      day: 15,
      expected: "2027-01-15",
    },
    {
      name: "later in current year returns this year",
      todayIso: "2026-04-30",
      month: 12,
      day: 25,
      expected: "2026-12-25",
    },
    {
      name: "year-end wraps to next year",
      todayIso: "2026-12-31",
      month: 1,
      day: 1,
      expected: "2027-01-01",
    },
    {
      name: "year-end same day returns today",
      todayIso: "2026-12-31",
      month: 12,
      day: 31,
      expected: "2026-12-31",
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      expect(nextFutureMonthDayDate(tc.month, tc.day, tc.todayIso)).toBe(tc.expected);
    });
  }

  it("Feb 29 in non-leap year returns next-year ISO without normalization", () => {
    // toIsoDate is a pure zero-pad formatter and does not validate calendar
    // legality. Document that current behavior produces "2027-02-29" rather
    // than skipping to the next leap year. Do not redesign here.
    const result = nextFutureMonthDayDate(2, 29, "2026-03-01");
    expect(result).toBe("2027-02-29");
  });
});
