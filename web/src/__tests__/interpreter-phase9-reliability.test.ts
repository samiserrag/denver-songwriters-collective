/**
 * Phase 9B — Interpreter content reliability hardening tests.
 *
 * Source-code assertion tests verifying:
 * 1. Creative title extraction third pass in deriveTitleFromText.
 * 2. Expanded time patterns (DOORS + PERFORMANCE_START).
 * 3. Reverse venue/custom exclusivity block using venueResolution.status.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { shouldSuppressDraftVerifierIssue } from "@/lib/events/interpreterPostprocess";

const INTERPRET_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/events/interpret/route.ts"
);
const interpretRouteSource = fs.readFileSync(INTERPRET_ROUTE_PATH, "utf-8");

const POSTPROCESS_PATH = path.resolve(
  __dirname,
  "../lib/events/interpreterPostprocess.ts"
);
const postprocessSource = fs.readFileSync(POSTPROCESS_PATH, "utf-8");

// Track 1 PR 5: prompt envelope build moved into aiPromptContract.ts. The
// route still owns wiring; literal contract strings are owned by the lib.
const PROMPT_CONTRACT_PATH = path.resolve(
  __dirname,
  "../lib/events/aiPromptContract.ts"
);
const promptContractSource = fs.readFileSync(PROMPT_CONTRACT_PATH, "utf-8");
const combinedInterpretSource = `${interpretRouteSource}\n${promptContractSource}`;

// ---------------------------------------------------------------------------
// A) Creative title extraction
// ---------------------------------------------------------------------------
describe("Phase 9B — creative title extraction", () => {
  it("deriveTitleFromText has creative-title pass for capitalized short lines", () => {
    // Should check for first short capitalized line (2-8 words, starts with capital)
    expect(interpretRouteSource).toContain("creative title");
    expect(interpretRouteSource).toMatch(/words\.length\s*>=\s*2/);
    expect(interpretRouteSource).toMatch(/words\.length\s*<=\s*8/);
    expect(interpretRouteSource).toMatch(/\/\^?\[A-Z\]/);
  });

  it("excludes lines that look like URLs, times, or dates", () => {
    expect(interpretRouteSource).toContain("https?:\\/\\/");
    expect(interpretRouteSource).toContain("\\d{1,2}:\\d{2}");
    expect(interpretRouteSource).toContain("\\d{4}-\\d{2}-\\d{2}");
  });
});

// ---------------------------------------------------------------------------
// B) Time pattern coverage
// ---------------------------------------------------------------------------
describe("Phase 9B — time pattern expansion", () => {
  it("PERFORMANCE_START_PATTERN matches 'set' and 'acts?'", () => {
    expect(postprocessSource).toMatch(/PERFORMANCE_START_PATTERN/);
    expect(postprocessSource).toMatch(/set\|acts?\?/);
  });

  it("DOORS_PATTERN matches 'doors open at' variant", () => {
    expect(postprocessSource).toMatch(/DOORS_PATTERN/);
    // Pattern should include optional "open" group
    expect(postprocessSource).toContain("open");
  });
});

// ---------------------------------------------------------------------------
// C) Reverse venue/custom exclusivity
// ---------------------------------------------------------------------------
describe("Phase 9B — reverse venue/custom exclusivity", () => {
  it("route.ts has reverse cleanup block keyed on venueResolution outcome", () => {
    expect(interpretRouteSource).toContain("Reverse venue/custom exclusivity");
    // Uses venueResolution resolved status as the authoritative signal
    expect(interpretRouteSource).toContain('venueResolution?.status === "resolved"');
    expect(interpretRouteSource).toContain("venueWasResolved");
  });

  it("reverse block checks custom_location_name AND venue_id before clearing", () => {
    // Extract the reverse exclusivity block
    const blockStart = interpretRouteSource.indexOf("Reverse venue/custom exclusivity");
    const blockSection = interpretRouteSource.slice(blockStart, blockStart + 1000);
    expect(blockSection).toContain("custom_location_name");
    expect(blockSection).toContain("venue_id");
    // Clears stale venue_id
    expect(blockSection).toContain("sanitizedDraft.venue_id = null");
    expect(blockSection).toContain("sanitizedDraft.venue_name = null");
  });

  it("enforceVenueCustomExclusivity in interpreterPostprocess.ts remains forward-only (unchanged)", () => {
    // enforceVenueCustomExclusivity should clear custom fields when venue_id is present (forward)
    // but should NOT contain reverse logic keyed on venueResolution.status
    const fnStart = postprocessSource.indexOf("enforceVenueCustomExclusivity");
    const fnSection = postprocessSource.slice(fnStart, fnStart + 1000);
    expect(fnSection).not.toContain("venueResolution");
  });

  it("forward case preserved: venue_id set clears custom fields", () => {
    const fnStart = postprocessSource.indexOf("enforceVenueCustomExclusivity");
    const fnSection = postprocessSource.slice(fnStart, fnStart + 1000);
    expect(fnSection).toContain("venue_id");
    expect(fnSection).toContain("custom_location_name");
  });
});

// ---------------------------------------------------------------------------
// D) OCR recurrence guard
// ---------------------------------------------------------------------------
describe("Phase 9B — OCR recurrence guard", () => {
  it("postprocess includes OCR recurrence hint helpers", () => {
    expect(postprocessSource).toContain("deriveRecurrenceHintFromText");
    expect(postprocessSource).toContain("applyRecurrenceHintFromExtractedText");
    expect(postprocessSource).toContain("OCR_RECURRENCE_CONFIDENCE_THRESHOLD");
    expect(postprocessSource).toContain("monthly(?:\\s+on)?\\s+the");
  });

  it("route applies OCR recurrence hint before recurrence downgrade guard", () => {
    const hardenStart = interpretRouteSource.indexOf("function hardenDraftForCreateEdit");
    const hardenSection = interpretRouteSource.slice(hardenStart, hardenStart + 4200);
    expect(hardenSection).toContain("applyRecurrenceHintFromExtractedText");
    expect(hardenSection).toContain("detectsRecurrenceIntent(");
    expect(hardenSection).toContain("extractionConfidence");
  });

  it("route passes extraction confidence into hardening", () => {
    expect(interpretRouteSource).toContain("extractionConfidence: extractionMetadata?.confidence");
  });
});

// ---------------------------------------------------------------------------
// E) Event-type/category reliability
// ---------------------------------------------------------------------------
describe("Phase 9B — event-type reliability", () => {
  it("postprocess includes deterministic event-type hint helpers", () => {
    expect(postprocessSource).toContain("deriveEventTypeHint");
    expect(postprocessSource).toContain("applyEventTypeHint");
    expect(postprocessSource).toContain("EVENT_TYPE_SIGNAL_PATTERNS");
  });

  it("postprocess preserves multi-type and genre intent", () => {
    expect(postprocessSource).toContain("deriveEventTypesFromText");
    expect(postprocessSource).toContain("irish");
    expect(postprocessSource).toContain("blues");
    expect(postprocessSource).toContain("bluegrass");
    expect(postprocessSource).toContain("\\bpoem(?:s)?\\b");
    expect(postprocessSource).toContain("\\bslam\\b");
    expect(postprocessSource).toContain("[...new Set([...hints, ...existingEventTypes])]");
  });

  it("route applies event-type hints in hardening and again after locked draft merge", () => {
    expect(interpretRouteSource).toContain("applyEventTypeHint({");
    const createMergeSectionStart = interpretRouteSource.indexOf("mergeLockedCreateDraft({");
    const createMergeSection = interpretRouteSource.slice(createMergeSectionStart, createMergeSectionStart + 800);
    expect(createMergeSection).toContain("applyEventTypeHint");
  });

  it("system prompt now instructs showcase/open_mic type correctness", () => {
    expect(interpretRouteSource).toContain("if user says showcase, use showcase");
  });

  it("system prompt includes event-ops safety rules from the browser agent playbook", () => {
    expect(interpretRouteSource).toContain("Do not invent facts");
    expect(interpretRouteSource).toContain("Never put Google Maps links in external_url");
    expect(interpretRouteSource).toContain("external_url is optional and can stay null");
    expect(interpretRouteSource).toContain("Only enable performer slots when explicitly requested");
    expect(interpretRouteSource).toContain("For gig events, do not add signup_time or performer slots unless explicitly requested");
    expect(interpretRouteSource).toContain("Default timezone to America/Denver");
    expect(interpretRouteSource).toContain("friendly, and lightly encouraging");
  });

  it("system prompt requires strong event-ops judgment before asking questions", () => {
    expect(interpretRouteSource).toContain("Work like a strong event-ops assistant");
    expect(interpretRouteSource).toContain("Do not ask for information that can be reasonably inferred");
    expect(interpretRouteSource).toContain("Prefer one well-reasoned draft plus a concise note about assumptions");
    expect(interpretRouteSource).toContain("Do not claim you searched the web or verified online unless an explicit tool result");
  });

  it("system prompt and route provide current-date guidance for flyer edge cases", () => {
    expect(interpretRouteSource).toContain("current_date");
    expect(interpretRouteSource).toContain("America/Denver");
    expect(interpretRouteSource).toContain("Never draft a date strictly before current_date for a new create-mode event");
    expect(interpretRouteSource).toContain("Flyer dates often omit a year");
    expect(interpretRouteSource).toContain("applyFutureDateGuard");
  });

  it("strips optional external-url asks from non-blocking summaries", () => {
    expect(interpretRouteSource).toContain("stripOptionalExternalUrlAskFromSummary");
    expect(interpretRouteSource).toContain('resolvedNextAction !== "ask_clarification"');
    expect(interpretRouteSource).toContain('!resolvedBlockingFields.includes("external_url")');
  });

  it("runs an internal draft verifier before showing create or saved-draft previews", () => {
    expect(interpretRouteSource).toContain("DEFAULT_DRAFT_VERIFIER_MODEL");
    expect(interpretRouteSource).toContain("verifyDraftWithCritic");
    expect(interpretRouteSource).toContain("buildDraftVerifierPrompt");
    expect(interpretRouteSource).toContain("draft_verification");
    expect(interpretRouteSource).toContain("applyDraftVerifierPatches");
    expect(interpretRouteSource).toContain("patch_contract");
    expect(interpretRouteSource).toContain("highRiskVerificationIssue");
    expect(interpretRouteSource).toContain('(mode === "create" || mode === "edit_series")');
  });

  it("runs optional online search verification before GPT-5.4 nano drafting", () => {
    expect(interpretRouteSource).toContain("Phase A2 — Optional online event verification");
    expect(interpretRouteSource).toContain("shouldAttemptEventWebSearch");
    expect(interpretRouteSource).toContain('type: "web_search"');
    expect(interpretRouteSource).toContain('include: ["web_search_call.action.sources"]');
    expect(interpretRouteSource).toContain("web_search_verification");
    expect(interpretRouteSource).toContain("OPENAI_EVENT_WEB_SEARCH_ENABLED");
    expect(interpretRouteSource).toContain('const DEFAULT_WEB_SEARCH_VERIFIER_MODEL = "gpt-5.4-nano"');
    expect(interpretRouteSource).toContain("OPENAI_EVENT_WEB_SEARCH_MODEL");
    expect(interpretRouteSource).toContain("Run multiple targeted search angles");
    expect(interpretRouteSource).toContain("OPENAI_EVENT_WEB_SEARCH_REASONING_EFFORT");
  });

  it("does not treat similar-but-not-exact search results as verification", () => {
    expect(interpretRouteSource).toContain("isNonExactEventSearchResult");
    expect(interpretRouteSource).toContain("web search verification ignored non-exact event result");
    expect(interpretRouteSource).toContain("Set event_search.status to verified only when at least one source appears to describe the exact same event");
    expect(interpretRouteSource).toContain("Set venue_search.status to verified when an official venue/source reliably confirms");
    expect(interpretRouteSource).toContain("similar venue, similar jam, different city, different date, or unrelated event");
  });

  it("uses venue-type titles for generic events while preserving named flyer events", () => {
    expect(interpretRouteSource).toContain("prefer the public title format 'Venue Name - Type'");
    expect(interpretRouteSource).toContain("Preserve distinct named events");
    expect(interpretRouteSource).toContain("applyVenueTypeTitleDefault");
    expect(postprocessSource).toContain("applyVenueTypeTitleDefault");
  });

  it("keeps sign-up time separate from public performance start time", () => {
    expect(interpretRouteSource).toContain("If a flyer separates sign-up/check-in from performances");
    expect(postprocessSource).toContain("SIGNUP_TIME_PATTERN");
    expect(postprocessSource).toContain("PERFORMANCE_RANGE_PATTERN");
  });

  it("feeds sourced web facts into both draft and verifier prompts", () => {
    expect(interpretRouteSource).toContain("webSearchVerification");
    // PR 5: web_search_note literal moved into aiPromptContract.ts
    // (buildAiPromptUserEnvelope). The verifier prompt literals remain in
    // the route since the verifier prompt is not part of the §13.2
    // prompt-contract surface.
    expect(combinedInterpretSource).toContain("Use sourced facts and confidence buckets to reduce unnecessary questions");
    expect(interpretRouteSource).toContain("Check the draft against source_message, extracted_image_text, web_search_verification");
    expect(combinedInterpretSource).toContain("Venue enrichment and exact-event verification are separate");
  });

  it("passes attempted no-result searches through when the user explicitly asks", () => {
    expect(interpretRouteSource).toContain("isExplicitEventWebSearchRequest");
    expect(interpretRouteSource).toContain("explicitEventWebSearchRequestFromTurn");
    expect(interpretRouteSource).toContain("returnNoReliableResult");
    expect(interpretRouteSource).toContain("locked_draft: input.lockedDraft ?? null");
    expect(interpretRouteSource).toContain("current_event: input.currentEvent ?? null");
    expect(interpretRouteSource).toContain("which venue/event searches were attempted");
  });

  it("does not silently drop explicit search requests when web search cannot produce sources", () => {
    expect(interpretRouteSource).toContain("buildNoReliableWebSearchResult");
    expect(interpretRouteSource).toContain('tool_choice: "required"');
    expect(interpretRouteSource).toContain("runWebSearchCategory");
    expect(interpretRouteSource).toContain("runFastVenueSearchCategory");
    expect(interpretRouteSource).toContain("combineWebSearchCategoryAttempts");
    expect(interpretRouteSource).toContain("const ROUTE_SAFETY_MARGIN_MS = 8_000");
    expect(interpretRouteSource).toContain("const WEB_SEARCH_TIMEOUT_MS = 100_000");
    expect(interpretRouteSource).toContain("const FAST_VENUE_WEB_SEARCH_TIMEOUT_MS = 50_000");
    expect(interpretRouteSource).toContain("const VENUE_WEB_SEARCH_TIMEOUT_MS = 40_000");
    expect(interpretRouteSource).toContain("const EVENT_WEB_SEARCH_TIMEOUT_MS = 50_000");
    expect(interpretRouteSource).toContain("const OPTIONAL_EVENT_WEB_SEARCH_TIMEOUT_MS = 40_000");
    expect(interpretRouteSource).toContain("const INTERPRETER_TIMEOUT_MS = 100_000");
    expect(interpretRouteSource).toContain("const INTERPRETER_MIN_USEFUL_TIMEOUT_MS = 25_000");
    expect(interpretRouteSource).toContain("const WEB_SEARCH_INTERPRETER_RESERVE_MS = INTERPRETER_MIN_USEFUL_TIMEOUT_MS");
    expect(interpretRouteSource).toContain("const DRAFT_VERIFIER_TIMEOUT_MS = 8_000");
    expect(interpretRouteSource).toContain("getBoundedStepTimeoutMs");
    expect(interpretRouteSource).toContain("getSearchTimeoutForRemainingBudget");
    expect(interpretRouteSource).toContain('venueAttempt.categoryResult.status !== "timeout"');
    expect(interpretRouteSource).toContain("webSearchTimedOutCompletely");
    expect(interpretRouteSource).toContain("buildAllSearchTimeoutInterpreterFallback");
    expect(interpretRouteSource).toContain("canRunDraftVerifier");
    expect(interpretRouteSource).toContain("export const maxDuration = 120");
    expect(interpretRouteSource).toContain("web search category skipped after upstream error");
    expect(interpretRouteSource).toContain("returned no usable verification text");
    expect(interpretRouteSource).toContain("did not return readable structured verification details");
    expect(interpretRouteSource).toContain("Search timed out before returning reliable venue or exact-event sources");
  });

  it("keeps optional follow-up copy separate from the result summary", () => {
    expect(interpretRouteSource).toContain("followup_question");
    expect(interpretRouteSource).toContain("buildOptionalDraftFollowup");
    expect(interpretRouteSource).not.toContain("appendOptionalDraftFollowup");
  });

  it("tolerates model JSON wrapped in prose or fenced blocks", () => {
    expect(interpretRouteSource).toContain("function parseJsonFromResponseText");
    expect(interpretRouteSource).toContain("const parsed = parseJsonFromResponseText(outputText)");
    expect(interpretRouteSource).toContain("fenced");
    expect(interpretRouteSource).toContain("trimmed.slice(start, end + 1)");
  });

  it("does not ask users for raw event_type when categories or source text already imply it", () => {
    expect(interpretRouteSource).toContain("ensureEventTypeFromDraftSignals");
    expect(interpretRouteSource).toContain("CATEGORY_TO_EVENT_TYPE");
    expect(interpretRouteSource).toContain("What kind of happening is this?");
  });

  it("supports default-on host web search without relying on magic user wording", () => {
    expect(interpretRouteSource).toContain("body.use_web_search !== false");
    expect(interpretRouteSource).toContain("const shouldUseWebSearch = useWebSearch || explicitWebSearchRequest");
    expect(interpretRouteSource).toContain("input.useWebSearch && combined.trim().length >= 20");
    expect(interpretRouteSource).toContain("returnNoReliableResult: explicitWebSearchRequest");
  });

  it("gives the model a deterministic recurrence contract for unsupported schedules", () => {
    expect(interpretRouteSource).toContain("Recurrence contract: use series_mode single");
    expect(interpretRouteSource).toContain("custom for irregular schedules, multiple weekdays");
    expect(interpretRouteSource).toContain("Do not output vague series_mode values like recurring");
  });

  it("allows explicit web search during saved-draft editing loops", () => {
    const searchTriggerStart = interpretRouteSource.indexOf("function shouldAttemptEventWebSearch");
    const searchTriggerSection = interpretRouteSource.slice(searchTriggerStart, searchTriggerStart + 600);
    expect(searchTriggerSection).toContain('input.mode !== "create" && input.mode !== "edit_series"');
  });

  it("does not trigger web search solely from relative-date wording", () => {
    const searchTriggerStart = interpretRouteSource.indexOf("function shouldAttemptEventWebSearch");
    const searchTriggerSection = interpretRouteSource.slice(searchTriggerStart, searchTriggerStart + 1400);
    expect(searchTriggerSection).not.toContain("upcoming|next");
    expect(searchTriggerSection).not.toContain("today|tonight|tomorrow");
  });

  it("does not trigger web search solely because OCR found event-like text", () => {
    const searchTriggerStart = interpretRouteSource.indexOf("function shouldAttemptEventWebSearch");
    const searchTriggerSection = interpretRouteSource.slice(searchTriggerStart, searchTriggerStart + 1400);
    expect(searchTriggerSection).not.toContain("input.extractedImageText &&");
    expect(searchTriggerSection).not.toContain("open mic|jam|slam");
  });

  it("keeps verifier results internal unless a high-risk issue needs one clarification", () => {
    expect(interpretRouteSource).toContain('(mode === "create" || mode === "edit_series") && resolvedNextAction !== "ask_clarification"');
    expect(interpretRouteSource).toContain('issue.severity === "high"');
    expect(interpretRouteSource).toContain("shouldSuppressDraftVerifierIssue");
    expect(interpretRouteSource).toContain('resolvedNextAction = "ask_clarification"');
    expect(interpretRouteSource).toContain("Please confirm ${highRiskVerificationIssue.field}");
  });
});

describe("Lane 9 — draft verifier question quality", () => {
  it("keeps internal recurrence/schema questions out of host clarifications", () => {
    expect(
      shouldSuppressDraftVerifierIssue({
        issue: {
          severity: "high",
          field: "recurrence_rule",
          issue: "Need app-specific recurrence semantics.",
          question:
            "In your event system, does recurrence FREQ=WEEKLY;BYDAY=MO begin from start_date, or does event_date override the first occurrence?",
        },
        draft: {
          start_date: "2026-05-11",
          event_date: "2026-05-11",
          recurrence_rule: "FREQ=WEEKLY;BYDAY=MO",
        },
        currentDate: "2026-05-04",
      })
    ).toBe(true);
  });

  it("suppresses redundant year confirmation when the current-year source date is still upcoming", () => {
    expect(
      shouldSuppressDraftVerifierIssue({
        issue: {
          severity: "high",
          field: "start_date",
          issue: "The flyer says May 11 without a year.",
          question: "Confirm the year for the May 11 resume date, e.g. 2026?",
        },
        draft: {
          start_date: "2026-05-11",
          event_date: "2026-05-11",
        },
        currentDate: "2026-05-04",
      })
    ).toBe(true);
  });

  it("does not suppress year/date questions when the drafted date is already past", () => {
    expect(
      shouldSuppressDraftVerifierIssue({
        issue: {
          severity: "high",
          field: "start_date",
          issue: "The flyer says May 3 without a year.",
          question: "Confirm the year for May 3.",
        },
        draft: {
          start_date: "2026-05-03",
          event_date: "2026-05-03",
        },
        currentDate: "2026-05-04",
      })
    ).toBe(false);
  });

  it("teaches the verifier the app-owned recurrence and current-year date contracts", () => {
    expect(interpretRouteSource).toContain(
      "Never ask the user how this app stores recurrence, RRULE, start_date, or event_date"
    );
    expect(interpretRouteSource).toContain(
      "start_date/event_date anchors the first occurrence; recurrence_rule describes the recurring pattern"
    );
    expect(interpretRouteSource).toContain(
      "When a source gives a month/day without a year and the current-year date is current_date or later"
    );
    expect(interpretRouteSource).toContain("do not ask to confirm the year");
  });
});
