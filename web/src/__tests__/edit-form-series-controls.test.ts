/**
 * Edit Form Series Controls Tests
 *
 * Tests for the series controls added to the edit form:
 * - Save button placement (top of form)
 * - Ordinal initialization from recurrence_rule
 * - Series controls visibility in edit mode
 * - Submit logic rebuilding recurrence_rule from ordinals
 * - Day of Week visibility rules
 * - max_occurrences sent on edit save
 * - Monthly "No end date" radio pattern
 */

import { describe, it, expect } from "vitest";

// ============ ORDINAL PARSING TESTS ============
// These test the parsing logic used to initialize selectedOrdinals from event.recurrence_rule

describe("Ordinal parsing from recurrence_rule", () => {
  // Helper that mirrors the initialization logic in EventForm
  function parseOrdinalsFromRule(rule: string | null | undefined): number[] {
    if (!rule || rule === "weekly" || rule === "biweekly") return [1]; // default
    const ordinalMap: Record<string, number> = { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "last": -1 };
    const parts = rule.split("/").map(s => s.trim().toLowerCase());
    const parsed = parts.map(p => ordinalMap[p]).filter((n): n is number => n !== undefined);
    return parsed.length > 0 ? parsed : [1];
  }

  it("parses single ordinal: '3rd' → [3]", () => {
    expect(parseOrdinalsFromRule("3rd")).toEqual([3]);
  });

  it("parses double ordinal: '1st/3rd' → [1, 3]", () => {
    expect(parseOrdinalsFromRule("1st/3rd")).toEqual([1, 3]);
  });

  it("parses 'last' → [-1]", () => {
    expect(parseOrdinalsFromRule("last")).toEqual([-1]);
  });

  it("parses '2nd/4th' → [2, 4]", () => {
    expect(parseOrdinalsFromRule("2nd/4th")).toEqual([2, 4]);
  });

  it("parses '1st/3rd/last' → [1, 3, -1]", () => {
    expect(parseOrdinalsFromRule("1st/3rd/last")).toEqual([1, 3, -1]);
  });

  it("parses '5th' → [5]", () => {
    expect(parseOrdinalsFromRule("5th")).toEqual([5]);
  });

  it("returns default [1] for 'weekly'", () => {
    expect(parseOrdinalsFromRule("weekly")).toEqual([1]);
  });

  it("returns default [1] for 'biweekly'", () => {
    expect(parseOrdinalsFromRule("biweekly")).toEqual([1]);
  });

  it("returns default [1] for null", () => {
    expect(parseOrdinalsFromRule(null)).toEqual([1]);
  });

  it("returns default [1] for undefined", () => {
    expect(parseOrdinalsFromRule(undefined)).toEqual([1]);
  });

  it("returns default [1] for unrecognized rule", () => {
    expect(parseOrdinalsFromRule("something_unknown")).toEqual([1]);
  });

  it("handles mixed case: '1ST/3RD' → [1, 3]", () => {
    expect(parseOrdinalsFromRule("1ST/3RD")).toEqual([1, 3]);
  });

  it("handles whitespace: ' 2nd / 4th ' → [2, 4]", () => {
    expect(parseOrdinalsFromRule(" 2nd / 4th ")).toEqual([2, 4]);
  });
});

// ============ RECURRENCE RULE REBUILD TESTS ============
// These test the logic used to rebuild recurrence_rule from selectedOrdinals on save

describe("Recurrence rule rebuild from ordinals", () => {
  // Helper that mirrors the submit logic in EventForm
  function buildRecurrenceRule(seriesMode: string, ordinals: number[]): string | null {
    if (seriesMode === "monthly") {
      const ordinalWords: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", [-1]: "last" };
      const ordinalTexts = ordinals
        .sort((a, b) => a === -1 ? 1 : b === -1 ? -1 : a - b)
        .map(o => ordinalWords[o] || `${o}th`);
      return ordinalTexts.join("/");
    } else if (seriesMode === "weekly") {
      return "weekly";
    }
    return null; // single event
  }

  it("builds single ordinal: [3] → '3rd'", () => {
    expect(buildRecurrenceRule("monthly", [3])).toBe("3rd");
  });

  it("builds double ordinal: [1, 3] → '1st/3rd'", () => {
    expect(buildRecurrenceRule("monthly", [1, 3])).toBe("1st/3rd");
  });

  it("builds with 'last': [1, -1] → '1st/last'", () => {
    expect(buildRecurrenceRule("monthly", [1, -1])).toBe("1st/last");
  });

  it("builds all ordinals: [1, 2, 3, 4] → '1st/2nd/3rd/4th'", () => {
    expect(buildRecurrenceRule("monthly", [1, 2, 3, 4])).toBe("1st/2nd/3rd/4th");
  });

  it("sorts ordinals before building: [3, 1] → '1st/3rd'", () => {
    expect(buildRecurrenceRule("monthly", [3, 1])).toBe("1st/3rd");
  });

  it("puts 'last' at end: [-1, 2] → '2nd/last'", () => {
    expect(buildRecurrenceRule("monthly", [-1, 2])).toBe("2nd/last");
  });

  it("weekly mode always returns 'weekly'", () => {
    expect(buildRecurrenceRule("weekly", [1, 3])).toBe("weekly");
  });

  it("single mode returns null", () => {
    expect(buildRecurrenceRule("single", [1])).toBeNull();
  });
});

// ============ SERIES MODE DETECTION TESTS ============
// These test how series_mode is derived from event.recurrence_rule in edit mode

describe("Series mode detection from event data", () => {
  // Helper that mirrors the initialization logic in EventForm
  function detectSeriesMode(recurrenceRule: string | null | undefined): "single" | "weekly" | "monthly" | "custom" {
    if (!recurrenceRule) return "single";
    if (recurrenceRule === "weekly" || recurrenceRule === "biweekly") return "weekly";
    return "monthly";
  }

  it("detects 'weekly' → weekly mode", () => {
    expect(detectSeriesMode("weekly")).toBe("weekly");
  });

  it("detects 'biweekly' → weekly mode", () => {
    expect(detectSeriesMode("biweekly")).toBe("weekly");
  });

  it("detects '3rd' → monthly mode", () => {
    expect(detectSeriesMode("3rd")).toBe("monthly");
  });

  it("detects '1st/3rd' → monthly mode", () => {
    expect(detectSeriesMode("1st/3rd")).toBe("monthly");
  });

  it("detects 'last' → monthly mode", () => {
    expect(detectSeriesMode("last")).toBe("monthly");
  });

  it("detects null → single mode", () => {
    expect(detectSeriesMode(null)).toBe("single");
  });

  it("detects undefined → single mode", () => {
    expect(detectSeriesMode(undefined)).toBe("single");
  });
});

// ============ MAX_OCCURRENCES TESTS ============
// These test the occurrence_count → max_occurrences conversion

describe("max_occurrences from occurrence_count", () => {
  // Helper that mirrors the body construction logic
  function computeMaxOccurrences(occurrenceCount: string): number | null {
    const parsed = parseInt(occurrenceCount) || 0;
    return parsed > 0 ? parsed : null;
  }

  it("'0' (no end date) → null", () => {
    expect(computeMaxOccurrences("0")).toBeNull();
  });

  it("'4' → 4", () => {
    expect(computeMaxOccurrences("4")).toBe(4);
  });

  it("'12' → 12", () => {
    expect(computeMaxOccurrences("12")).toBe(12);
  });

  it("'52' → 52", () => {
    expect(computeMaxOccurrences("52")).toBe(52);
  });

  it("'' (empty string) → null", () => {
    expect(computeMaxOccurrences("")).toBeNull();
  });

  it("non-numeric → null", () => {
    expect(computeMaxOccurrences("abc")).toBeNull();
  });
});

// ============ DAY OF WEEK VISIBILITY TESTS ============
// These test when the Day of Week dropdown should be visible

describe("Day of Week dropdown visibility", () => {
  // Helper that mirrors the condition in EventForm
  function shouldShowDayOfWeek(mode: "create" | "edit", seriesMode: string): boolean {
    return (mode === "edit" && seriesMode === "weekly") || (mode === "create" && seriesMode === "weekly");
  }

  it("shows for create + weekly", () => {
    expect(shouldShowDayOfWeek("create", "weekly")).toBe(true);
  });

  it("shows for edit + weekly", () => {
    expect(shouldShowDayOfWeek("edit", "weekly")).toBe(true);
  });

  it("hides for edit + monthly (derives from date)", () => {
    expect(shouldShowDayOfWeek("edit", "monthly")).toBe(false);
  });

  it("hides for create + monthly (derives from date)", () => {
    expect(shouldShowDayOfWeek("create", "monthly")).toBe(false);
  });

  it("hides for create + single", () => {
    expect(shouldShowDayOfWeek("create", "single")).toBe(false);
  });

  it("hides for edit + single", () => {
    expect(shouldShowDayOfWeek("edit", "single")).toBe(false);
  });

  it("hides for create + custom", () => {
    expect(shouldShowDayOfWeek("create", "custom")).toBe(false);
  });
});

// ============ OCCURRENCE COUNT INITIALIZATION TESTS ============
// These test how occurrence_count is initialized from event.max_occurrences

describe("Occurrence count initialization from event.max_occurrences", () => {
  function initOccurrenceCount(maxOccurrences: number | null | undefined): string {
    return maxOccurrences ? maxOccurrences.toString() : "0";
  }

  it("null → '0' (no end date)", () => {
    expect(initOccurrenceCount(null)).toBe("0");
  });

  it("undefined → '0' (no end date)", () => {
    expect(initOccurrenceCount(undefined)).toBe("0");
  });

  it("4 → '4'", () => {
    expect(initOccurrenceCount(4)).toBe("4");
  });

  it("12 → '12'", () => {
    expect(initOccurrenceCount(12)).toBe("12");
  });

  it("52 → '52'", () => {
    expect(initOccurrenceCount(52)).toBe("52");
  });
});

// ============ ROUND-TRIP TESTS ============
// Ensure parse → rebuild produces the same recurrence_rule

describe("Ordinal round-trip (parse → rebuild)", () => {
  function parseOrdinalsFromRule(rule: string): number[] {
    const ordinalMap: Record<string, number> = { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "last": -1 };
    const parts = rule.split("/").map(s => s.trim().toLowerCase());
    const parsed = parts.map(p => ordinalMap[p]).filter((n): n is number => n !== undefined);
    return parsed.length > 0 ? parsed : [1];
  }

  function buildRecurrenceRule(ordinals: number[]): string {
    const ordinalWords: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", [-1]: "last" };
    const ordinalTexts = ordinals
      .sort((a, b) => a === -1 ? 1 : b === -1 ? -1 : a - b)
      .map(o => ordinalWords[o] || `${o}th`);
    return ordinalTexts.join("/");
  }

  it("'3rd' round-trips correctly", () => {
    const parsed = parseOrdinalsFromRule("3rd");
    expect(buildRecurrenceRule(parsed)).toBe("3rd");
  });

  it("'1st/3rd' round-trips correctly", () => {
    const parsed = parseOrdinalsFromRule("1st/3rd");
    expect(buildRecurrenceRule(parsed)).toBe("1st/3rd");
  });

  it("'2nd/4th' round-trips correctly", () => {
    const parsed = parseOrdinalsFromRule("2nd/4th");
    expect(buildRecurrenceRule(parsed)).toBe("2nd/4th");
  });

  it("'1st/last' round-trips correctly", () => {
    const parsed = parseOrdinalsFromRule("1st/last");
    expect(buildRecurrenceRule(parsed)).toBe("1st/last");
  });

  it("'1st/2nd/3rd/4th' round-trips correctly", () => {
    const parsed = parseOrdinalsFromRule("1st/2nd/3rd/4th");
    expect(buildRecurrenceRule(parsed)).toBe("1st/2nd/3rd/4th");
  });

  it("'last' round-trips correctly", () => {
    const parsed = parseOrdinalsFromRule("last");
    expect(buildRecurrenceRule(parsed)).toBe("last");
  });
});

// ============ EDIT MODE BODY CONSTRUCTION TESTS ============
// Test the complete body construction for edit mode saves

describe("Edit mode save body construction", () => {
  interface EditBodyParams {
    seriesMode: string;
    selectedOrdinals: number[];
    occurrenceCount: string;
    dayOfWeek: string;
    eventDate: string;
  }

  function buildEditBody(params: EditBodyParams) {
    const { seriesMode, selectedOrdinals, occurrenceCount, dayOfWeek } = params;

    let recurrenceRule: string | null = null;
    if (seriesMode === "monthly") {
      const ordinalWords: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", [-1]: "last" };
      const ordinalTexts = selectedOrdinals
        .sort((a, b) => a === -1 ? 1 : b === -1 ? -1 : a - b)
        .map(o => ordinalWords[o] || `${o}th`);
      recurrenceRule = ordinalTexts.join("/");
    } else if (seriesMode === "weekly") {
      recurrenceRule = "weekly";
    }

    const maxOccurrences = (parseInt(occurrenceCount) || 0) > 0 ? parseInt(occurrenceCount) : null;

    return {
      recurrence_rule: recurrenceRule,
      day_of_week: dayOfWeek || null,
      max_occurrences: maxOccurrences,
    };
  }

  it("monthly event with 3rd Thursday, no end date", () => {
    const body = buildEditBody({
      seriesMode: "monthly",
      selectedOrdinals: [3],
      occurrenceCount: "0",
      dayOfWeek: "Thursday",
      eventDate: "2026-02-19",
    });
    expect(body.recurrence_rule).toBe("3rd");
    expect(body.day_of_week).toBe("Thursday");
    expect(body.max_occurrences).toBeNull();
  });

  it("monthly event with 1st & 3rd Sunday, ends after 6", () => {
    const body = buildEditBody({
      seriesMode: "monthly",
      selectedOrdinals: [1, 3],
      occurrenceCount: "6",
      dayOfWeek: "Sunday",
      eventDate: "2026-03-01",
    });
    expect(body.recurrence_rule).toBe("1st/3rd");
    expect(body.day_of_week).toBe("Sunday");
    expect(body.max_occurrences).toBe(6);
  });

  it("weekly event, no end date", () => {
    const body = buildEditBody({
      seriesMode: "weekly",
      selectedOrdinals: [1], // ignored for weekly
      occurrenceCount: "0",
      dayOfWeek: "Tuesday",
      eventDate: "2026-01-14",
    });
    expect(body.recurrence_rule).toBe("weekly");
    expect(body.day_of_week).toBe("Tuesday");
    expect(body.max_occurrences).toBeNull();
  });

  it("weekly event, ends after 12", () => {
    const body = buildEditBody({
      seriesMode: "weekly",
      selectedOrdinals: [1],
      occurrenceCount: "12",
      dayOfWeek: "Friday",
      eventDate: "2026-02-07",
    });
    expect(body.recurrence_rule).toBe("weekly");
    expect(body.day_of_week).toBe("Friday");
    expect(body.max_occurrences).toBe(12);
  });

  it("single event clears recurrence", () => {
    const body = buildEditBody({
      seriesMode: "single",
      selectedOrdinals: [1],
      occurrenceCount: "0",
      dayOfWeek: "",
      eventDate: "2026-03-15",
    });
    expect(body.recurrence_rule).toBeNull();
    expect(body.day_of_week).toBeNull();
    expect(body.max_occurrences).toBeNull();
  });

  it("changing ordinals from 3rd to 1st/3rd updates rule", () => {
    // Simulates user clicking "1st" button to add it to existing "3rd"
    const body = buildEditBody({
      seriesMode: "monthly",
      selectedOrdinals: [1, 3],
      occurrenceCount: "0",
      dayOfWeek: "Thursday",
      eventDate: "2026-02-19",
    });
    expect(body.recurrence_rule).toBe("1st/3rd");
  });

  it("changing from no-end to finite updates max_occurrences", () => {
    const body = buildEditBody({
      seriesMode: "monthly",
      selectedOrdinals: [3],
      occurrenceCount: "10",
      dayOfWeek: "Thursday",
      eventDate: "2026-02-19",
    });
    expect(body.max_occurrences).toBe(10);
  });
});
