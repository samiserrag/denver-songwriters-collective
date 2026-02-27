/**
 * Phase 4B — Interpreter lab create-mode write + deferred cover tests.
 *
 * Source-code assertion tests that verify the lab page integrates
 * create-mode write path, draft payload mapping, deferred cover,
 * and proper gating without requiring a running browser.
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
// A) Create action visibility gating
// ---------------------------------------------------------------------------
describe("Phase 4B — create action gating", () => {
  it("defines CREATABLE_NEXT_ACTIONS set excluding ask_clarification", () => {
    expect(labSource).toContain("CREATABLE_NEXT_ACTIONS");
    expect(labSource).toContain('"show_preview"');
    expect(labSource).toContain('"await_confirmation"');
    expect(labSource).toContain('"done"');
    // Must NOT include ask_clarification
    const start = labSource.indexOf("const CREATABLE_NEXT_ACTIONS");
    const end = labSource.indexOf("]);", start);
    const setDefinition =
      start >= 0 && end > start ? labSource.slice(start, end + 3) : "";
    expect(setDefinition).not.toContain('"ask_clarification"');
  });

  it("derives canShowCreateAction from flag + mode + response + next_action", () => {
    expect(labSource).toContain("canShowCreateAction");
    expect(labSource).toContain('mode === "create"');
    expect(labSource).toContain("lastInterpretResponse !== null");
    expect(labSource).toContain(
      "CREATABLE_NEXT_ACTIONS.has(lastInterpretResponse.next_action"
    );
  });

  it("tracks lastInterpretResponse in state", () => {
    expect(labSource).toContain("lastInterpretResponse");
    expect(labSource).toContain("setLastInterpretResponse");
    expect(labSource).toContain("next_action");
    expect(labSource).toContain("draft_payload");
  });

  it("updates lastInterpretResponse after successful interpret", () => {
    expect(labSource).toContain("body.next_action && body.draft_payload");
    expect(labSource).toContain("setLastInterpretResponse({");
  });

  it("clears create state when mode changes", () => {
    expect(labSource).toContain("setLastInterpretResponse(null)");
    expect(labSource).toContain("setCreateMessage(null)");
  });

  it("renders Confirm & Create button text", () => {
    expect(labSource).toContain("Confirm & Create");
  });

  it("disables create button during creating or submitting", () => {
    expect(labSource).toContain("isCreating || isSubmitting");
  });
});

// ---------------------------------------------------------------------------
// B) Draft payload mapper
// ---------------------------------------------------------------------------
describe("Phase 4B — mapDraftToCreatePayload", () => {
  it("defines the mapper function", () => {
    expect(labSource).toContain(
      "function mapDraftToCreatePayload("
    );
    expect(labSource).toContain("intentText: string");
  });

  it("checks all four required fields", () => {
    expect(labSource).toContain("CREATE_REQUIRED_FIELDS");
    expect(labSource).toContain('"title"');
    expect(labSource).toContain('"event_type"');
    expect(labSource).toContain('"start_time"');
    expect(labSource).toContain('"start_date"');
    expect(labSource).toContain("Missing required field:");
    expect(labSource).toContain("normalizeStartDate");
  });

  it("validates event_type is a non-empty array", () => {
    expect(labSource).toContain("!Array.isArray(eventType) || eventType.length === 0");
    expect(labSource).toContain("event_type must be a non-empty array");
  });

  it("handles venue_id resolution path", () => {
    expect(labSource).toContain("hasVenueId");
    expect(labSource).toContain('body.venue_id = (draft.venue_id');
  });

  it("handles custom_location_name fallback path", () => {
    expect(labSource).toContain("hasCustomLocationName");
    expect(labSource).toContain('body.custom_location_name = (draft.custom_location_name');
  });

  it("defaults to online location_mode when no venue resolved", () => {
    expect(labSource).toContain("hasOnlineUrl");
    expect(labSource).toContain('body.location_mode = normalizeLocationMode(draft.location_mode, "online")');
  });

  it("returns mapper error when no venue/custom/online location is available", () => {
    expect(labSource).toContain("Missing location: provide venue_id, custom_location_name, or online_url");
  });

  it("passes through optional fields", () => {
    expect(labSource).toContain("CREATE_PASSTHROUGH_OPTIONALS");
    expect(labSource).toContain('"description"');
    expect(labSource).toContain('"series_mode"');
    expect(labSource).toContain('"recurrence_rule"');
    expect(labSource).toContain('"capacity"');
  });

  it("defaults series_mode to single", () => {
    expect(labSource).toContain('body.series_mode = "single"');
  });

  it("normalizes non-canonical location_mode values before create", () => {
    expect(labSource).toContain("function normalizeLocationMode");
    expect(labSource).toContain('mode === "in_person"');
    expect(labSource).toContain('mode === "custom"');
    expect(labSource).toContain('return "venue"');
  });

  it("normalizes BYSETPOS monthly recurrence rules for create", () => {
    expect(labSource).toContain("normalizeRecurrenceRuleForCreate");
    expect(labSource).toContain("BYSETPOS");
    expect(labSource).toContain("FREQ=MONTHLY;BYDAY=");
  });

  it("disables has_timeslots when total_slots is missing/invalid", () => {
    expect(labSource).toContain("if (body.has_timeslots === true)");
    expect(labSource).toContain("body.has_timeslots = false");
    expect(labSource).toContain("body.total_slots = null");
  });

  it("disables timeslots unless user explicitly requested slot configuration", () => {
    expect(labSource).toContain("explicitlyRequestsTimeslots");
    expect(labSource).toContain("hasExplicitTimeslotIntent");
  });

  it("strips Google Maps links from external_url", () => {
    expect(labSource).toContain("isGoogleMapsUrl(body.external_url)");
    expect(labSource).toContain("body.external_url = null");
  });
});

// ---------------------------------------------------------------------------
// C) Create flow
// ---------------------------------------------------------------------------
describe("Phase 4B — createEvent handler", () => {
  it("defines async createEvent function", () => {
    expect(labSource).toContain("async function createEvent()");
  });

  it("guards on canShowCreateAction", () => {
    expect(labSource).toContain("!canShowCreateAction || !lastInterpretResponse");
  });

  it("calls mapDraftToCreatePayload before create", () => {
    expect(labSource).toContain("collectUserIntentText");
    expect(labSource).toContain("mapDraftToCreatePayload(lastInterpretResponse.draft_payload, intentText)");
  });

  it("shows error when mapper fails", () => {
    expect(labSource).toContain("Cannot create:");
  });

  it("POSTs to /api/my-events", () => {
    expect(labSource).toContain('"/api/my-events"');
    expect(labSource).toContain("JSON.stringify(createBody)");
  });

  it("captures newEventId from response", () => {
    expect(labSource).toContain("result.id as string");
    expect(labSource).toContain("setCreatedEventId(newEventId)");
  });

  it("sets isCreating during operation (double-submit guard)", () => {
    expect(labSource).toContain("setIsCreating(true)");
    expect(labSource).toContain("setIsCreating(false)");
  });

  it("clears last create draft state before a new create interpret call", () => {
    expect(labSource).toContain("if (mode === \"create\")");
    expect(labSource).toContain("setLastInterpretResponse(null)");
    expect(labSource).toContain("setCreateMessage(null)");
    expect(labSource).toContain("setCreatedEventId(null)");
  });

  it("attempts venue directory creation when user explicitly requests new venue", () => {
    expect(labSource).toContain("explicitlyRequestsVenueDirectoryCreate(intentText)");
    expect(labSource).toContain('fetch("/api/admin/venues"');
    expect(labSource).toContain("createBody.venue_id = venueData.id");
  });
});

// ---------------------------------------------------------------------------
// D) Deferred cover assignment (create mode)
// ---------------------------------------------------------------------------
describe("Phase 4B — deferred cover in create mode", () => {
  it("checks coverCandidateId + newEventId before cover upload", () => {
    expect(labSource).toContain("effectiveCoverCandidateId");
    expect(labSource).toContain("coverCandidateId ?? stagedImages[0]?.id ?? null");
  });

  it("converts base64 to File via base64ToJpegFile", () => {
    // Re-uses same helper from Phase 4A
    expect(labSource).toContain("base64ToJpegFile(candidate.base64)");
  });

  it("calls uploadCoverForEvent with new eventId", () => {
    expect(labSource).toContain("eventId: newEventId");
  });

  it("updates events.cover_image_url after upload", () => {
    expect(labSource).toContain('update({ cover_image_url: uploadedUrl })');
    expect(labSource).toContain('.eq("id", newEventId)');
  });

  it("shows warning when cover upload fails but event was created", () => {
    expect(labSource).toContain('type: "warning"');
    expect(labSource).toContain("cover upload failed:");
  });

  it("best-effort cleans up uploaded row when cover update fails", () => {
    expect(labSource).toContain("softDeleteCoverImageRow(supabase, newEventId, uploadedUrl)");
  });

  it("shows success with cover when both succeed", () => {
    expect(labSource).toContain("Event created as draft with cover");
  });

  it("shows success without cover when no candidate selected", () => {
    expect(labSource).toContain("Event created as draft (");
  });

  it("auto-selects first staged image as default cover in create mode", () => {
    expect(labSource).toContain("if (mode !== \"create\") return;");
    expect(labSource).toContain("setCoverCandidateId(stagedImages[0].id)");
  });
});

// ---------------------------------------------------------------------------
// E) Create message UX
// ---------------------------------------------------------------------------
describe("Phase 4B — create message display", () => {
  it("tracks createMessage with success/error/warning types", () => {
    expect(labSource).toContain("createMessage");
    expect(labSource).toContain("setCreateMessage");
  });

  it("renders quick navigation links after create", () => {
    expect(labSource).toContain("Open Draft");
    expect(labSource).toContain("Go to My Happenings (Drafts tab)");
  });

  it("renders amber for warning messages", () => {
    expect(labSource).toContain("text-amber-500");
  });

  it("renders emerald for success messages", () => {
    // createMessage success uses same emerald class
    expect(labSource).toMatch(/createMessage[\s\S]*?text-emerald-500/);
  });
});

// ---------------------------------------------------------------------------
// F) Regression: Phase 4A edit-mode still intact
// ---------------------------------------------------------------------------
describe("Phase 4B — Phase 4A regression", () => {
  it("still has applyCover for edit mode", () => {
    expect(labSource).toContain("async function applyCover()");
  });

  it("Apply as Cover button guarded to edit mode", () => {
    expect(labSource).toContain("canShowCoverControls && isEditMode && coverCandidateId");
  });

  it("canShowCoverControls supports both edit and create modes for thumbnail selection", () => {
    expect(labSource).toContain("isEditMode && hasValidEventId");
    expect(labSource).toContain('mode === "create"');
  });

  it("clearHistory resets all Phase 4A + 4B state", () => {
    expect(labSource).toContain("setCoverCandidateId(null)");
    expect(labSource).toContain("setCoverMessage(null)");
    expect(labSource).toContain("setLastInterpretResponse(null)");
    expect(labSource).toContain("setCreateMessage(null)");
  });
});
