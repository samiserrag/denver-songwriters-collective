import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const routeSource = fs.readFileSync(
  path.join(ROOT, "app/api/my-events/route.ts"),
  "utf-8"
);

describe("my-events API venue auto-promotion", () => {
  it("contains custom-location to canonical venue auto-promotion block", () => {
    expect(routeSource).toContain("Auto-promote conversational custom locations to canonical venues");
    expect(routeSource).toContain("!hasVenue");
    expect(routeSource).toContain("hasCustomLocation");
  });

  it("attempts existing canonical venue reuse by name first", () => {
    expect(routeSource).toContain('.from("venues")');
    expect(routeSource).toContain('.ilike("name", customName)');
    expect(routeSource).toContain(".limit(25)");
    expect(routeSource).toContain("classifyVenueCandidatesForPromotion");
  });

  it("uses admin-only service role path for new canonical venue creation", () => {
    expect(routeSource).toContain("isAdmin");
    expect(routeSource).toContain("createServiceRoleClient()");
    expect(routeSource).toContain("processVenueGeocodingWithStatus");
  });

  it("blocks auto-promotion on ambiguous candidate sets", () => {
    expect(routeSource).toContain("hasAmbiguousCandidates");
    expect(routeSource).toContain("Venue auto-promotion skipped due to ambiguous candidates");
  });

  it("promotes to venue_id and clears custom location fields when successful", () => {
    expect(routeSource).toContain("body.venue_id = promotedVenue.id");
    expect(routeSource).toContain("body.custom_location_name = null");
    expect(routeSource).toContain("body.custom_address = null");
    expect(routeSource).toContain("requestedLocationMode === \"hybrid\" && hasOnlineUrlForHybrid");
  });

  it("preserves existing mutual exclusivity validation", () => {
    expect(routeSource).toContain("Cannot have both venue_id and custom_location_name");
    expect(routeSource).toContain("Either venue_id or custom_location_name is required for in-person events");
  });

  it("reuses matching conversational events instead of creating duplicate drafts", () => {
    expect(routeSource).toContain("findReusableConversationalEvent");
    expect(routeSource).toContain("traceId && eventDates.length === 1");
    expect(routeSource).toContain("reused_existing: true");
    expect(routeSource).toContain("Reusing matching conversational event instead of creating duplicate");
  });
});
