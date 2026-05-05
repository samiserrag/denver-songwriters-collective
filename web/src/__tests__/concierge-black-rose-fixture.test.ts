/**
 * Concierge Black Rose end-to-end fixture test — Lane 9 PR 2.
 *
 * Drives the deterministic parser + validator over a recorded snapshot of the
 * Black Rose Acoustic Showcase schedule page text and asserts every parser,
 * validator, and search-query criterion from design doc §7 (PR #291).
 *
 * No live HTTP. The fixture text lives at
 * `src/__tests__/fixtures/concierge/black-rose-showcase.txt`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@/lib/events/conciergeScheduleParser";
import { filterSearchQueries, validate } from "@/lib/events/conciergeValidator";

const FIXTURE_PATH = join(
  __dirname,
  "fixtures",
  "concierge",
  "black-rose-showcase.txt",
);
const SOURCE_URL = "https://www.blackroseacoustic.org/showcase";
const TODAY = "2026-05-04";

function loadFixture(): string {
  return readFileSync(FIXTURE_PATH, "utf8");
}

describe("Black Rose Acoustic Showcase fixture — parser assertions (§7)", () => {
  const ir = parse({
    source_kind: "pasted_page_text",
    source_url: SOURCE_URL,
    raw_text: loadFixture(),
    today_iso: TODAY,
  });

  it("extracts all 5 occurrence dates", () => {
    expect(ir.occurrences).toHaveLength(5);
    expect(ir.occurrences.map((o) => o.date)).toEqual([
      "2026-05-06",
      "2026-05-13",
      "2026-05-20",
      "2026-05-27",
      "2026-06-03",
    ]);
  });

  it("attaches each lineup to the correct date (no cross-pollination)", () => {
    const byDate = Object.fromEntries(ir.occurrences.map((o) => [o.date, o.lineup]));
    expect(byDate["2026-05-06"]).toEqual([
      "Open Mic",
      "Juniper Smith",
      "The Mountain Larks",
      "River Road",
    ]);
    expect(byDate["2026-05-13"]).toEqual([
      "Open Mic",
      "Adam Cole",
      "Two Sides North",
      "The Front Range Trio",
    ]);
    expect(byDate["2026-05-20"]).toEqual([
      "Open Mic",
      "The Ridgewalkers",
      "Sara Hollis",
      "Coyote Sky Band",
    ]);
    expect(byDate["2026-05-27"]).toEqual([
      "Open Mic",
      "Tom Driscoll",
      "The Wandering Cedars",
      "Marlene Park",
    ]);
    expect(byDate["2026-06-03"]).toEqual([
      "Open Mic",
      "Hollow Pines",
      "Anabel Riggs",
      "Brass Trail",
    ]);
  });

  it("populates shared_facts.venue once as 'Buffalo Lodge'", () => {
    expect(ir.shared_facts.venue).toBe("Buffalo Lodge");
    // Not duplicated into each occurrence — occurrences carry no venue field
    // by design (§2 schema). Confirm structurally.
    for (const occ of ir.occurrences) {
      expect(Object.keys(occ).sort()).toEqual(
        ["date", "end_time", "lineup", "per_date_notes", "start_time"],
      );
    }
  });

  it("populates shared_facts.address with '2 El Paso Blvd.' once", () => {
    expect(ir.shared_facts.address).toContain("2 El Paso Blvd.");
  });

  it("populates shared_facts.city with 'Colorado Springs' once", () => {
    expect(ir.shared_facts.city).toBe("Colorado Springs");
  });

  it("populates shared_facts.time with the 6:00–9:00 PM window", () => {
    expect(ir.shared_facts.time).toEqual({ start: "18:00", end: "21:00" });
  });

  it("preserves source_url", () => {
    expect(ir.source_url).toBe(SOURCE_URL);
  });
});

describe("Black Rose Acoustic Showcase fixture — validator assertions (§7)", () => {
  const ir = parse({
    source_kind: "pasted_page_text",
    source_url: SOURCE_URL,
    raw_text: loadFixture(),
    today_iso: TODAY,
  });

  // Simulate the kinds of bad questions a model might propose.
  const candidateQuestions = [
    { field: "venue", reason: "what is the venue?" },
    { field: "custom_dates", reason: "should I add custom dates?" },
    { field: "next_date", reason: "what date should this happen next?" },
    { field: "year", reason: "can you confirm the year?" },
  ];

  const result = validate({
    ir,
    rawSource: loadFixture(),
    candidateQuestions,
    todayIso: TODAY,
  });

  it("question ledger does NOT contain a venue question", () => {
    expect(result.questionLedger.find((q) => q.field === "venue")).toBeUndefined();
  });

  it("question ledger does NOT contain a custom_dates question", () => {
    expect(result.questionLedger.find((q) => q.field === "custom_dates")).toBeUndefined();
  });

  it("question ledger does NOT contain a 'what date should this happen next' question", () => {
    expect(
      result.questionLedger.find(
        (q) => q.field === "next_date" || /happen next/i.test(q.reason),
      ),
    ).toBeUndefined();
  });

  it("validator does not halt on the Black Rose fixture", () => {
    expect(result.halt).toBe(false);
  });
});

describe("Black Rose Acoustic Showcase fixture — search-query assertions (§7)", () => {
  const ir = parse({
    source_kind: "pasted_page_text",
    source_url: SOURCE_URL,
    raw_text: loadFixture(),
    today_iso: TODAY,
  });

  const candidateSearchQueries = [
    "Black Rose schedule",
    "Buffalo Lodge May 6",
    "blackroseacoustic.org showcase",
    "here",
    "find the next one",
  ];

  const { kept, dropped } = filterSearchQueries(candidateSearchQueries, ir);

  it("kept queries reference Black Rose / Buffalo Lodge / blackroseacoustic.org", () => {
    expect(kept).toEqual([
      "Black Rose schedule",
      "Buffalo Lodge May 6",
      "blackroseacoustic.org showcase",
    ]);
    for (const q of kept) {
      const lowered = q.toLowerCase();
      const hasSignal =
        lowered.includes("black rose") ||
        lowered.includes("buffalo lodge") ||
        lowered.includes("blackroseacoustic.org");
      expect(hasSignal).toBe(true);
    }
  });

  it("drops prose-noise queries like 'here' and bare sentence fragments", () => {
    expect(dropped.sort()).toEqual(["find the next one", "here"]);
  });
});
