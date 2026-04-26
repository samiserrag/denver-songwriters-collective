import { describe, expect, it } from "vitest";
import { normalizeDraftRecurrenceFields } from "@/lib/events/recurrenceDraftTools";

describe("normalizeDraftRecurrenceFields", () => {
  it("keeps one-day weekly RRULEs in native weekly mode", () => {
    const draft = normalizeDraftRecurrenceFields({
      start_date: "2026-04-26",
      recurrence_rule: "FREQ=WEEKLY;BYDAY=SU",
      series_mode: "recurring",
    });

    expect(draft.series_mode).toBe("weekly");
    expect(draft.day_of_week).toBe("Sunday");
    expect(draft.recurrence_rule).toBe("FREQ=WEEKLY;BYDAY=SU");
  });

  it("keeps one-day interval-2 weekly RRULEs in native biweekly mode", () => {
    const draft = normalizeDraftRecurrenceFields({
      start_date: "2026-04-26",
      recurrence_rule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SU",
      series_mode: "recurring",
    });

    expect(draft.series_mode).toBe("biweekly");
    expect(draft.day_of_week).toBe("Sunday");
  });

  it("keeps same-weekday ordinal monthly RRULEs in native monthly mode", () => {
    const draft = normalizeDraftRecurrenceFields({
      start_date: "2026-05-06",
      recurrence_rule: "FREQ=MONTHLY;BYDAY=1WE,3WE",
      series_mode: "recurring",
    });

    expect(draft.series_mode).toBe("monthly");
    expect(draft.day_of_week).toBe("Wednesday");
  });

  it("converts multiple weekday weekly RRULEs to explicit custom dates", () => {
    const draft = normalizeDraftRecurrenceFields({
      start_date: "2026-04-27",
      recurrence_rule: "FREQ=WEEKLY;BYDAY=MO,WE",
      series_mode: "recurring",
    });

    expect(draft.series_mode).toBe("custom");
    expect(draft.recurrence_rule).toBe("custom");
    expect(draft.custom_dates).toEqual([
      "2026-04-27",
      "2026-04-29",
      "2026-05-04",
      "2026-05-06",
      "2026-05-11",
      "2026-05-13",
      "2026-05-18",
      "2026-05-20",
      "2026-05-25",
      "2026-05-27",
      "2026-06-01",
      "2026-06-03",
    ]);
  });

  it("converts every-third-week RRULEs to explicit custom dates", () => {
    const draft = normalizeDraftRecurrenceFields({
      start_date: "2026-04-26",
      recurrence_rule: "FREQ=WEEKLY;INTERVAL=3;BYDAY=SU",
      series_mode: "recurring",
    });

    expect(draft.series_mode).toBe("custom");
    expect(draft.custom_dates).toEqual([
      "2026-04-26",
      "2026-05-17",
      "2026-06-07",
      "2026-06-28",
      "2026-07-19",
      "2026-08-09",
      "2026-08-30",
      "2026-09-20",
      "2026-10-11",
      "2026-11-01",
      "2026-11-22",
      "2026-12-13",
    ]);
  });

  it("preserves explicit custom dates as the authoritative schedule", () => {
    const draft = normalizeDraftRecurrenceFields({
      start_date: "2026-05-10",
      recurrence_rule: "FREQ=YEARLY",
      series_mode: "recurring",
      custom_dates: ["2026-06-01", "bad-date", "2026-05-10", "2026-05-10"],
    });

    expect(draft.series_mode).toBe("custom");
    expect(draft.recurrence_rule).toBe("custom");
    expect(draft.start_date).toBe("2026-05-10");
    expect(draft.event_date).toBe("2026-05-10");
    expect(draft.custom_dates).toEqual(["2026-05-10", "2026-06-01"]);
  });
});
