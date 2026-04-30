import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  buildOrderedImageReferences,
  resolveNaturalLanguageImageReference,
} from "@/lib/events/aiPromptContract";

const ROUTE_PATH = path.resolve(__dirname, "../app/api/events/interpret/route.ts");
const CONTRACT_PATH = path.resolve(__dirname, "../lib/events/interpretEventContract.ts");
const PROMPT_CONTRACT_PATH = path.resolve(__dirname, "../lib/events/aiPromptContract.ts");
const POST_MY_EVENTS_PATH = path.resolve(__dirname, "../app/api/my-events/route.ts");
const PATCH_MY_EVENT_PATH = path.resolve(__dirname, "../app/api/my-events/[id]/route.ts");
const VENUES_ROUTE_PATH = path.resolve(__dirname, "../app/api/venues/route.ts");
const LAB_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx",
);

const routeSource = fs.readFileSync(ROUTE_PATH, "utf-8");
const contractSource = fs.readFileSync(CONTRACT_PATH, "utf-8");
const promptContractSource = fs.readFileSync(PROMPT_CONTRACT_PATH, "utf-8");
const postMyEventsSource = fs.readFileSync(POST_MY_EVENTS_PATH, "utf-8");
const patchMyEventSource = fs.readFileSync(PATCH_MY_EVENT_PATH, "utf-8");
const venuesRouteSource = fs.readFileSync(VENUES_ROUTE_PATH, "utf-8");
const labSource = fs.readFileSync(LAB_PATH, "utf-8");

describe("Track 1 PR 8 — deterministic image reference selection", () => {
  it("selects ordinal image references by stable ordered index", () => {
    const refs = buildOrderedImageReferences([
      { clientId: "img-1", fileName: "one.jpg", isCurrentCover: true },
      { clientId: "img-2", fileName: "two.jpg" },
      { clientId: "img-3", fileName: "three.jpg" },
    ]);

    const result = resolveNaturalLanguageImageReference({
      message: "Use the second image as the cover",
      imageReferences: refs,
    });

    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.reference.clientId).toBe("img-2");
      expect(result.reference.index).toBe(1);
    }
  });

  it("resolves 'other image' only when exactly one current and one other image exist", () => {
    const refs = buildOrderedImageReferences([
      { clientId: "current", isCurrentCover: true },
      { clientId: "other", isCurrentCover: false },
    ]);

    const result = resolveNaturalLanguageImageReference({
      message: "Use the other image for the cover",
      imageReferences: refs,
    });

    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.reference.clientId).toBe("other");
      expect(result.reason).toBe("other");
    }
  });

  it("treats 'other image' as ambiguous when multiple other candidates exist", () => {
    const refs = buildOrderedImageReferences([
      { clientId: "current", isCurrentCover: true },
      { clientId: "other-a", isCurrentCover: false },
      { clientId: "other-b", isCurrentCover: false },
    ]);

    expect(
      resolveNaturalLanguageImageReference({
        message: "Use the other image",
        imageReferences: refs,
      }),
    ).toEqual({ status: "ambiguous", reason: "multiple_other_candidates" });
  });

  it("treats 'other image' as ambiguous when no current cover marker exists", () => {
    const refs = buildOrderedImageReferences([
      { clientId: "img-1", isCurrentCover: false },
      { clientId: "img-2", isCurrentCover: false },
    ]);

    expect(
      resolveNaturalLanguageImageReference({
        message: "Switch to the other image",
        imageReferences: refs,
      }),
    ).toEqual({ status: "ambiguous", reason: "other_without_current" });
  });
});

describe("Track 1 PR 8 — venue enrichment contract", () => {
  it("allows enriched canonical venue fields through the interpreter draft contract", () => {
    for (const field of [
      "custom_zip",
      "address",
      "city",
      "state",
      "zip",
      "phone",
      "website_url",
      "google_maps_url",
      "map_link",
      "latitude",
      "longitude",
    ]) {
      expect(contractSource).toContain(`"${field}"`);
    }
  });

  it("instructs the model not to claim enriched venue fields unless they are in draft_payload", () => {
    expect(promptContractSource).toContain("Venue enrichment");
    expect(promptContractSource).toContain("Do not say ZIP, phone, website, Google Maps URL, or coordinates were applied");
    expect(promptContractSource).toContain("present in draft_payload");
  });

  it("hydrates Maps URL, ZIP, and coordinates from deterministic Google Maps hints", () => {
    expect(routeSource).toContain("draft.google_maps_url = mapsUrl");
    expect(routeSource).toContain("draft.map_link = mapsUrl");
    expect(routeSource).toContain("draft.zip = addressHint.zip");
    expect(routeSource).toContain("draft.custom_zip = addressHint.zip");
    expect(routeSource).toContain("draft.address = addressHint.street");
    expect(routeSource).toContain("draft.city = addressHint.city");
    expect(routeSource).toContain("draft.state = addressHint.state");
    expect(routeSource).toContain("draft.latitude = googleMapsHint.latitude");
    expect(routeSource).toContain("draft.longitude = googleMapsHint.longitude");
    expect(routeSource).toContain("draft.custom_latitude = googleMapsHint.latitude");
    expect(routeSource).toContain("draft.custom_longitude = googleMapsHint.longitude");
  });

  it("asks web search to verify full venue fields before falling back to questions", () => {
    expect(routeSource).toContain("venue name, street address, city, state, ZIP, phone");
    expect(routeSource).toContain("official website URL, Google Maps URL, and coordinates");
    expect(routeSource).toContain("phone|website|zip");
  });

  it("carries Echo & Ember-style ZIP/contact enrichment into the actual venue creation payload", () => {
    const venuePayloadStart = labSource.indexOf("const venuePayload = {");
    const venuePayloadEnd = labSource.indexOf("};", venuePayloadStart);
    const venuePayloadBlock = labSource.slice(venuePayloadStart, venuePayloadEnd);

    expect(venuePayloadBlock).toContain("zip:");
    expect(venuePayloadBlock).toContain("phone:");
    expect(venuePayloadBlock).toContain("website_url:");
    expect(venuePayloadBlock).toContain("google_maps_url:");
    expect(venuePayloadBlock).toContain("latitude,");
    expect(venuePayloadBlock).toContain("longitude,");
    expect(labSource).toContain('fetch("/api/venues"');
    expect(labSource).toContain("buildVenueEnrichmentPatch");
    expect(labSource).toContain("applyVenueEnrichmentPatch");
    expect(labSource).toContain("fetch(`/api/venues/${input.venueId}`");
  });

  it("keeps custom-location fallback fields writable when no canonical venue is appropriate", () => {
    expect(labSource).toContain('"custom_location_name"');
    expect(labSource).toContain('"custom_address"');
    expect(labSource).toContain('"custom_city"');
    expect(labSource).toContain('"custom_state"');
    expect(labSource).toContain('"custom_latitude"');
    expect(labSource).toContain('"custom_longitude"');
    expect(labSource).toContain('"location_notes"');
  });

  it("uses the existing geocoding pipeline for canonical venue coordinates", () => {
    expect(venuesRouteSource).toContain("latitude");
    expect(venuesRouteSource).toContain("longitude");
    expect(venuesRouteSource).toContain("processVenueGeocodingWithStatus(null, baseInsert)");
    expect(venuesRouteSource).not.toContain("geocode_source:");
    expect(venuesRouteSource).not.toContain("geocoded_at:");
  });
});

describe("Track 1 PR 8 — no duplicate custom locations for deterministic venue matches", () => {
  it("passes ordered image references on every interpret turn", () => {
    expect(labSource).toContain("buildClientImageReferences");
    expect(labSource).toContain("payload.image_references = imageReferences");
  });

  it("resolves custom-location save payloads against existing venues before creating custom duplicates", () => {
    expect(postMyEventsSource).toContain('from "@/lib/events/venueResolver"');
    expect(postMyEventsSource).toContain("resolveExistingVenueFromCustomLocation");
    expect(postMyEventsSource).toContain("body.venue_id = existingVenueResolution.id");
    expect(postMyEventsSource).toContain("clearCustomLocationBody(body)");

    expect(patchMyEventSource).toContain('from "@/lib/events/venueResolver"');
    expect(patchMyEventSource).toContain("resolveExistingVenueFromCustomLocation");
    expect(patchMyEventSource).toContain("body.venue_id = existingVenueResolution.id");
    expect(patchMyEventSource).toContain("clearCustomLocationBody(body)");
  });

  it("does not let verifier venue_name cleanup create custom duplicates once venue_id exists", () => {
    expect(routeSource).toContain("!hasNonEmptyString(draft.venue_id)");
    expect(routeSource).toContain("draft.custom_location_name = draft.venue_name");
  });
});

describe("Track 1 PR 8 — assistant attention affordance", () => {
  it("highlights only the newest assistant response and exposes working state accessibly", () => {
    expect(labSource).toContain("ASSISTANT_RESPONSE_ATTENTION_CLASS");
    expect(labSource).toContain("ASSISTANT_STATUS_ATTENTION_CLASS");
    expect(labSource).toContain("RESPONSE_PANEL_ATTENTION_CLASS");
    expect(labSource).toContain("highlightedAssistantMessageIndex");
    expect(labSource).toContain("window.setTimeout");
    expect(labSource).toContain("current === latestIndex ? null : current");
    expect(labSource).toContain('role={isNewAssistantResponse ? "status" : undefined}');
    expect(labSource).toContain('aria-live={isNewAssistantResponse ? "polite" : undefined}');
    expect(labSource).toContain('role="status"');
    expect(labSource).toContain('aria-label="Assistant is working"');
    expect(labSource).toContain("motion-safe:animate-pulse");
  });
});
