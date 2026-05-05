/**
 * conciergeValidator.ts — per-gate tests.
 *
 * One positive + one negative test per gate from design doc §4. Pure
 * structural-pin assertions on the validator's output. No model, no I/O.
 *
 * Gates 1–9:
 *   1. Schema conformance.
 *   2. Source coverage check.
 *   3. Question-vs-source coverage.
 *   4. Internal-question rejection (extends #285's regex).
 *   5. Self-contradiction check.
 *   6. Cross-turn ledger persistence.
 *   7. Year/date suppression (reuses #285's redundant-year regex).
 *   8. Search query quality.
 *   9. external_url discipline.
 */

import { describe, expect, it } from "vitest";
import {
  emptyConciergeIR,
  type ConciergeIR,
} from "@/lib/events/conciergeIR";
import {
  applyCrossTurnLedger,
  dropOutOfLedgerQuestions,
  filterSearchQueries,
  validate,
} from "@/lib/events/conciergeValidator";

const TODAY = "2026-05-04";

function ok(): ConciergeIR {
  const ir = emptyConciergeIR("pasted_page_text", "https://www.example.org/show");
  ir.title = "Example Showcase";
  ir.event_family = "Example Showcase";
  ir.shared_facts.venue = "Buffalo Lodge";
  ir.shared_facts.address = "2 El Paso Blvd.";
  ir.shared_facts.city = "Colorado Springs";
  ir.shared_facts.state = "CO";
  ir.shared_facts.time = { start: "18:00", end: "21:00" };
  ir.occurrences = [
    {
      date: "2026-05-06",
      start_time: null,
      end_time: null,
      lineup: ["Open Mic", "Juniper Smith"],
      per_date_notes: null,
    },
  ];
  return ir;
}

describe("validator — Gate 1 (schema conformance)", () => {
  it("accepts a well-formed IR (positive)", () => {
    const result = validate({ ir: ok(), rawSource: "Buffalo Lodge\nMay 6 6 pm" });
    expect(result.halt).toBe(false);
    expect(result.reasons.find((r) => r.gate === 1)).toBeUndefined();
  });

  it("halts when occurrences contains a non-ISO date (negative)", () => {
    const ir = ok();
    (ir.occurrences[0] as { date: string }).date = "May 6";
    const result = validate({ ir, rawSource: "" });
    expect(result.halt).toBe(true);
    expect(result.reasons.some((r) => r.gate === 1)).toBe(true);
    expect(result.questionLedger).toEqual([]);
  });
});

describe("validator — Gate 2 (source coverage)", () => {
  it("passes when source has venue / date / time and IR has them too (positive)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "at Buffalo Lodge\nMay 6 6:00 pm",
    });
    expect(result.reasons.find((r) => r.gate === 2)).toBeUndefined();
    expect(result.halt).toBe(false);
  });

  it("flags when source contains date patterns but IR has zero occurrences (negative)", () => {
    const ir = ok();
    ir.occurrences = [];
    ir.shared_facts.time = null;
    const result = validate({
      ir,
      rawSource: "at Buffalo Lodge — May 6 6:00 pm",
    });
    expect(result.reasons.some((r) => r.gate === 2)).toBe(true);
    expect(result.halt).toBe(true);
  });
});

describe("validator — Gate 3 (question-vs-source coverage)", () => {
  it("drops a venue question when IR already has a venue (positive: drop fires)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "Buffalo Lodge",
      candidateQuestions: [{ field: "venue", reason: "what's the venue?" }],
    });
    expect(result.questionLedger.find((q) => q.field === "venue")).toBeUndefined();
    expect(result.reasons.some((r) => r.gate === 3 && r.field === "venue")).toBe(true);
  });

  it("keeps a question for a field absent from IR and source (negative: drop does not fire)", () => {
    const ir = ok();
    ir.shared_facts.cost = null;
    const result = validate({
      ir,
      rawSource: "Buffalo Lodge\nMay 6",
      candidateQuestions: [{ field: "cost", reason: "is there a cover?" }],
    });
    expect(result.questionLedger.find((q) => q.field === "cost")).toBeDefined();
  });
});

describe("validator — Gate 4 (internal-question rejection, extends #285)", () => {
  it("drops a question that mentions RRULE / FREQ= / schema / database (positive)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "",
      candidateQuestions: [
        { field: "recurrence", reason: "what RRULE should we use?" },
        { field: "schema", reason: "FREQ=WEEKLY override?" },
        { field: "data", reason: "is the schema correct?" },
        { field: "data", reason: "is the database storing this?" },
      ],
    });
    expect(result.questionLedger).toEqual([]);
    expect(result.reasons.filter((r) => r.gate === 4)).toHaveLength(4);
  });

  it("keeps a normal user-facing question (negative)", () => {
    const ir = ok();
    ir.shared_facts.cost = null;
    const result = validate({
      ir,
      rawSource: "",
      candidateQuestions: [{ field: "cost", reason: "what is the cover charge?" }],
    });
    expect(result.questionLedger).toHaveLength(1);
  });
});

describe("validator — Gate 5 (self-contradiction)", () => {
  it("drops a 'what date should this happen next' question when occurrences exist (positive)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "",
      candidateQuestions: [
        { field: "next_date", reason: "what date should this happen next?" },
      ],
    });
    expect(result.questionLedger).toEqual([]);
    expect(result.reasons.some((r) => r.gate === 5)).toBe(true);
  });

  it("drops a custom_dates question when occurrences exist (positive)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "",
      candidateQuestions: [
        { field: "custom_dates", reason: "should I add custom dates?" },
      ],
    });
    expect(result.questionLedger).toEqual([]);
    expect(result.reasons.some((r) => r.gate === 5 && r.field === "custom_dates")).toBe(true);
  });

  it("keeps a date question when IR has zero occurrences (negative)", () => {
    const ir = ok();
    ir.occurrences = [];
    const result = validate({
      ir,
      rawSource: "no schedule yet",
      candidateQuestions: [
        { field: "date", reason: "when is the event?" },
      ],
    });
    expect(result.questionLedger.find((q) => q.field === "date")).toBeDefined();
  });
});

describe("validator — Gate 6 (cross-turn ledger persistence)", () => {
  it("carries a venue from a prior turn when the new IR has none (positive)", () => {
    const prior = ok();
    const current = emptyConciergeIR("conversation");
    const merged = applyCrossTurnLedger(current, prior);
    expect(merged.shared_facts.venue).toBe("Buffalo Lodge");
    expect(merged.shared_facts.address).toBe("2 El Paso Blvd.");
    expect(merged.inferred_facts.some((f) => f.basis === "carried_from_prior_turn")).toBe(true);
  });

  it("does NOT overwrite a current fact with a prior fact (negative)", () => {
    const prior = ok();
    const current = ok();
    current.shared_facts.venue = "Different Place";
    const merged = applyCrossTurnLedger(current, prior);
    expect(merged.shared_facts.venue).toBe("Different Place");
  });
});

describe("validator — Gate 7 (year/date suppression)", () => {
  it("drops a 'verify the year?' question when occurrences are this year and in the future (positive)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "",
      candidateQuestions: [
        { field: "date", reason: "can you confirm the year?" },
      ],
      todayIso: TODAY,
    });
    expect(result.questionLedger).toEqual([]);
    expect(result.reasons.some((r) => r.gate === 7)).toBe(true);
  });

  it("does NOT suppress a year confirmation when occurrences are next year (negative)", () => {
    const ir = ok();
    ir.occurrences[0].date = "2027-05-06";
    const result = validate({
      ir,
      rawSource: "",
      candidateQuestions: [
        { field: "date", reason: "can you confirm the year?" },
      ],
      todayIso: TODAY,
    });
    // Gate 7 does not fire; gate 3 may not either (date covered though).
    // Year-confirmation question may still drop via gate 3 (occurrences cover
    // date), but gate 7 reason should NOT be present.
    expect(result.reasons.some((r) => r.gate === 7)).toBe(false);
  });
});

describe("validator — Gate 8 (search query quality)", () => {
  it("keeps queries that contain the title, venue, domain, or a date token (positive)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "",
      candidateSearchQueries: [
        "Example Showcase Buffalo Lodge",
        "May 6 schedule",
        "example.org showcase",
      ],
    });
    expect(result.reasons.filter((r) => r.gate === 8 && r.detail.startsWith("dropped"))).toEqual([]);
  });

  it("drops prose-noise queries (negative)", () => {
    const { kept, dropped } = filterSearchQueries(
      ["here", "find the next one", "this", "Buffalo Lodge"],
      ok(),
    );
    expect(kept).toEqual(["Buffalo Lodge"]);
    expect(dropped.sort()).toEqual(["find the next one", "here", "this"]);
  });
});

describe("validator — Gate 9 (external_url discipline)", () => {
  it("drops a Google Maps URL passed as candidateExternalUrl (positive)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "",
      candidateExternalUrl: "https://www.google.com/maps/place/Buffalo+Lodge",
    });
    expect(
      result.reasons.some(
        (r) => r.gate === 9 && r.detail.startsWith("dropped maps/search URL"),
      ),
    ).toBe(true);
  });

  it("keeps a normal event-page URL (negative)", () => {
    const result = validate({
      ir: ok(),
      rawSource: "",
      candidateExternalUrl: "https://www.blackroseacoustic.org/showcase",
    });
    expect(
      result.reasons.some((r) => r.gate === 9 && r.detail.startsWith("dropped maps")),
    ).toBe(false);
  });

  it("drops Google Search URLs", () => {
    const result = validate({
      ir: ok(),
      rawSource: "",
      candidateExternalUrl: "https://www.google.com/search?q=buffalo+lodge",
    });
    expect(
      result.reasons.some(
        (r) => r.gate === 9 && r.detail.startsWith("dropped maps/search URL"),
      ),
    ).toBe(true);
  });
});

describe("validator — model-output filtering (gates 3+4 applied to LLM questions)", () => {
  it("dropOutOfLedgerQuestions strips out-of-ledger and internal questions", () => {
    const ir = ok();
    ir.shared_facts.cost = null;
    const ledger = [{ field: "cost", reason: "what is the cover charge?" }];
    const modelQuestions = [
      { field: "cost", reason: "what is the cover charge?" },
      { field: "venue", reason: "what is the venue?" },
      { field: "x", reason: "FREQ= weekly?" },
    ];
    const filtered = dropOutOfLedgerQuestions(modelQuestions, ledger, ir, "Buffalo Lodge");
    expect(filtered).toEqual([{ field: "cost", reason: "what is the cover charge?" }]);
  });
});
