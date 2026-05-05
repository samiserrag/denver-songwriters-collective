/**
 * conciergeScheduleParser.ts — per-shape tests.
 *
 * One test per page-text shape from design doc §3:
 *   1. Date-then-times block.
 *   2. Repeating header.
 *   3. Slot table.
 *   4. Single-event flyer text.
 *   5. Pure conversation.
 *
 * Parser is pure: no I/O, no LLM, no network. These tests pin the IR shape
 * the parser produces; the validator's Black Rose fixture test (separate
 * file) drives the end-to-end §7 acceptance criteria.
 */

import { describe, expect, it } from "vitest";
import { parse } from "@/lib/events/conciergeScheduleParser";
import { CONCIERGE_IR_KEYS } from "@/lib/events/conciergeIR";

const TODAY = "2026-05-04";

describe("conciergeScheduleParser — output shape", () => {
  it("returns an IR with the exact 11 contract keys regardless of input", () => {
    const ir = parse({
      source_kind: "conversation",
      raw_text: "Hello world",
      today_iso: TODAY,
    });
    expect(Object.keys(ir).sort()).toEqual([...CONCIERGE_IR_KEYS].sort());
  });
});

describe("conciergeScheduleParser — Shape 1: date-then-times block", () => {
  it("emits one occurrence with shared time and lineup from indented slot lines", () => {
    const raw = `Open Mic Night
Buffalo Lodge
2 El Paso Blvd., Colorado Springs, CO

Wednesday, May 6: 6:00 - 9:00 pm
6:00 - 6:30 pm — Open Mic
6:30 - 7:15 pm — Juniper Smith
7:15 - 9:00 pm — The Mountain Larks`;

    const ir = parse({
      source_kind: "pasted_page_text",
      raw_text: raw,
      today_iso: TODAY,
    });

    expect(ir.title).toBe("Open Mic Night");
    expect(ir.shared_facts.venue).toBe("Buffalo Lodge");
    expect(ir.shared_facts.address).toBe("2 El Paso Blvd.");
    expect(ir.shared_facts.city).toBe("Colorado Springs");
    expect(ir.shared_facts.state).toBe("CO");
    expect(ir.shared_facts.time).toEqual({ start: "18:00", end: "21:00" });
    expect(ir.occurrences).toHaveLength(1);
    expect(ir.occurrences[0].date).toBe("2026-05-06");
    expect(ir.occurrences[0].lineup).toEqual([
      "Open Mic",
      "Juniper Smith",
      "The Mountain Larks",
    ]);
  });

  it("attaches per-date lineup to the correct occurrence", () => {
    const raw = `Two-Date Run
Wednesday, May 6: 7:00 - 10:00 pm
7:00 - 8:00 pm — Performer A
Wednesday, May 13: 7:00 - 10:00 pm
7:00 - 8:00 pm — Performer B`;

    const ir = parse({
      source_kind: "pasted_page_text",
      raw_text: raw,
      today_iso: TODAY,
    });
    expect(ir.occurrences).toHaveLength(2);
    expect(ir.occurrences[0].date).toBe("2026-05-06");
    expect(ir.occurrences[0].lineup).toEqual(["Performer A"]);
    expect(ir.occurrences[1].date).toBe("2026-05-13");
    expect(ir.occurrences[1].lineup).toEqual(["Performer B"]);
  });
});

describe("conciergeScheduleParser — Shape 2: repeating header", () => {
  it("hoists shared venue and shared time, emits one occurrence per date block", () => {
    const raw = `Venue Series
The Hollow Tree
123 Main St., Denver, CO

Thursday, May 7: 8:00 - 10:00 pm
Thursday, May 14: 8:00 - 10:00 pm
Thursday, May 21: 8:00 - 10:00 pm`;

    const ir = parse({
      source_kind: "pasted_page_text",
      raw_text: raw,
      today_iso: TODAY,
    });

    expect(ir.shared_facts.venue).toBe("The Hollow Tree");
    expect(ir.shared_facts.time).toEqual({ start: "20:00", end: "22:00" });
    expect(ir.occurrences.map((o) => o.date)).toEqual([
      "2026-05-07",
      "2026-05-14",
      "2026-05-21",
    ]);
    // Per-occurrence start/end null because shared time was hoisted.
    for (const o of ir.occurrences) {
      expect(o.start_time).toBeNull();
      expect(o.end_time).toBeNull();
    }
  });

  it("does not hoist shared time when sections disagree", () => {
    const raw = `Variable Run
Wednesday, May 6: 6:00 - 9:00 pm
Wednesday, May 13: 7:00 - 10:00 pm`;

    const ir = parse({
      source_kind: "pasted_page_text",
      raw_text: raw,
      today_iso: TODAY,
    });
    expect(ir.shared_facts.time).toBeNull();
    expect(ir.occurrences[0].start_time).toBe("18:00");
    expect(ir.occurrences[0].end_time).toBe("21:00");
    expect(ir.occurrences[1].start_time).toBe("19:00");
    expect(ir.occurrences[1].end_time).toBe("22:00");
  });
});

describe("conciergeScheduleParser — Shape 3: slot table", () => {
  it("flattens a pipe-delimited table to occurrences + lineup", () => {
    const raw = `Showcase Lineup
Date | Time | Performer
May 6 | 7:00-7:30 pm | Performer A
May 6 | 7:30-8:00 pm | Performer B
May 13 | 7:00-7:30 pm | Performer C`;

    const ir = parse({
      source_kind: "pasted_page_text",
      raw_text: raw,
      today_iso: TODAY,
    });

    expect(ir.occurrences).toHaveLength(2);
    const may6 = ir.occurrences.find((o) => o.date === "2026-05-06");
    const may13 = ir.occurrences.find((o) => o.date === "2026-05-13");
    expect(may6?.lineup).toEqual(["Performer A", "Performer B"]);
    expect(may13?.lineup).toEqual(["Performer C"]);
  });
});

describe("conciergeScheduleParser — Shape 4: single-event flyer text", () => {
  it("emits one occurrence with shared facts populated", () => {
    const raw = `Single Showcase
The Backyard Stage
500 Central Ave., Denver, CO

Saturday, June 13 — 7:30 pm to 10:00 pm
Doors at 7:00. All ages.`;

    const ir = parse({
      source_kind: "flyer_image",
      raw_text: raw,
      today_iso: TODAY,
    });
    expect(ir.title).toBe("Single Showcase");
    expect(ir.shared_facts.venue).toBe("The Backyard Stage");
    expect(ir.shared_facts.address).toBe("500 Central Ave.");
    expect(ir.shared_facts.age_policy).toBe("all ages");
    expect(ir.occurrences).toHaveLength(1);
    expect(ir.occurrences[0].date).toBe("2026-06-13");
    expect(ir.occurrences[0].lineup).toEqual([]);
  });
});

describe("conciergeScheduleParser — Shape 5: pure conversation", () => {
  it("emits zero occurrences when the host just types prose with no schedule shape", () => {
    const ir = parse({
      source_kind: "conversation",
      raw_text:
        "Hey, I'm thinking about doing a thing soon — can you help me figure out the details?",
      today_iso: TODAY,
    });
    expect(ir.occurrences).toEqual([]);
    expect(ir.title).toBeNull();
    expect(ir.shared_facts.time).toBeNull();
    expect(ir.shared_facts.venue).toBeNull();
  });

  it("captures an explicit time mention in conversation as shared_facts.time", () => {
    const ir = parse({
      source_kind: "conversation",
      raw_text: "We're aiming for 7 pm to 9 pm but no date yet.",
      today_iso: TODAY,
    });
    expect(ir.occurrences).toEqual([]);
    expect(ir.shared_facts.time).toEqual({ start: "19:00", end: "21:00" });
  });
});

describe("conciergeScheduleParser — year resolution", () => {
  it("uses today's year when month-day is on or after today", () => {
    const ir = parse({
      source_kind: "pasted_page_text",
      raw_text: "Wednesday, May 6: 6:00 - 9:00 pm",
      today_iso: "2026-05-04",
    });
    expect(ir.occurrences[0].date).toBe("2026-05-06");
  });

  it("advances to next year when month-day is before today", () => {
    const ir = parse({
      source_kind: "pasted_page_text",
      raw_text: "Wednesday, March 4: 6:00 - 9:00 pm",
      today_iso: "2026-05-04",
    });
    expect(ir.occurrences[0].date).toBe("2027-03-04");
  });

  it("respects an explicit 4-digit year in the source", () => {
    const ir = parse({
      source_kind: "pasted_page_text",
      raw_text: "Wednesday, March 4, 2026: 6:00 - 9:00 pm",
      today_iso: "2026-05-04",
    });
    expect(ir.occurrences[0].date).toBe("2026-03-04");
  });
});

describe("conciergeScheduleParser — provenance", () => {
  it("records source_url provenance when input.source_url is provided", () => {
    const ir = parse({
      source_kind: "pasted_page_text",
      source_url: "https://example.org/show",
      raw_text: "Wednesday, May 6: 6:00 - 9:00 pm",
      today_iso: TODAY,
    });
    expect(ir.provenance.source_url).toBeDefined();
    expect(ir.provenance.source_url.evidence_text).toBe("https://example.org/show");
  });
});
