import { describe, expect, it } from "vitest";
import { parseOrdinalsFromRecurrenceRule } from "@/lib/events/recurrenceContract";

describe("parseOrdinalsFromRecurrenceRule", () => {
  it("parses legacy ordinal format", () => {
    expect(parseOrdinalsFromRecurrenceRule("4th")).toEqual([4]);
    expect(parseOrdinalsFromRecurrenceRule("1st/3rd")).toEqual([1, 3]);
  });

  it("parses RRULE ordinal BYDAY format", () => {
    expect(parseOrdinalsFromRecurrenceRule("FREQ=MONTHLY;BYDAY=4TU")).toEqual([4]);
    expect(parseOrdinalsFromRecurrenceRule("RRULE:FREQ=MONTHLY;BYDAY=-1TH")).toEqual([-1]);
  });

  it("parses RRULE BYSETPOS monthly format", () => {
    expect(parseOrdinalsFromRecurrenceRule("FREQ=MONTHLY;BYDAY=TU;BYSETPOS=4")).toEqual([4]);
    expect(parseOrdinalsFromRecurrenceRule("FREQ=MONTHLY;BYSETPOS=-1;BYDAY=TU")).toEqual([-1]);
  });

  it("returns empty ordinals for non-monthly rrules", () => {
    expect(parseOrdinalsFromRecurrenceRule("FREQ=WEEKLY;BYDAY=TU")).toEqual([]);
    expect(parseOrdinalsFromRecurrenceRule("weekly")).toEqual([]);
  });
});

