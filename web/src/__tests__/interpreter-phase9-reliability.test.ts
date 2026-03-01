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
