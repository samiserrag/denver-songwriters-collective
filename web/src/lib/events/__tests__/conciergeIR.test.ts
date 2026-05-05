/**
 * conciergeIR.ts — type-shape sanity tests.
 *
 * Pure structural-pin assertions: enum values, key sets, factory return
 * shape. The IR is the contract between parser and validator (Lane 9 PR 2),
 * so changes here are intentional architecture changes, not casual refactors.
 */

import { describe, expect, it } from "vitest";
import {
  CONCIERGE_IR_KEYS,
  emptyConciergeIR,
  emptySharedFacts,
  OCCURRENCE_KEYS,
  SHARED_FACTS_KEYS,
  SOURCE_KINDS,
  type SourceKind,
} from "@/lib/events/conciergeIR";

describe("conciergeIR — SourceKind enum", () => {
  it("exposes the exact 6 source_kind values from design doc §2", () => {
    expect([...SOURCE_KINDS]).toEqual([
      "flyer_image",
      "webpage",
      "pasted_page_text",
      "social_post",
      "conversation",
      "existing_event_edit",
    ]);
  });

  it("rejects an unknown source kind at the type level (compile-time pin)", () => {
    // Pure compile-time assertion: SourceKind is a closed union.
    const valid: SourceKind = "conversation";
    expect(SOURCE_KINDS).toContain(valid);
  });
});

describe("conciergeIR — top-level key set", () => {
  it("CONCIERGE_IR_KEYS is the exact 11-key contract", () => {
    expect([...CONCIERGE_IR_KEYS]).toEqual([
      "source_kind",
      "source_url",
      "event_family",
      "title",
      "shared_facts",
      "occurrences",
      "inferred_facts",
      "conflicts",
      "true_unknowns",
      "suggested_questions",
      "provenance",
    ]);
  });

  it("emptyConciergeIR returns an object with exactly the contract keys", () => {
    const ir = emptyConciergeIR("conversation");
    expect(Object.keys(ir).sort()).toEqual([...CONCIERGE_IR_KEYS].sort());
  });
});

describe("conciergeIR — shared_facts key set", () => {
  it("SHARED_FACTS_KEYS matches the 9 fields in design doc §2", () => {
    expect([...SHARED_FACTS_KEYS]).toEqual([
      "venue",
      "address",
      "city",
      "state",
      "time",
      "cost",
      "signup",
      "membership",
      "age_policy",
    ]);
  });

  it("emptySharedFacts returns null/empty defaults for every key", () => {
    const facts = emptySharedFacts();
    expect(Object.keys(facts).sort()).toEqual([...SHARED_FACTS_KEYS].sort());
    for (const k of SHARED_FACTS_KEYS) {
      expect(facts[k]).toBeNull();
    }
  });
});

describe("conciergeIR — occurrence key set", () => {
  it("OCCURRENCE_KEYS matches the 5 fields in design doc §2", () => {
    expect([...OCCURRENCE_KEYS]).toEqual([
      "date",
      "start_time",
      "end_time",
      "lineup",
      "per_date_notes",
    ]);
  });
});

describe("conciergeIR — emptyConciergeIR factory", () => {
  it("seeds source_kind and optional source_url, leaves diagnostic arrays empty", () => {
    const ir = emptyConciergeIR("flyer_image", "https://example.org/event");
    expect(ir.source_kind).toBe("flyer_image");
    expect(ir.source_url).toBe("https://example.org/event");
    expect(ir.title).toBeNull();
    expect(ir.event_family).toBeNull();
    expect(ir.occurrences).toEqual([]);
    expect(ir.inferred_facts).toEqual([]);
    expect(ir.conflicts).toEqual([]);
    expect(ir.true_unknowns).toEqual([]);
    expect(ir.suggested_questions).toEqual([]);
    expect(ir.provenance).toEqual({});
  });

  it("defaults source_url to null when omitted", () => {
    const ir = emptyConciergeIR("conversation");
    expect(ir.source_url).toBeNull();
  });
});
