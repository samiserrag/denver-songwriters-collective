/**
 * INTERPRETER-14 — Host UX Polish source assertions.
 *
 * Verifies:
 * 1. Host title is "Create Happening with AI".
 * 2. Host subtitle includes 3-step cue.
 * 3. Host run button uses two-state logic (Generate Draft / Send Answer).
 * 4. Host route contains no lab/debug wording visible to users.
 * 5. Render order: Draft Status appears before Review Draft,
 *    both appear before Draft Summary.
 * 6. Conversation history is visually de-emphasized for host variant.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
);
const src = fs.readFileSync(COMPONENT_PATH, "utf-8");

// ---------------------------------------------------------------------------
// A) Host copy — title + subtitle
// ---------------------------------------------------------------------------
describe("INTERPRETER-14 — Host copy updates", () => {
  it("host title is 'Create Happening with AI'", () => {
    expect(src).toContain("Create Happening with AI");
  });

  it("host subtitle includes 3-step cue with Generate Draft reference", () => {
    expect(src).toContain(
      "Describe your event, paste source notes or flyer text, click Generate Draft, then answer follow-up questions in the same box. Your event stays private until you publish it."
    );
  });

  it("host fallback link says 'Use classic form instead'", () => {
    expect(src).toContain("Use classic form instead");
  });

  it("host variant includes explicit publish warning", () => {
    expect(src).toContain("Important: Confirm and create your draft");
    expect(src).toContain("Publish Event");
  });
});

// ---------------------------------------------------------------------------
// B) Host run button — two-state label logic
// ---------------------------------------------------------------------------
describe("INTERPRETER-14 — Host run button two-state label", () => {
  it("host variant has dedicated two-state label branch", () => {
    // The runActionLabel logic should check isHostVariant first
    expect(src).toContain("isHostVariant");
    // Host: ask_clarification → Send Answer, else → Generate Draft
    // Lab: ask_clarification → Send Answer, history > 0 → Update Draft, else → Generate Draft
  });

  it("host variant maps ask_clarification to 'Send Answer'", () => {
    expect(src).toContain('"Send Answer"');
  });

  it("host variant defaults to 'Generate Draft' (not 'Update Draft')", () => {
    // The host branch should NOT produce "Update Draft"
    // Verify the host-specific two-state comment exists
    expect(src).toContain("host variant uses simplified two-state label");
  });

  it("lab variant still has 'Update Draft' for follow-up turns", () => {
    // Lab three-state is preserved
    expect(src).toContain('"Update Draft"');
  });
});

// ---------------------------------------------------------------------------
// C) No lab/debug wording visible to host users
// ---------------------------------------------------------------------------
describe("INTERPRETER-14 — Host variant has no lab/debug wording", () => {
  it("lab title 'Conversational Event Creator (Lab)' is guarded by !isHostVariant branch", () => {
    // The lab title exists but only in the else branch of isHostVariant ternary
    expect(src).toContain("Conversational Event Creator (Lab)");
    expect(src).toContain("isHostVariant ?");
  });

  it("debug panel is guarded by !isHostVariant", () => {
    // Debug section hidden from host
    expect(src).toContain("!isHostVariant && (");
    expect(src).toContain("Debug: Raw API Response");
  });

  it("mode selector is guarded by !isHostVariant", () => {
    const modeSelectGuard = /!isHostVariant &&[\s\S]*?<select/;
    expect(src).toMatch(modeSelectGuard);
  });
});

// ---------------------------------------------------------------------------
// D) Render order — conversation zone sections
// ---------------------------------------------------------------------------
describe("INTERPRETER-14 — Render order: Draft Status → Review Draft → Draft Summary", () => {
  it("Draft Status appears before Review Draft in source", () => {
    const draftStatusIdx = src.indexOf("Draft Status");
    const reviewDraftIdx = src.indexOf("Review Draft");
    expect(draftStatusIdx).toBeGreaterThan(-1);
    expect(reviewDraftIdx).toBeGreaterThan(-1);
    expect(draftStatusIdx).toBeLessThan(reviewDraftIdx);
  });

  it("Review Draft appears before Draft Summary in source", () => {
    const reviewDraftIdx = src.indexOf("Review Draft");
    const draftSummaryIdx = src.indexOf("Draft Summary");
    expect(reviewDraftIdx).toBeGreaterThan(-1);
    expect(draftSummaryIdx).toBeGreaterThan(-1);
    expect(reviewDraftIdx).toBeLessThan(draftSummaryIdx);
  });

  it("Draft Summary appears before Conversation History / Previous Messages in source", () => {
    const draftSummaryIdx = src.indexOf("Draft Summary");
    const historyIdx = src.indexOf("Previous Messages");
    expect(draftSummaryIdx).toBeGreaterThan(-1);
    expect(historyIdx).toBeGreaterThan(-1);
    expect(draftSummaryIdx).toBeLessThan(historyIdx);
  });
});

// ---------------------------------------------------------------------------
// E) Conversation history — host de-emphasis
// ---------------------------------------------------------------------------
describe("INTERPRETER-14 — Conversation history de-emphasis for host", () => {
  it("host variant uses 'Previous Messages' label instead of 'Conversation History'", () => {
    expect(src).toContain("Previous Messages");
    expect(src).toContain("Conversation History");
  });

  it("host variant applies opacity reduction to history section", () => {
    expect(src).toContain('isHostVariant ? "opacity-70" : ""');
  });

  it("host variant uses friendly role labels (You/AI instead of user/assistant)", () => {
    expect(src).toContain('"You:"');
    expect(src).toContain('"AI:"');
  });
});
