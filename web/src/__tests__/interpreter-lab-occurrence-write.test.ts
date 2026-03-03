/**
 * Occurrence edit apply wiring tests.
 *
 * Source-code assertion tests verifying:
 * 1. canShowOccurrenceAction guard conditions.
 * 2. mapDraftToOccurrencePayload validates date_key and passes through fields.
 * 3. applyOccurrenceEdit posts to /api/my-events/:id/overrides.
 * 4. 403 permission error branch exists.
 * 5. Revert (empty override) success branch exists.
 * 6. Create/cover paths remain fully separate.
 * 7. Host variant invariant preserved (effectiveMode forces create).
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
// A) canShowOccurrenceAction guard
// ---------------------------------------------------------------------------
describe("Occurrence apply — action gating", () => {
  it("defines canShowOccurrenceAction with all required conditions", () => {
    expect(labSource).toContain("canShowOccurrenceAction");
    const guardStart = labSource.indexOf("canShowOccurrenceAction");
    const guardSection = labSource.slice(guardStart, guardStart + 400);
    expect(guardSection).toContain("writesEnabled");
    expect(guardSection).toContain('effectiveMode === "edit_occurrence"');
    expect(guardSection).toContain("eventId.trim().length > 0");
    expect(guardSection).toContain("DATE_KEY_PATTERN.test(dateKey.trim())");
    expect(guardSection).toContain("ACTIONABLE_NEXT_ACTIONS.has(lastInterpretResponse.next_action");
  });

  it("uses renamed ACTIONABLE_NEXT_ACTIONS (not CREATABLE)", () => {
    expect(labSource).toContain("const ACTIONABLE_NEXT_ACTIONS");
    expect(labSource).not.toContain("CREATABLE_NEXT_ACTIONS");
  });

  it("canShowCreateAction still gates on create mode", () => {
    const createGuardStart = labSource.indexOf("canShowCreateAction");
    const createGuardSection = labSource.slice(createGuardStart, createGuardStart + 300);
    expect(createGuardSection).toContain('effectiveMode === "create"');
  });
});

// ---------------------------------------------------------------------------
// B) mapDraftToOccurrencePayload
// ---------------------------------------------------------------------------
describe("Occurrence apply — thin mapper", () => {
  it("defines mapDraftToOccurrencePayload function", () => {
    expect(labSource).toContain("function mapDraftToOccurrencePayload");
  });

  it("validates date_key with YYYY-MM-DD pattern", () => {
    expect(labSource).toContain("DATE_KEY_PATTERN");
    expect(labSource).toMatch(/\\d\{4\}-\\d\{2\}-\\d\{2\}/);
  });

  it("prefers draft.date_key over fallback", () => {
    const fnStart = labSource.indexOf("function mapDraftToOccurrencePayload");
    const fnSection = labSource.slice(fnStart, fnStart + 800);
    expect(fnSection).toContain("draft.date_key");
    expect(fnSection).toContain("fallbackDateKey");
  });

  it("passes through occurrence-specific fields only", () => {
    const fnStart = labSource.indexOf("function mapDraftToOccurrencePayload");
    const fnSection = labSource.slice(fnStart, fnStart + 1200);
    expect(fnSection).toContain("draft.status");
    expect(fnSection).toContain("draft.override_start_time");
    expect(fnSection).toContain("draft.override_cover_image_url");
    expect(fnSection).toContain("draft.override_notes");
    expect(fnSection).toContain("draft.override_patch");
  });

  it("returns error when date_key is missing or invalid", () => {
    const fnStart = labSource.indexOf("function mapDraftToOccurrencePayload");
    const fnSection = labSource.slice(fnStart, fnStart + 800);
    expect(fnSection).toContain("Missing or invalid date_key");
  });
});

// ---------------------------------------------------------------------------
// C) applyOccurrenceEdit handler
// ---------------------------------------------------------------------------
describe("Occurrence apply — handler", () => {
  it("defines applyOccurrenceEdit function", () => {
    expect(labSource).toContain("async function applyOccurrenceEdit");
  });

  it("posts to /api/my-events/:id/overrides", () => {
    const fnStart = labSource.indexOf("async function applyOccurrenceEdit");
    const fnSection = labSource.slice(fnStart, fnStart + 1500);
    expect(fnSection).toContain("/api/my-events/");
    expect(fnSection).toContain("/overrides");
    expect(fnSection).toContain('method: "POST"');
  });

  it("handles 403 with permission-denied message", () => {
    const fnStart = labSource.indexOf("async function applyOccurrenceEdit");
    const fnSection = labSource.slice(fnStart, fnStart + 1500);
    expect(fnSection).toContain("403");
    expect(fnSection).toContain("permission");
  });

  it("handles revert action from server response", () => {
    const fnStart = labSource.indexOf("async function applyOccurrenceEdit");
    const fnSection = labSource.slice(fnStart, fnStart + 1500);
    expect(fnSection).toContain('"reverted"');
    expect(fnSection).toContain("reverted to series defaults");
  });

  it("uses separate state from create flow (isApplyingOccurrence + occurrenceMessage)", () => {
    expect(labSource).toContain("isApplyingOccurrence");
    expect(labSource).toContain("setIsApplyingOccurrence");
    expect(labSource).toContain("occurrenceMessage");
    expect(labSource).toContain("setOccurrenceMessage");
  });

  it("guards entry with canShowOccurrenceAction", () => {
    const fnStart = labSource.indexOf("async function applyOccurrenceEdit");
    const fnSection = labSource.slice(fnStart, fnStart + 200);
    expect(fnSection).toContain("canShowOccurrenceAction");
  });
});

// ---------------------------------------------------------------------------
// D) Button wiring
// ---------------------------------------------------------------------------
describe("Occurrence apply — button", () => {
  it("renders Confirm & Apply Occurrence Edit button", () => {
    expect(labSource).toContain("Confirm & Apply Occurrence Edit");
  });

  it("button visibility gated on canShowOccurrenceAction", () => {
    const buttonStart = labSource.indexOf("Confirm & Apply Occurrence Edit");
    const buttonSection = labSource.slice(buttonStart - 600, buttonStart);
    expect(buttonSection).toContain("canShowOccurrenceAction");
  });

  it("button disabled during apply or submit", () => {
    const buttonStart = labSource.indexOf("Confirm & Apply Occurrence Edit");
    const buttonSection = labSource.slice(buttonStart - 600, buttonStart);
    expect(buttonSection).toContain("isApplyingOccurrence");
    expect(buttonSection).toContain("isSubmitting");
  });
});

// ---------------------------------------------------------------------------
// E) Separation from create/cover flows
// ---------------------------------------------------------------------------
describe("Occurrence apply — flow isolation", () => {
  it("createEvent function does NOT reference occurrence state", () => {
    const createStart = labSource.indexOf("async function createEvent");
    const fnSection = createStart > 0 ? labSource.slice(createStart, createStart + 3000) : "";
    // createEvent should not reference occurrence-specific state
    expect(fnSection).not.toContain("isApplyingOccurrence");
    expect(fnSection).not.toContain("occurrenceMessage");
  });

  it("applyOccurrenceEdit does NOT reference create state or cover upload", () => {
    const applyStart = labSource.indexOf("async function applyOccurrenceEdit");
    const applyEnd = labSource.indexOf("async function createEvent");
    const fnSection = applyStart > 0 && applyEnd > applyStart
      ? labSource.slice(applyStart, applyEnd)
      : "";
    expect(fnSection).not.toContain("isCreating");
    expect(fnSection).not.toContain("createdEventId");
    expect(fnSection).not.toContain("uploadCoverForEvent");
  });

  it("host variant forces create mode — occurrence button can never show in host", () => {
    expect(labSource).toContain('isHostVariant ? "create" : mode');
    // canShowOccurrenceAction requires effectiveMode === "edit_occurrence"
    // which is impossible when isHostVariant is true
    const guardStart = labSource.indexOf("canShowOccurrenceAction");
    const guardSection = labSource.slice(guardStart, guardStart + 300);
    expect(guardSection).toContain('effectiveMode === "edit_occurrence"');
  });
});
