/**
 * Phase 8B — Interpreter lab conversation UX tests.
 *
 * Source-code assertion tests verifying that the lab page:
 * 1. Makes human-readable guidance the primary display (not raw JSON).
 * 2. Collapses raw JSON into a debug-only disclosure panel.
 * 3. Shows a draft state summary block with key fields.
 * 4. Preserves all existing Phase 4A/4B/7 functionality unchanged.
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
// A) Human-readable guidance is primary
// ---------------------------------------------------------------------------
describe("Phase 8B — human-readable guidance is primary", () => {
  it("renders a review section with a user-facing readiness badge", () => {
    expect(labSource).toContain("Review Draft");
    expect(labSource).toContain("getDraftReadinessLabel(responseGuidance)");
  });

  it("renders user-facing confidence language when available", () => {
    expect(labSource).toContain("responseGuidance.confidence");
    expect(labSource).toContain("getConfidenceLabel(responseGuidance.confidence)");
  });

  it("renders human_summary as readable text", () => {
    expect(labSource).toContain("responseGuidance.human_summary");
  });

  it("shows an inline draft status panel near the input controls", () => {
    expect(labSource).toContain("Draft Status");
    expect(labSource).toContain("responseGuidance.next_action === \"ask_clarification\"");
  });

  it("shows clarification prompt in a styled container, not raw JSON", () => {
    // Clarification prompt wrapped in a visually distinct box
    expect(labSource).toContain("ask_clarification");
    expect(labSource).toContain("responseGuidance.clarification_question");
    // Phase 8C updated instruction text
    expect(labSource).toContain("Type your answer above");
  });

  it("shows ready state when draft is complete", () => {
    expect(labSource).toContain("Review the extracted fields below.");
    expect(labSource).toContain("Confirm & Create Draft below to save, then Publish Event to make it public");
  });

  it("renders quality hints when present", () => {
    expect(labSource).toContain("quality_hints");
    expect(labSource).toContain("Suggestions");
    expect(labSource).toContain("hint.field");
    expect(labSource).toContain("getQualityHintText(hint)");
  });

  it("renders online verification sources when the backend checked the web", () => {
    expect(labSource).toContain("web_search_verification");
    expect(labSource).toContain("Checked online");
    expect(labSource).toContain("ExternalLink");
    expect(labSource).toContain("source.domain || source.title || \"Source\"");
  });
});

// ---------------------------------------------------------------------------
// B) Raw JSON is in a collapsible debug panel
// ---------------------------------------------------------------------------
describe("Phase 8B — raw JSON is collapsible debug-only", () => {
  it("wraps raw JSON in a <details> disclosure element", () => {
    // The raw response is inside a <details> element
    expect(labSource).toContain("<details");
    expect(labSource).toContain("</details>");
  });

  it("labels the debug panel clearly", () => {
    expect(labSource).toContain("Debug: Raw API Response");
  });

  it("shows HTTP status code inside the summary", () => {
    expect(labSource).toContain("(HTTP {statusCode})");
  });

  it("raw JSON is NOT the primary display (no top-level Response heading)", () => {
    // The old pattern had an always-visible "Response" heading as a card section.
    // Now it's inside <details> with a different label.
    const responseHeadingPattern = /<h2[^>]*>Response<\/h2>/;
    expect(labSource).not.toMatch(responseHeadingPattern);
  });

  it("preserves JSON.stringify for debug content", () => {
    expect(labSource).toContain("JSON.stringify(responseBody, null, 2)");
  });
});

// ---------------------------------------------------------------------------
// C) Draft state summary block
// ---------------------------------------------------------------------------
describe("Phase 8B — draft state summary block", () => {
  it("renders a Draft Summary section", () => {
    expect(labSource).toContain("Draft Summary");
  });

  it("extracts key fields from draft_payload for display", () => {
    const summaryFields = [
      "d.title",
      "d.event_type",
      "d.start_date",
      "d.start_time",
      "d.end_time",
      "d.series_mode",
      "d.recurrence_rule",
      "d.venue_name",
      "d.venue_id",
      "d.location_mode",
      "d.signup_mode",
    ];
    for (const field of summaryFields) {
      expect(labSource).toContain(field);
    }
  });

  it("shows draft summary only when draft_payload is present", () => {
    expect(labSource).toContain("responseGuidance?.draft_payload");
  });

  it("uses a grid layout for label-value pairs", () => {
    expect(labSource).toContain("grid grid-cols-[auto_1fr]");
  });

  it("truncates long description values", () => {
    expect(labSource).toContain('.slice(0, 120)');
  });
});

// ---------------------------------------------------------------------------
// D) ResponseGuidance type includes new 8B fields
// ---------------------------------------------------------------------------
describe("Phase 8B — ResponseGuidance type expansion", () => {
  it("includes confidence in ResponseGuidance", () => {
    expect(labSource).toContain("confidence: number | null");
  });

  it("includes draft_payload in ResponseGuidance", () => {
    expect(labSource).toContain("draft_payload: Record<string, unknown> | null");
  });

  it("includes quality_hints in ResponseGuidance", () => {
    expect(labSource).toContain("quality_hints: QualityHint[]");
  });

  it("includes web search verification in ResponseGuidance", () => {
    expect(labSource).toContain("interface WebSearchVerification");
    expect(labSource).toContain("web_search_verification: WebSearchVerification | null");
    expect(labSource).toContain("parseWebSearchVerification");
  });

  it("defines QualityHint interface", () => {
    expect(labSource).toContain("interface QualityHint");
    expect(labSource).toContain("field: string");
    expect(labSource).toContain("prompt?: string");
  });
});

// ---------------------------------------------------------------------------
// E) Existing functionality preserved
// ---------------------------------------------------------------------------
describe("Phase 8B — existing functionality preserved", () => {
  it("preserves conversation history display", () => {
    expect(labSource).toContain("Conversation History");
    expect(labSource).toContain("conversationHistory.map");
  });

  it("preserves create action button", () => {
    expect(labSource).toContain("Confirm & Create Draft");
    expect(labSource).toContain("canShowCreateAction");
  });

  it("uses clearer run button labels for turn-based flow", () => {
    expect(labSource).toContain("Generate Draft");
    expect(labSource).toContain("Update Draft");
    expect(labSource).toContain("Send Answer");
  });

  it("preserves cover apply button", () => {
    expect(labSource).toContain("Apply as Cover");
    expect(labSource).toContain("canShowCoverControls");
  });

  it("preserves LAB_WRITES_ENABLED feature flag", () => {
    expect(labSource).toContain("LAB_WRITES_ENABLED");
    expect(labSource).toContain("NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES");
  });

  it("preserves image staging", () => {
    expect(labSource).toContain("stagedImages");
    expect(labSource).toContain("+ Add image");
  });

  it("preserves locked_draft multi-turn context", () => {
    expect(labSource).toContain("locked_draft");
    expect(labSource).toContain("lastInterpretResponse.draft_payload");
  });
});
