import { describe, expect, it } from "vitest";
import {
  applyOverEagerFutureYearPullback,
  nextFutureMonthDayDate,
} from "@/lib/events/interpreterPostprocess";

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

describe("applyOverEagerFutureYearPullback", () => {
  it("pulls back LLM's 2027-04-30 to 2026-04-30 when flyer text has no year (regression)", () => {
    const draft: Record<string, unknown> = {
      title: "Open mic at Sit-N-Bull",
      event_date: "2027-04-30",
    };
    const result = applyOverEagerFutureYearPullback({
      draft,
      message: "Open mic Thursday April 30 at Sit-N-Bull",
      history: [],
      extractedImageText: "OPEN MIC NIGHT THURSDAY APRIL 30",
      todayIso: "2026-04-30",
    });
    expect(result).toEqual({
      applied: true,
      from: "2027-04-30",
      to: "2026-04-30",
      reason: "future_year_pullback",
    });
    expect(draft.event_date).toBe("2026-04-30");
  });

  it("does not pull back when source explicitly mentions LLM's year", () => {
    const draft: Record<string, unknown> = {
      title: "Open mic",
      event_date: "2027-04-30",
    };
    const result = applyOverEagerFutureYearPullback({
      draft,
      message: "Flyer says April 30 2027 at Sit-N-Bull",
      history: [],
      todayIso: "2026-04-30",
    });
    expect(result).toEqual({ applied: false });
    expect(draft.event_date).toBe("2027-04-30");
  });

  it("does not pull back when this-year candidate is already past", () => {
    const draft: Record<string, unknown> = {
      title: "Halloween jam",
      event_date: "2027-10-30",
    };
    const result = applyOverEagerFutureYearPullback({
      draft,
      message: "October 30 jam",
      history: [],
      todayIso: "2026-11-15",
    });
    expect(result).toEqual({ applied: false });
    expect(draft.event_date).toBe("2027-10-30");
  });

  it("does not pull back when LLM picked current-year future date", () => {
    const draft: Record<string, unknown> = {
      title: "Christmas show",
      event_date: "2026-12-25",
    };
    const result = applyOverEagerFutureYearPullback({
      draft,
      message: "December 25 show",
      history: [],
      todayIso: "2026-04-30",
    });
    expect(result).toEqual({ applied: false });
    expect(draft.event_date).toBe("2026-12-25");
  });

  it("does not pull back when LLM picked a past year (existing rollover handles it)", () => {
    const draft: Record<string, unknown> = {
      title: "Old show",
      event_date: "2025-04-30",
    };
    const result = applyOverEagerFutureYearPullback({
      draft,
      message: "April 30 show",
      history: [],
      todayIso: "2026-04-30",
    });
    expect(result).toEqual({ applied: false });
    expect(draft.event_date).toBe("2025-04-30");
  });
});
