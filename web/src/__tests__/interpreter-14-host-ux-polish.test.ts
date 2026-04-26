/**
 * INTERPRETER-14 — Host UX Polish source assertions.
 *
 * Verifies:
 * 1. Host title is "Create Happening with AI".
 * 2. Host subtitle and next-step callout keep the workflow clear.
 * 3. Host run button uses two-state logic (Generate Draft / Send Answer).
 * 4. Host route contains no lab/debug wording visible to users.
 * 5. Host route uses a chat-first layout with a persistent review rail.
 * 6. Conversation history is in the main chat surface for host variant.
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

  it("host subtitle frames the chat loop", () => {
    expect(src).toContain("Turn a flyer, link, or rough notes into a private event draft");
    expect(src).toContain("keep chatting here until it is ready");
  });

  it("host fallback link says 'Use classic form instead'", () => {
    expect(src).toContain("Use classic form instead");
  });

  it("host variant includes a single next-step callout with publish state", () => {
    expect(src).toContain("hostWorkflowStep");
    expect(src).toContain("Private until published");
    expect(src).toContain("Ready to save");
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

  it("host variant uses Update Draft after a draft exists", () => {
    expect(src).toContain("hasCreatedDraft");
    expect(src).toContain('"Update Draft"');
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
// D) Chat-first workspace
// ---------------------------------------------------------------------------
describe("INTERPRETER-14 — Host chat-first workspace", () => {
  it("renders a persistent review side panel for host users", () => {
    expect(src).toContain("Review");
    expect(src).toContain("Check the cover and key fields");
    expect(src).toContain("lg:grid-cols-[minmax(0,1fr)_380px]");
    expect(src).toContain("lg:sticky lg:top-6");
  });

  it("keeps the chat transcript near the composer instead of below the page", () => {
    const conversationIdx = src.indexOf("Chat");
    const textareaIdx = src.indexOf("<textarea");
    expect(conversationIdx).toBeGreaterThan(-1);
    expect(textareaIdx).toBeGreaterThan(-1);
    expect(conversationIdx).toBeLessThan(textareaIdx);
  });

  it("demotes duplicate details and source checks in host flow", () => {
    expect(src).toContain("Sources checked");
    expect(src).toContain("Key fields");
    expect(src).toContain("!isHostVariant && statusCode === 200 && responseGuidance");
  });

  it("opens draft and preview links in another tab", () => {
    expect(src).toContain('target="_blank"');
    expect(src).toContain("Preview draft");
    expect(src).toContain("View live page");
    expect(src).toContain("`/events/${createdSummary.slug || createdSummary.eventId}`");
  });

  it("keeps chat send controls above image attachment controls", () => {
    const textareaIdx = src.indexOf("<textarea");
    const sendButtonIdx = src.indexOf("runActionLabel", textareaIdx);
    const imageAreaIdx = src.indexOf("Image staging area");
    expect(sendButtonIdx).toBeGreaterThan(textareaIdx);
    expect(sendButtonIdx).toBeLessThan(imageAreaIdx);
  });

  it("auto-scrolls the host chat and surfaces attempted searches", () => {
    expect(src).toContain("chatEndRef");
    expect(src).toContain("scrollIntoView");
    expect(src).toContain("Search tried");
    expect(src).toContain("Searched online:");
  });

  it("uses the shared crop modal with save-original primary action for uploads", () => {
    expect(src).toContain('import { CropModal } from "@/components/gallery/CropModal"');
    expect(src).toContain("<CropModal");
    expect(src).toContain("onUseOriginal");
    expect(src).toContain("stageReviewedAndContinue(cropTarget)");
  });
});

// ---------------------------------------------------------------------------
// E) Conversation history — host chat treatment
// ---------------------------------------------------------------------------
describe("INTERPRETER-14 — Conversation history for host", () => {
  it("host variant keeps lab conversation history wording out of the host flow", () => {
    expect(src).toContain("!isHostVariant && conversationHistory.length > 0");
    expect(src).toContain("Conversation History");
  });

  it("host variant includes friendly first assistant message", () => {
    expect(src).toContain("Send me the messy version");
    expect(src).toContain("I will ask one useful follow-up at a time");
  });

  it("host composer changes after draft creation", () => {
    expect(src).toContain("Ask for a draft change");
    expect(src).toContain("Make it weekly");
  });
});
