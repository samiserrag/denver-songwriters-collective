/**
 * Phase 8D — Interpreter lab post-create confidence UX tests.
 *
 * Source-code assertion tests verifying that the lab page:
 * 1. Defines CreatedEventSummary interface + buildCreatedEventSummary helper.
 * 2. Shows "What Was Written" summary after create (title, recurrence, date/time, location, signup, cover).
 * 3. Provides strong next-action CTAs (Open Draft, My Happenings, Edit & Publish).
 * 4. Prevents duplicate submit by hiding create button after success.
 * 5. Preserves all existing Phase 8A/8B/8C functionality unchanged.
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
// A) CreatedEventSummary interface + builder
// ---------------------------------------------------------------------------
describe("Phase 8D — CreatedEventSummary type and builder", () => {
  it("defines CreatedEventSummary interface", () => {
    expect(labSource).toContain("interface CreatedEventSummary");
  });

  it("includes all required summary fields", () => {
    const fields = [
      "eventId: string",
      "slug: string | null",
      "title: string | null",
      "eventType: string | null",
      "startDate: string | null",
      "startTime: string | null",
      "endTime: string | null",
      "seriesMode: string | null",
      "recurrenceRule: string | null",
      "locationMode: string | null",
      "venueName: string | null",
      "signupMode: string | null",
      "costLabel: string | null",
      "hasCover: boolean",
      "coverNote: string | null",
    ];
    for (const field of fields) {
      expect(labSource).toContain(field);
    }
  });

  it("defines buildCreatedEventSummary function", () => {
    expect(labSource).toContain("function buildCreatedEventSummary(");
    expect(labSource).toContain("): CreatedEventSummary");
  });

  it("normalizes snake_case display values for non-string-safe fields", () => {
    expect(labSource).toContain("function normalizeSnakeCaseDisplay(");
    expect(labSource).toContain("eventType: normalizeSnakeCaseDisplay(draft.event_type)");
    expect(labSource).toContain("signupMode: normalizeSnakeCaseDisplay(draft.signup_mode)");
    expect(labSource).not.toContain("createdSummary.eventType.replace(/_/g, \" \")");
  });

  it("has createdSummary state", () => {
    expect(labSource).toContain("useState<CreatedEventSummary | null>(null)");
    expect(labSource).toContain("setCreatedSummary");
  });
});

// ---------------------------------------------------------------------------
// B) "What Was Written" summary block
// ---------------------------------------------------------------------------
describe("Phase 8D — What Was Written summary block", () => {
  it("renders What Was Written heading", () => {
    expect(labSource).toContain("What Was Written");
  });

  it("shows title from summary", () => {
    expect(labSource).toContain("createdSummary.title");
  });

  it("shows event type from summary", () => {
    expect(labSource).toContain("createdSummary.eventType");
  });

  it("shows date from summary", () => {
    expect(labSource).toContain("createdSummary.startDate");
  });

  it("shows time range from summary", () => {
    expect(labSource).toContain("createdSummary.startTime");
    expect(labSource).toContain("createdSummary.endTime");
  });

  it("shows recurrence from summary", () => {
    expect(labSource).toContain("createdSummary.recurrenceRule");
  });

  it("shows location from summary", () => {
    expect(labSource).toContain("createdSummary.venueName");
  });

  it("shows signup mode from summary", () => {
    expect(labSource).toContain("createdSummary.signupMode");
  });

  it("shows cost from summary", () => {
    expect(labSource).toContain("createdSummary.costLabel");
  });

  it("shows cover status from summary", () => {
    expect(labSource).toContain("createdSummary.hasCover");
    expect(labSource).toContain("createdSummary.coverNote");
  });

  it("renders success header with checkmark", () => {
    expect(labSource).toContain("Event Created as Draft");
    expect(labSource).toContain("text-emerald-600");
  });

  it("uses emerald success container styling", () => {
    expect(labSource).toContain("border-emerald-500/20 bg-emerald-500/5");
  });
});

// ---------------------------------------------------------------------------
// C) Strong next-action CTAs
// ---------------------------------------------------------------------------
describe("Phase 8D — next-action CTAs", () => {
  it("renders Open Draft CTA with arrow", () => {
    expect(labSource).toContain("Open Draft →");
  });

  it("links Open Draft to the created event page", () => {
    expect(labSource).toContain("`/dashboard/my-events/${createdSummary.eventId}`");
  });

  it("renders Go to My Happenings CTA", () => {
    expect(labSource).toContain("Go to My Happenings");
  });

  it("renders Edit & Publish CTA", () => {
    expect(labSource).toContain("Edit & Publish");
  });

  it("uses prominent styling for primary CTA", () => {
    expect(labSource).toContain("bg-emerald-600 text-white");
    expect(labSource).toContain("hover:bg-emerald-700");
  });

  it("separates CTAs from summary with border", () => {
    expect(labSource).toContain("border-t border-emerald-500/10");
  });
});

// ---------------------------------------------------------------------------
// D) Duplicate submit prevention
// ---------------------------------------------------------------------------
describe("Phase 8D — duplicate submit prevention", () => {
  it("hides Confirm & Create button after successful create", () => {
    // Button condition includes !createdEventId
    expect(labSource).toContain("canShowCreateAction && !createdEventId");
  });

  it("shows Creating… text during create operation", () => {
    expect(labSource).toContain("Creating…");
  });

  it("clears createdSummary on mode change", () => {
    expect(labSource).toContain("setCreatedSummary(null)");
  });

  it("calls buildCreatedEventSummary on each success path", () => {
    // Multiple calls in the createEvent function for different exit paths
    const matches = labSource.match(/buildCreatedEventSummary\(/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// E) Existing 8A/8B/8C functionality preserved
// ---------------------------------------------------------------------------
describe("Phase 8D — existing functionality preserved", () => {
  it("preserves next_action badge rendering (8B)", () => {
    expect(labSource).toContain('responseGuidance.next_action.replace(/_/g, " ")');
  });

  it("preserves confidence display (8B)", () => {
    expect(labSource).toContain("Confidence:");
    expect(labSource).toContain("responseGuidance.confidence");
  });

  it("preserves Draft Summary section (8B)", () => {
    expect(labSource).toContain("Draft Summary");
  });

  it("preserves collapsible debug panel (8B)", () => {
    expect(labSource).toContain("Debug: Raw API Response");
    expect(labSource).toContain("<details");
  });

  it("preserves FIELD_INPUT_HINTS (8C)", () => {
    expect(labSource).toContain("FIELD_INPUT_HINTS");
    expect(labSource).toContain("getFieldHint");
  });

  it("preserves clarification hint chips (8C)", () => {
    expect(labSource).toContain("responseGuidance.blocking_fields.map((field)");
    expect(labSource).toContain("bg-amber-500/15 text-amber-700");
  });

  it("preserves series_mode normalization reference (8A)", () => {
    expect(labSource).toContain("series_mode");
  });

  it("preserves LAB_WRITES_ENABLED feature flag", () => {
    expect(labSource).toContain("LAB_WRITES_ENABLED");
  });

  it("preserves legacy fallback links when summary is missing", () => {
    expect(labSource).toContain("createdEventId && !createdSummary");
  });
});
