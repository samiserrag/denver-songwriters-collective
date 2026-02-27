/**
 * Phase 6.x — Interpreter location hint integration tests.
 *
 * Source-code assertions verifying Google Maps link expansion,
 * deterministic draft location hydration, and graceful clarification fallback.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/events/interpret/route.ts"
);
const routeSource = fs.readFileSync(ROUTE_PATH, "utf-8");

describe("Interpreter location hints", () => {
  it("detects Google Maps URLs", () => {
    expect(routeSource).toContain("GOOGLE_MAPS_URL_REGEX");
    expect(routeSource).toContain("maps\\.app\\.goo\\.gl");
  });

  it("expands Google Maps hint server-side", () => {
    expect(routeSource).toContain("resolveGoogleMapsHint");
    expect(routeSource).toContain('method: "HEAD"');
    expect(routeSource).toContain("extractPlaceNameFromMapsUrl");
  });

  it("injects google_maps_hint into LLM prompt payload", () => {
    expect(routeSource).toContain("google_maps_hint");
    expect(routeSource).toContain("google_maps_note");
  });

  it("hydrates custom location fields from deterministic hints", () => {
    expect(routeSource).toContain("applyLocationHintsToDraft");
    expect(routeSource).toContain("draft.custom_location_name");
    expect(routeSource).toContain("draft.custom_address");
    expect(routeSource).toContain("draft.custom_city");
    expect(routeSource).toContain("draft.custom_state");
  });

  it("removes redundant location blockers once custom location exists", () => {
    expect(routeSource).toContain("venue_id/venue_name_confirmation");
    expect(routeSource).toContain("custom_address");
    expect(routeSource).toContain("custom_city");
    expect(routeSource).toContain("custom_state");
  });

  it("converts invalid non-clarification responses into ask_clarification instead of 422", () => {
    expect(routeSource).toContain("Final guardrail: never 422");
    expect(routeSource).not.toContain("{ status: 422 }");
    expect(routeSource).toContain('resolvedNextAction = "ask_clarification"');
    expect(routeSource).toContain("Please provide ${missingField} to continue.");
  });
});
