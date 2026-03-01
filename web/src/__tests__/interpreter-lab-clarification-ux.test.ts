/**
 * Phase 8C — Interpreter lab clarification UX tests.
 *
 * Source-code assertion tests verifying that the lab page:
 * 1. Shows field-specific input hint chips with format examples.
 * 2. Presents a single clear blocking question (not a wall of fields).
 * 3. Provides a clear "what to do next" callout after clarification.
 * 4. Preserves all existing Phase 8A/8B functionality unchanged.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const LAB_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
);
const labSource = fs.readFileSync(LAB_PATH, "utf-8");

// ---------------------------------------------------------------------------
// A) Field-specific input hint chips
// ---------------------------------------------------------------------------
describe("Phase 8C — field-specific input hint chips", () => {
  it("defines FIELD_INPUT_HINTS mapping for common fields", () => {
    expect(labSource).toContain("FIELD_INPUT_HINTS");
    expect(labSource).toContain("Record<string, { label: string; examples: string[] }>");
  });

  it("includes hints for time fields", () => {
    expect(labSource).toContain('start_time:');
    expect(labSource).toContain('"7:00 PM"');
    expect(labSource).toContain('end_time:');
  });

  it("includes hints for date fields", () => {
    expect(labSource).toContain('start_date:');
    expect(labSource).toContain('"2026-03-15"');
    expect(labSource).toContain('"next Tuesday"');
  });

  it("includes hints for venue/location fields", () => {
    expect(labSource).toContain('venue_id:');
    expect(labSource).toContain('"Dazzle Jazz"');
    expect(labSource).toContain('online_url:');
    expect(labSource).toContain("zoom.us");
  });

  it("includes hints for URL fields", () => {
    expect(labSource).toContain('external_url:');
    expect(labSource).toContain('signup_url:');
  });

  it("includes hints for title and event_type", () => {
    expect(labSource).toContain('title:');
    expect(labSource).toContain('"Open Mic Night"');
    expect(labSource).toContain('event_type:');
    expect(labSource).toContain('"open_mic"');
  });

  it("includes hints for capacity and cost", () => {
    expect(labSource).toContain('capacity:');
    expect(labSource).toContain('cost_label:');
    expect(labSource).toContain('"$10"');
  });

  it("defines getFieldHint helper function", () => {
    expect(labSource).toContain("function getFieldHint(field: string)");
    expect(labSource).toContain("FIELD_INPUT_HINTS[field]");
  });
});

// ---------------------------------------------------------------------------
// B) Clarification prompt renders hint chips per blocking field
// ---------------------------------------------------------------------------
describe("Phase 8C — clarification prompt renders hint chips", () => {
  it("maps over blocking_fields to render hint chips", () => {
    expect(labSource).toContain("responseGuidance.blocking_fields.map((field)");
  });

  it("calls getFieldHint for each blocking field", () => {
    expect(labSource).toContain("getFieldHint(field)");
  });

  it("renders field label as a styled chip", () => {
    // The hint label is displayed in a chip-style span
    expect(labSource).toContain("hint?.label ?? field.replace(/_/g");
    expect(labSource).toContain("bg-amber-500/15 text-amber-700");
  });

  it("shows example values when hint is available", () => {
    expect(labSource).toContain("hint.examples.join");
    expect(labSource).toContain('e.g. {hint.examples.join(", ")}');
  });

  it("falls back to humanized field name when no hint defined", () => {
    // Unknown fields show field name with underscores replaced by spaces
    expect(labSource).toContain('field.replace(/_/g, " ")');
  });
});

// ---------------------------------------------------------------------------
// C) Single-question-first presentation
// ---------------------------------------------------------------------------
describe("Phase 8C — single-question-first presentation", () => {
  it("renders clarification_question as primary text (not a label prefix)", () => {
    // The question text is rendered directly, not prefixed with "Question:"
    expect(labSource).toContain("responseGuidance.clarification_question");
    // Old pattern "Question:" label should be removed
    const oldQuestionLabel = '<span className="font-semibold">Question:</span>';
    expect(labSource).not.toContain(oldQuestionLabel);
  });

  it("uses leading-relaxed for readable question text", () => {
    expect(labSource).toContain("leading-relaxed");
  });

  it("provides fallback text when clarification_question is null", () => {
    expect(labSource).toContain("Please provide the missing details.");
  });
});

// ---------------------------------------------------------------------------
// D) Follow-up instruction callout
// ---------------------------------------------------------------------------
describe("Phase 8C — follow-up instruction callout", () => {
  it("shows a directional arrow indicator for next step", () => {
    expect(labSource).toContain("→");
    expect(labSource).toContain("text-amber-600");
  });

  it("instructs user to type answer and click Send Answer", () => {
    expect(labSource).toContain("Type your answer above");
    expect(labSource).toContain("Send Answer");
  });

  it("separates next step from question with a border", () => {
    expect(labSource).toContain("border-t border-amber-500/10");
  });
});

// ---------------------------------------------------------------------------
// E) Existing 8A/8B functionality preserved
// ---------------------------------------------------------------------------
describe("Phase 8C — existing functionality preserved", () => {
  it("preserves next_action badge rendering", () => {
    expect(labSource).toContain('responseGuidance.next_action.replace(/_/g, " ")');
  });

  it("preserves confidence display", () => {
    expect(labSource).toContain("Confidence:");
    expect(labSource).toContain("responseGuidance.confidence");
  });

  it("preserves Draft Summary section", () => {
    expect(labSource).toContain("Draft Summary");
  });

  it("preserves collapsible debug panel", () => {
    expect(labSource).toContain("Debug: Raw API Response");
    expect(labSource).toContain("<details");
  });

  it("preserves ready state green container", () => {
    expect(labSource).toContain("The draft is ready.");
    expect(labSource).toContain("bg-emerald-500/5");
  });

  it("preserves quality hints section", () => {
    expect(labSource).toContain("Suggestions");
    expect(labSource).toContain("quality_hints");
  });
});
