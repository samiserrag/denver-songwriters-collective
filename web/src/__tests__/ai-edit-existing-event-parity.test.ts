/**
 * Track 1 follow-up — AI existing-event editor parity + uploaded cover support.
 *
 * Pins the source-text contract for:
 *   1. AI edit pages (series + occurrence) fetch the existing event snapshot
 *      and pass it through `existingEventSnapshot` so the conversational UI
 *      can render the live cover and edit/profile links before any AI turn.
 *   2. ConversationalCreateUI exposes `existingEventSnapshot` and
 *      `allowExistingEventCoverUpload` as opt-in props that do not change
 *      the existing `allowExistingEventWrites={false}` posture for other
 *      writes.
 *   3. Cover swaps for existing events route through PATCH
 *      `/api/my-events/[id]` (with `ai_write_source` + the
 *      `ai_confirm_published_high_risk` handshake) instead of a direct
 *      Supabase row update — this is what keeps the published-event safety
 *      gate on the write path.
 *   4. The preview card and the host header surface the live cover and the
 *      edit/profile links as soon as the page loads, not only after an AI
 *      write succeeds.
 *
 * Mirrors the established CRUI test pattern in this repo (source-string
 * assertions on a large file that lacks a real-render harness).
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx",
);
const SERIES_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/[id]/ai/page.tsx",
);
const OCCURRENCE_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/ai/page.tsx",
);

const componentSource = fs.readFileSync(COMPONENT_PATH, "utf-8");
const seriesRouteSource = fs.readFileSync(SERIES_ROUTE_PATH, "utf-8");
const occurrenceRouteSource = fs.readFileSync(OCCURRENCE_ROUTE_PATH, "utf-8");

// ---------------------------------------------------------------------------
// 1) AI edit page wrappers fetch the snapshot and pass it through.
// ---------------------------------------------------------------------------
describe("existing-event AI edit pages — snapshot + opt-in cover writes", () => {
  it("series page fetches the snapshot fields needed for preview and links", () => {
    expect(seriesRouteSource).toContain(
      'select("id, slug, title, event_type, cover_image_url, is_published")',
    );
  });

  it("series page passes existingEventSnapshot through to ConversationalCreateUI", () => {
    expect(seriesRouteSource).toContain("existingEventSnapshot={{");
    expect(seriesRouteSource).toContain("coverImageUrl:");
    expect(seriesRouteSource).toContain("isPublished: event.is_published === true");
  });

  it("series page opts in to cover-only writes without flipping allowExistingEventWrites", () => {
    expect(seriesRouteSource).toContain("allowExistingEventCoverUpload");
    // The broader write flag stays disabled — only cover writes are enabled.
    expect(seriesRouteSource).toContain("allowExistingEventWrites={false}");
  });

  it("occurrence page fetches the snapshot fields needed for preview and links", () => {
    expect(occurrenceRouteSource).toContain(
      'select("id, slug, title, event_type, cover_image_url, is_published")',
    );
  });

  it("occurrence page passes existingEventSnapshot and the cover opt-in through", () => {
    expect(occurrenceRouteSource).toContain("existingEventSnapshot={{");
    expect(occurrenceRouteSource).toContain("allowExistingEventCoverUpload");
    expect(occurrenceRouteSource).toContain("allowExistingEventWrites={false}");
  });
});

// ---------------------------------------------------------------------------
// 2) ConversationalCreateUI accepts the new props and uses them for preview
//    + immediate edit/profile links.
// ---------------------------------------------------------------------------
describe("ConversationalCreateUI — existing-event props + immediate links", () => {
  it("declares the ExistingEventSnapshot type with the fields the snapshot needs", () => {
    expect(componentSource).toContain("export interface ExistingEventSnapshot");
    expect(componentSource).toContain("coverImageUrl: string | null");
    expect(componentSource).toContain("isPublished: boolean");
    expect(componentSource).toContain("eventType: string[]");
  });

  it("accepts the new props with safe defaults", () => {
    expect(componentSource).toContain("allowExistingEventCoverUpload = false");
    expect(componentSource).toContain("existingEventSnapshot = null");
    expect(componentSource).toContain(
      "existingEventSnapshot?: ExistingEventSnapshot | null",
    );
  });

  it("falls back to the snapshot cover when no staged image is selected", () => {
    expect(componentSource).toContain("appliedExistingCoverUrl");
    expect(componentSource).toContain(
      "input.appliedExistingCoverUrl ?? input.existingEventSnapshot?.coverImageUrl ?? null",
    );
    expect(componentSource).toContain("const coverPreviewUrl = stagedCoverDataUrl ?? existingCoverUrl");
  });

  it("renders the preview when only the existing snapshot is available", () => {
    expect(componentSource).toContain(
      "if (!draft && !input.createdSummary && !input.existingEventSnapshot) return null;",
    );
  });

  it("derives an existing-event public href that respects open_mic vs /events", () => {
    expect(componentSource).toContain("function buildExistingEventPublicHref");
    expect(componentSource).toContain(
      'eventTypes.includes("open_mic") ? `/open-mics/${identifier}` : `/events/${identifier}`',
    );
  });

  it("falls back to the snapshot event_type when the AI draft does not explicitly supply one", () => {
    // Coordinator finding (Lane 5): a partial edit-mode draft that omits
    // `event_type` was previously falling through to
    // `normalizeDraftEventTypes`'s `["open_mic"]` default, flipping the
    // public link to `/open-mics/<slug>` for non-open-mic events. The fix
    // gates the draft branch behind an explicit-event_type check and
    // keeps the snapshot's classification otherwise.
    expect(componentSource).toContain("function hasExplicitEventType");
    // The public-href helper uses the new check, not the prior
    // length>0 hack.
    expect(componentSource).toMatch(
      /function buildExistingEventPublicHref[\s\S]*?hasExplicitEventType\(draft\)[\s\S]*?:\s*snapshot\.eventType/,
    );
    // The preview event-type branch uses the same check so the
    // listing-card preview cannot drift to "open_mic" via a partial
    // draft that omits the field.
    expect(componentSource).toMatch(
      /const eventTypes = hasExplicitEventType\(draft\)[\s\S]*?:\s*snapshotEventTypeFallback/,
    );
  });

  it("treats event_type arrays of empty strings as not explicitly supplied", () => {
    // The detection helper treats `[]`, `[""]`, `null`, `undefined`, and
    // empty strings the same — none of them count as "explicitly
    // supplied" — so the snapshot fallback wins in every implicit case.
    expect(componentSource).toMatch(
      /function hasExplicitEventType[\s\S]*?Array\.isArray\(value\)[\s\S]*?value\.some\(/,
    );
    expect(componentSource).toMatch(
      /function hasExplicitEventType[\s\S]*?typeof value === "string" && value\.trim\(\)\.length > 0/,
    );
  });

  it("shows the edit and profile links immediately for existing-event sessions", () => {
    expect(componentSource).toContain('data-testid="host-existing-event-links"');
    expect(componentSource).toContain("Open edit page");
    expect(componentSource).toContain("Open profile preview");
    // The link block is gated on the existing snapshot being present, not on
    // any created draft / AI write outcome.
    expect(componentSource).toMatch(
      /existingEventSnapshot && existingEditHref && existingPublicHref/,
    );
  });

  it("keeps existing-event edit and profile links available in the mobile host layout", () => {
    expect(componentSource).toContain('data-testid="host-mobile-event-links"');
    expect(componentSource).toContain("lg:hidden");
    expect(componentSource).toMatch(
      /existingEventSnapshot && existingEditHref && existingPublicHref[\s\S]*?href=\{existingEditHref\}/,
    );
    expect(componentSource).toMatch(
      /existingEventSnapshot && existingEditHref && existingPublicHref[\s\S]*?href=\{existingPublicHref\}/,
    );
  });
});

// ---------------------------------------------------------------------------
// 3) Cover-only narrow opt-in for existing events routes through PATCH and
//    keeps the published-event safety gate handshake intact.
// ---------------------------------------------------------------------------
describe("ConversationalCreateUI — cover writes for existing events", () => {
  it("derives a narrow cover-only flag separate from allowExistingEventWrites", () => {
    expect(componentSource).toContain("const canApplyCoverViaEditEndpoint");
    expect(componentSource).toContain(
      "allowExistingEventCoverUpload && isExistingEventEditSession",
    );
  });

  it("widens canShowCoverControls without removing the legacy pinned guard", () => {
    // The legacy lab-mode guard substring stays intact so PR 6 / Phase 8E
    // tests still pass.
    expect(componentSource).toContain(
      "isEditMode && hasValidEventId && canWriteExistingEvent",
    );
    // The new opt-in branch sits alongside it as an OR clause.
    expect(componentSource).toContain(
      "isEditMode && hasValidEventId && canApplyCoverViaEditEndpoint",
    );
  });

  it("routes existing-event cover persistence through PATCH /api/my-events/[id]", () => {
    expect(componentSource).toContain("const persistViaEditEndpoint");
    expect(componentSource).toContain(
      "canApplyCoverViaEditEndpoint && !createdEventId",
    );
    // The PATCH body must include both the cover URL and the AI write source
    // so the published-event gate runs server-side.
    expect(componentSource).toMatch(
      /cover_image_url:\s*uploadedUrl,\s*\n\s*ai_write_source:\s*"conversational_create_ui_auto_apply"/,
    );
  });

  it("handles the published-event 409 confirmation handshake on the cover path", () => {
    expect(componentSource).toContain("pendingCoverConfirmationCandidateId");
    expect(componentSource).toContain(
      "result?.requires_confirmation === true",
    );
    expect(componentSource).toContain(
      "patchBody.ai_confirm_published_high_risk = true",
    );
    // The orphaned event_images row from the gated attempt is cleaned up so
    // a retry does not leave stale storage rows behind.
    expect(componentSource).toMatch(
      /softDeleteCoverImageRow\(supabase, targetEventId, uploadedUrl\)/,
    );
  });

  it("never reaches the legacy direct-Supabase update when persisting via the edit endpoint", () => {
    // The edit-endpoint branch returns or falls through, so the
    // direct-update branch only runs for created drafts / lab mode. Encoded
    // by the if/else split inside applyCoverCandidate.
    expect(componentSource).toMatch(
      /if\s*\(persistViaEditEndpoint\)\s*{[\s\S]*?}\s*else\s*{[\s\S]*?\.update\(\{ cover_image_url:\s*uploadedUrl \}\)/,
    );
  });

  it("broadcasts cover_updated after a successful existing-event cover swap", () => {
    // The same broadcast that already powers EventDraftSyncReloader on the
    // edit and public pages — keeps the open tabs in sync after each
    // applied cover turn.
    expect(componentSource).toContain(
      'broadcastEventDraftSync(targetEventId, "cover_updated")',
    );
  });

  it("mirrors the just-applied cover into local state so the preview updates immediately", () => {
    expect(componentSource).toContain("setAppliedExistingCoverUrl(uploadedUrl)");
  });
});

// ---------------------------------------------------------------------------
// 4) Anti-creep: the new flow does not flip allowExistingEventWrites or
//    bypass the safety gate.
// ---------------------------------------------------------------------------
describe("anti-creep — existing-event writes posture is preserved", () => {
  it("does not change the default value of allowExistingEventWrites", () => {
    // Default for the lab variant remains true; the host AI edit pages
    // continue to pass `allowExistingEventWrites={false}` per the existing
    // ai-edit-routes.test.ts pin.
    expect(componentSource).toContain("allowExistingEventWrites = true");
  });

  it("preserves the published-event gate handshake state and constants", () => {
    expect(componentSource).toContain("ai_confirm_published_high_risk");
    expect(componentSource).toContain("setPendingPublishedRiskConfirmation");
  });
});
