/**
 * INTERPRETER-14 — Host UX Polish source assertions.
 *
 * Verifies:
 * 1. Host title is "Create Happening with AI".
 * 2. Host subtitle and next-step callout keep the workflow clear.
 * 3. Host run button uses chat-style logic (Generate Draft / Send Answer / Send Message / Update Draft).
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
    expect(src).toContain("Draft ready");
    expect(src).toContain("save the private draft automatically");
  });
});

// ---------------------------------------------------------------------------
// B) Host run button — chat label logic
// ---------------------------------------------------------------------------
describe("INTERPRETER-14 — Host run button chat label", () => {
  it("host variant has dedicated chat label branch", () => {
    // The runActionLabel logic should check isHostVariant first
    expect(src).toContain("isHostVariant");
    // Host: ask_clarification → Send Answer, saved draft → Update Draft,
    // assistant response → Send Message, first turn → Generate Draft
    // Lab: ask_clarification → Send Answer, history > 0 → Update Draft, else → Generate Draft
  });

  it("host variant maps ask_clarification to 'Send Answer'", () => {
    expect(src).toContain('"Send Answer"');
  });

  it("host variant uses Update Draft after a draft exists", () => {
    expect(src).toContain("hasCreatedDraft");
    expect(src).toContain('"Update Draft"');
  });

  it("host variant uses Send Message after the first assistant response", () => {
    expect(src).toContain("hasAssistantResponse");
    expect(src).toContain('"Send Message"');
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
    expect(src).toContain("Check the card, cover, and key fields");
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
    expect(src).toContain("createdPublicHref");
    expect(src).toContain("Open draft preview");
    expect(src).toContain("border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]");
  });

  it("host flow autosaves private drafts and updates instead of requiring a second confirm click", () => {
    expect(src).toContain("await createEvent(nextInterpretResponse, { automatic: true })");
    expect(src).toContain("await applySeriesPatch(nextInterpretResponse, { automatic: true })");
    expect(src).toContain("!isHostVariant && canShowCreateAction && !createdEventId");
    expect(src).toContain("!isHostVariant && canShowSeriesPatchAction");
    expect(src).toContain("Draft result");
  });

  it("separates the draft summary from follow-up questions and publish guidance", () => {
    expect(src).toContain("followup_question");
    expect(src).toContain("Optional follow-up");
    expect(src).toContain("Please check the draft detail page linked below");
    expect(src).toContain("hit save and publish to make it live on the site");
    expect(src).toContain("bg-amber-500/10");
    expect(src).toContain("bg-cyan-500/10");
  });

  it("shows an actual listing card preview and preserves original cover aspect ratio", () => {
    expect(src).toContain("Listing card preview");
    expect(src).toContain("<HappeningCard");
    expect(src).toContain("buildDraftPreviewEvent");
    expect(src).toContain("object-contain");
    expect(src).toContain("Selected original cover candidate");
  });

  it("lets hosts switch a saved draft cover from staged images without re-uploading", () => {
    expect(src).toContain("handleCoverCandidateSelect");
    expect(src).toContain("applyCoverCandidate");
    expect(src).toContain("Use as cover");
    expect(src).toContain("Live cover");
    expect(src).toContain('broadcastEventDraftSync(targetEventId, "cover_updated")');
  });

  it("understands simple chat requests to use another staged image as the cover", () => {
    expect(src).toContain("findRequestedCoverCandidateId");
    expect(src).toContain("resolveNaturalLanguageImageReference");
    expect(src).toContain('referenceDecision.status === "selected"');
    expect(src).toContain("selected it below");
    expect(src).toContain("dismissesCoverImageChange");
  });

  it("keeps chat send controls above image attachment controls", () => {
    const textareaIdx = src.indexOf("<textarea");
    const sendButtonIdx = src.indexOf("runActionLabel", textareaIdx);
    const imageAreaIdx = src.indexOf("Image staging area");
    expect(sendButtonIdx).toBeGreaterThan(textareaIdx);
    expect(sendButtonIdx).toBeLessThan(imageAreaIdx);
  });

  it("defaults web search on and sends the preference to the interpreter", () => {
    expect(src).toContain("const [useWebSearch, setUseWebSearch] = useState(true)");
    expect(src).toContain("Use search to fill in missing details");
    expect(src).toContain("use_web_search: useWebSearch");
    expect(src).toContain("Default on. I will try to verify venue, time, cost, and recurrence before asking you.");
  });

  it("normalizes complex model recurrence output before writing drafts", () => {
    expect(src).toContain('import { normalizeDraftRecurrenceFields } from "@/lib/events/recurrenceDraftTools"');
    expect(src).toContain("normalizeDraftRecurrenceFields(body)");
  });

  it("normalizes generic event titles to venue-type names before writing drafts", () => {
    expect(src).toContain('import { applyVenueTypeTitleDefault } from "@/lib/events/interpreterPostprocess"');
    expect(src).toContain("normalizeTitleWithVenuePrefix");
    expect(src).toContain("venueName: resolvedVenueName");
  });

  it("supports image-only chat turns without blank user bubbles", () => {
    expect(src).toContain("message.trim() ||");
    expect(src).toContain("Attached an image.");
    expect(src).toContain("Attached ${stagedImages.length} images.");
  });

  it("auto-scrolls the host chat and surfaces attempted searches", () => {
    expect(src).toContain("chatEndRef");
    expect(src).toContain("scrollIntoView");
    expect(src).toContain("Search tried");
    expect(src).toContain("Searched online:");
  });

  it("shows relaxed in-chat progress feedback while the agent is working", () => {
    expect(src).toContain("Drafting this into shape. No action needed.");
    expect(src).toContain("Reading flyer text");
    expect(src).toContain("Checking dates and times");
    expect(src).toContain("Building private draft");
    expect(src).toContain("Working...");
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
    expect(src).toContain("Reply or request changes");
    expect(src).toContain("Ask me to search again");
  });
});
