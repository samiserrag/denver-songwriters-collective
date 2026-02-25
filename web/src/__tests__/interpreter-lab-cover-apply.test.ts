/**
 * Phase 4A — Interpreter lab cover-apply source-code assertion tests.
 *
 * These verify the lab page integrates the cover candidate UX, write-gating,
 * and edit-mode apply-cover flow without requiring a running browser or
 * Supabase connection.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const LAB_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/interpreter-lab/page.tsx"
);
const labSource = fs.readFileSync(LAB_PATH, "utf-8");

// ---------------------------------------------------------------------------
// A) Write-gating via feature flag
// ---------------------------------------------------------------------------
describe("Phase 4A — write gating", () => {
  it("reads NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES env var", () => {
    expect(labSource).toContain(
      "NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES"
    );
  });

  it("defines LAB_WRITES_ENABLED constant from the env var", () => {
    expect(labSource).toContain('LAB_WRITES_ENABLED');
    expect(labSource).toContain(
      'process.env.NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES === "true"'
    );
  });
});

// ---------------------------------------------------------------------------
// B) Cover candidate selection UX
// ---------------------------------------------------------------------------
describe("Phase 4A — cover candidate UX", () => {
  it("tracks coverCandidateId in state", () => {
    expect(labSource).toContain("coverCandidateId");
    expect(labSource).toContain("setCoverCandidateId");
  });

  it("derives canShowCoverControls from flag + mode + images", () => {
    expect(labSource).toContain("canShowCoverControls");
    expect(labSource).toContain("LAB_WRITES_ENABLED");
    expect(labSource).toContain("stagedImages.length > 0");
    // Supports both edit mode (with eventId) and create mode
    expect(labSource).toContain("isEditMode && hasValidEventId");
    expect(labSource).toContain('mode === "create"');
  });

  it("defines isEditMode from edit_series and edit_occurrence modes", () => {
    expect(labSource).toContain(
      'mode === "edit_series" || mode === "edit_occurrence"'
    );
  });

  it("clears cover candidate when selected image is removed", () => {
    // Effect that syncs coverCandidateId with stagedImages
    expect(labSource).toContain(
      "!stagedImages.some((img) => img.id === coverCandidateId)"
    );
  });

  it("renders 'Apply as Cover' button text", () => {
    expect(labSource).toContain("Apply as Cover");
  });

  it("disables apply button during apply or submit", () => {
    expect(labSource).toContain("isApplyingCover || isSubmitting");
  });
});

// ---------------------------------------------------------------------------
// C) Apply cover handler flow
// ---------------------------------------------------------------------------
describe("Phase 4A — applyCover handler", () => {
  it("defines async applyCover function", () => {
    expect(labSource).toContain("async function applyCover()");
  });

  it("guards on coverCandidateId + isEditMode + hasValidEventId", () => {
    expect(labSource).toContain(
      "!coverCandidateId || !isEditMode || !hasValidEventId"
    );
  });

  it("checks authenticated session before proceeding", () => {
    expect(labSource).toContain("supabase.auth.getSession()");
    expect(labSource).toContain("Not authenticated");
  });

  it("fresh-fetches current cover_image_url from events table", () => {
    expect(labSource).toContain('.select("cover_image_url")');
    expect(labSource).toContain('.eq("id", targetEventId)');
    expect(labSource).toContain(".maybeSingle()");
  });

  it("converts base64 to File via base64ToJpegFile", () => {
    expect(labSource).toContain("base64ToJpegFile(candidate.base64)");
  });

  it("calls uploadCoverForEvent with supabase, eventId, file, userId", () => {
    expect(labSource).toContain("uploadCoverForEvent({");
    expect(labSource).toContain("eventId: targetEventId");
    expect(labSource).toContain("file: coverFile");
    expect(labSource).toContain("userId: session.user.id");
  });

  it("updates events.cover_image_url with uploaded URL", () => {
    expect(labSource).toContain("cover_image_url: uploadedUrl");
  });

  it("soft-deletes previous cover row when it differs", () => {
    expect(labSource).toContain(
      "previousCoverUrl && previousCoverUrl !== uploadedUrl"
    );
    expect(labSource).toContain("softDeleteCoverImageRow(supabase, targetEventId, previousCoverUrl)");
  });

  it("sets isApplyingCover during operation (double-submit guard)", () => {
    expect(labSource).toContain("setIsApplyingCover(true)");
    expect(labSource).toContain("setIsApplyingCover(false)");
  });

  it("displays success/error feedback via coverMessage state", () => {
    expect(labSource).toContain("setCoverMessage");
    expect(labSource).toContain('type: "success"');
    expect(labSource).toContain('type: "error"');
    expect(labSource).toContain("Cover image applied to event");
  });
});

// ---------------------------------------------------------------------------
// D) base64ToJpegFile helper
// ---------------------------------------------------------------------------
describe("Phase 4A — base64ToJpegFile helper", () => {
  it("decodes base64 to Uint8Array", () => {
    expect(labSource).toContain("atob(base64)");
    expect(labSource).toContain("new Uint8Array");
  });

  it("creates File with .jpg extension for storage path derivation", () => {
    expect(labSource).toContain(".jpg`");
    expect(labSource).toContain('type: "image/jpeg"');
  });
});

// ---------------------------------------------------------------------------
// E) Existing behavior preservation
// ---------------------------------------------------------------------------
describe("Phase 4A — existing behavior preserved", () => {
  it("still imports shared upload helpers", () => {
    expect(labSource).toContain("uploadCoverForEvent");
    expect(labSource).toContain("softDeleteCoverImageRow");
    expect(labSource).toContain("from \"@/lib/events/uploadCoverForEvent\"");
  });

  it("clearHistory resets cover state", () => {
    expect(labSource).toContain("setCoverCandidateId(null)");
    expect(labSource).toContain("setCoverMessage(null)");
  });

  it("preserves image staging area (paste/drop/file input)", () => {
    expect(labSource).toContain("onPaste={handlePaste}");
    expect(labSource).toContain("onDrop={handleDrop}");
    expect(labSource).toContain("onDragOver={handleDragOver}");
  });

  it("preserves conversation history wiring", () => {
    expect(labSource).toContain("conversationHistory");
    expect(labSource).toContain("setConversationHistory");
  });

  it("preserves interpret submit handler", () => {
    expect(labSource).toContain("async function submit()");
    expect(labSource).toContain("/api/events/interpret");
  });
});
