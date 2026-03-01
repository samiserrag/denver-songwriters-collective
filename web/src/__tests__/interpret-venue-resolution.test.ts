/**
 * Phase 5 — Interpret route venue resolution integration tests.
 *
 * Source-code assertion tests that verify the interpret route integrates
 * the venue resolver, expands the venue catalog, updates the system prompt,
 * and adds structured logging for venue resolution.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/events/interpret/route.ts"
);
const routeSource = fs.readFileSync(ROUTE_PATH, "utf-8");

const CONTRACT_PATH = path.resolve(
  __dirname,
  "../lib/events/interpretEventContract.ts"
);
const contractSource = fs.readFileSync(CONTRACT_PATH, "utf-8");

const LAB_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
);
const labSource = fs.readFileSync(LAB_PATH, "utf-8");

// ---------------------------------------------------------------------------
// A) Route imports resolver
// ---------------------------------------------------------------------------
describe("Phase 5 — route imports and wiring", () => {
  it("imports resolveVenue + shouldResolveVenue from venueResolver", () => {
    expect(routeSource).toContain('from "@/lib/events/venueResolver"');
    expect(routeSource).toContain("resolveVenue");
    expect(routeSource).toContain("shouldResolveVenue");
  });

  it("declares venueResolution variable", () => {
    expect(routeSource).toContain(
      "let venueResolution: VenueResolutionOutcome | null = null"
    );
  });

  it("calls resolveVenue after sanitizedDraft", () => {
    const sanitizeIdx = routeSource.indexOf("sanitizeInterpretDraftPayload(mode");
    const resolveIdx = routeSource.indexOf("resolveVenue({");
    expect(sanitizeIdx).toBeGreaterThan(-1);
    expect(resolveIdx).toBeGreaterThan(-1);
    expect(resolveIdx).toBeGreaterThan(sanitizeIdx);
  });

  it("gates resolver with shouldResolveVenue helper", () => {
    expect(routeSource).toContain(
      "shouldResolveVenue({"
    );
    expect(routeSource).toContain("hasLocationIntent: shouldSendVenueCatalog");
    expect(routeSource).toContain("draftPayload: sanitizedDraft");
  });
});

// ---------------------------------------------------------------------------
// B) Venue catalog query expansion
// ---------------------------------------------------------------------------
describe("Phase 5 — venue catalog query", () => {
  it("queries slug from venues table", () => {
    expect(routeSource).toContain('.select("id, name, slug")');
  });

  it("uses VenueCatalogEntry type for venueCatalog", () => {
    expect(routeSource).toContain("let venueCatalog: VenueCatalogEntry[]");
  });

  it("maps slug into catalog entries", () => {
    expect(routeSource).toContain("slug: v.slug ?? null");
  });

  it("strips slug from LLM prompt (only sends id+name)", () => {
    expect(routeSource).toContain(
      "input.venueCatalog.map((v) => ({ id: v.id, name: v.name }))"
    );
  });
});

// ---------------------------------------------------------------------------
// C) System prompt update
// ---------------------------------------------------------------------------
describe("Phase 5 — system prompt venue_name instruction", () => {
  it("instructs LLM to set venue_name when uncertain", () => {
    expect(routeSource).toContain("set venue_name to your best guess");
  });

  it("mentions server will attempt deterministic resolution", () => {
    expect(routeSource).toContain(
      "The server will attempt deterministic resolution"
    );
  });
});

// ---------------------------------------------------------------------------
// D) Resolution outcome handling
// ---------------------------------------------------------------------------
describe("Phase 5 — resolution outcome application", () => {
  it("sets venue_id on resolved outcome", () => {
    expect(routeSource).toContain(
      "sanitizedDraft.venue_id = venueResolution.venueId"
    );
  });

  it("sets venue_name on resolved outcome", () => {
    expect(routeSource).toContain(
      "sanitizedDraft.venue_name = venueResolution.venueName"
    );
  });

  it("sets location_mode to venue on resolved outcome", () => {
    expect(routeSource).toContain('sanitizedDraft.location_mode = "venue"');
  });

  it("forces ask_clarification on ambiguous — only escalates", () => {
    expect(routeSource).toContain(
      'venueResolution.status === "ambiguous"'
    );
    expect(routeSource).toContain(
      'resolvedNextAction = "ask_clarification"'
    );
    // Verify escalation-only guard
    expect(routeSource).toContain(
      'if (resolvedNextAction !== "ask_clarification")'
    );
  });

  it("builds ambiguous clarification with candidate list", () => {
    expect(routeSource).toContain("I found multiple possible venues matching");
    expect(routeSource).toContain("Which one did you mean?");
  });

  it("adds venue_id to blocking_fields on ambiguous", () => {
    expect(routeSource).toContain(
      '!resolvedBlockingFields.includes("venue_id")'
    );
    expect(routeSource).toContain(
      'resolvedBlockingFields.push("venue_id")'
    );
  });

  it("forces ask_clarification on unresolved", () => {
    expect(routeSource).toContain(
      'venueResolution.status === "unresolved"'
    );
    expect(routeSource).toContain(
      "I couldn't find a known venue"
    );
  });

  it("uses online_url blocking when online mode is selected but URL missing", () => {
    expect(routeSource).toContain('const blockingField = needsOnlineUrl ? "online_url" : "venue_id"');
    expect(routeSource).toContain("Please provide the online event URL");
  });

  it("does not modify on online_explicit or custom_location", () => {
    expect(routeSource).toContain(
      "// online_explicit / custom_location → no changes needed"
    );
  });

  it("uses resolved values in response (not raw LLM values)", () => {
    expect(routeSource).toContain("next_action: resolvedNextAction");
    expect(routeSource).toContain(
      "clarification_question: resolvedClarificationQuestion"
    );
    expect(routeSource).toContain(
      "blocking_fields: resolvedBlockingFields"
    );
  });
});

// ---------------------------------------------------------------------------
// E) Custom location detection
// ---------------------------------------------------------------------------
describe("Phase 5 — custom location detection", () => {
  it("detects isCustomLocation from draft", () => {
    expect(routeSource).toContain("const isCustomLocation =");
    expect(routeSource).toContain("sanitizedDraft.custom_location_name");
  });

  it("passes isCustomLocation to resolver", () => {
    expect(routeSource).toContain("isCustomLocation,");
  });
});

// ---------------------------------------------------------------------------
// F) Structured logging
// ---------------------------------------------------------------------------
describe("Phase 5 — structured logging", () => {
  it("logs venueResolution in response log", () => {
    expect(routeSource).toContain("venueResolution: {");
    expect(routeSource).toContain("status: venueResolution.status");
  });

  it("logs source and confidence for resolved", () => {
    expect(routeSource).toContain("source: venueResolution.source");
    expect(routeSource).toContain("confidence: venueResolution.confidence");
  });

  it("logs candidateCount for ambiguous", () => {
    expect(routeSource).toContain(
      "candidateCount: venueResolution.candidates.length"
    );
  });

  it("logs inputName for unresolved", () => {
    expect(routeSource).toContain("inputName: venueResolution.inputName");
  });
});

// ---------------------------------------------------------------------------
// G) Contract allowlist updates
// ---------------------------------------------------------------------------
describe("Phase 5 — contract allowlist updates", () => {
  it("includes venue_name in CREATE_PAYLOAD_ALLOWLIST", () => {
    const start = contractSource.indexOf("const CREATE_PAYLOAD_ALLOWLIST");
    const end = contractSource.indexOf("]);", start);
    const block = contractSource.slice(start, end);
    expect(block).toContain('"venue_name"');
  });

  it("includes venue_name in EDIT_SERIES_PAYLOAD_ALLOWLIST", () => {
    const start = contractSource.indexOf(
      "const EDIT_SERIES_PAYLOAD_ALLOWLIST"
    );
    const end = contractSource.indexOf("]);", start);
    const block = contractSource.slice(start, end);
    expect(block).toContain('"venue_name"');
  });

  it("venue_name appears after venue_id in CREATE allowlist", () => {
    const start = contractSource.indexOf("const CREATE_PAYLOAD_ALLOWLIST");
    const end = contractSource.indexOf("]);", start);
    const block = contractSource.slice(start, end);
    const venueIdIdx = block.indexOf('"venue_id"');
    const venueNameIdx = block.indexOf('"venue_name"');
    expect(venueIdIdx).toBeGreaterThan(-1);
    expect(venueNameIdx).toBeGreaterThan(venueIdIdx);
  });
});

// ---------------------------------------------------------------------------
// H) Lab page passthrough optionals
// ---------------------------------------------------------------------------
describe("Phase 5 — lab page venue_name passthrough", () => {
  it("includes venue_name in CREATE_PASSTHROUGH_OPTIONALS", () => {
    const start = labSource.indexOf("const CREATE_PASSTHROUGH_OPTIONALS");
    const end = labSource.indexOf("] as const;", start);
    const block = labSource.slice(start, end);
    expect(block).toContain('"venue_name"');
  });
});
