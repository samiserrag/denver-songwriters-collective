import { describe, expect, it } from "vitest";
import { applyFutureDateGuard } from "@/lib/events/interpreterPostprocess";

describe("interpreter future-date guard", () => {
  it("advances month/day flyer dates that would otherwise be in the past", () => {
    const draft: Record<string, unknown> = {
      title: "Hooked on Colfax - Jam & Slam",
      start_date: "2026-04-19",
    };

    const result = applyFutureDateGuard({
      draft,
      message:
        "Flyer text: Jam&Slam. April 19th. If April 19 is in the past, use the next upcoming April 19.",
      history: [],
      todayIso: "2026-04-26",
    });

    expect(result).toEqual({
      applied: true,
      from: "2026-04-19",
      to: "2027-04-19",
      reason: "future_intent",
    });
    expect(draft.start_date).toBe("2027-04-19");
  });

  it("uses OCR month/day text when the typed message is sparse", () => {
    const draft: Record<string, unknown> = {
      title: "Jam&Slam",
      start_date: "2026-04-19",
    };

    const result = applyFutureDateGuard({
      draft,
      message: "Make this event from the flyer.",
      history: [],
      extractedImageText: "Jam&Slam\nApril 19th\nJam: 6-7:30\nSlam: 7:45-9",
      todayIso: "2026-04-26",
    });

    expect(result.applied).toBe(true);
    expect(draft.start_date).toBe("2027-04-19");
  });

  it("does not rewrite explicitly archival past events without future intent", () => {
    const draft: Record<string, unknown> = {
      title: "Jam&Slam Recap",
      start_date: "2026-04-19",
    };

    const result = applyFutureDateGuard({
      draft,
      message: "Add this past event archive from April 19, 2026.",
      history: [],
      todayIso: "2026-04-26",
    });

    expect(result).toEqual({ applied: false });
    expect(draft.start_date).toBe("2026-04-19");
  });

  it("updates both start_date and event_date when both are present", () => {
    const draft: Record<string, unknown> = {
      title: "Jam&Slam",
      start_date: "2026-04-19",
      event_date: "2026-04-19",
    };

    applyFutureDateGuard({
      draft,
      message: "April 19th, use the next upcoming date if this is old.",
      history: [],
      todayIso: "2026-04-26",
    });

    expect(draft.start_date).toBe("2027-04-19");
    expect(draft.event_date).toBe("2027-04-19");
  });

  it("fills a missing date from an unambiguous source month/day without a year", () => {
    const draft: Record<string, unknown> = {
      title: "Open Mic - Song Circle - Potluck",
    };

    const result = applyFutureDateGuard({
      draft,
      message:
        "One time event. Open Mic - Song Circle - Potluck Sat May 16, 2:00 PM to 6:00 PM.",
      history: [],
      todayIso: "2026-05-03",
    });

    expect(result).toEqual({
      applied: true,
      from: "missing",
      to: "2026-05-16",
      reason: "month_day_without_year",
    });
    expect(draft.start_date).toBe("2026-05-16");
    expect(draft.event_date).toBe("2026-05-16");
  });

  it("does not fill a missing date from an explicit past source year", () => {
    const draft: Record<string, unknown> = {
      title: "Archived Song Circle",
    };

    const result = applyFutureDateGuard({
      draft,
      message: "Open Mic - Song Circle - Potluck Sat May 16, 2020.",
      history: [],
      todayIso: "2026-05-03",
    });

    expect(result).toEqual({ applied: false });
    expect(draft.start_date).toBeUndefined();
    expect(draft.event_date).toBeUndefined();
  });
});
