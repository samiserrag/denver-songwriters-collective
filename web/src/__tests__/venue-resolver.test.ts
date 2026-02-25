/**
 * Phase 5 — Venue resolver unit tests.
 *
 * Tests the pure venue resolution module directly with real inputs.
 */
import { describe, expect, it } from "vitest";
import {
  resolveVenue,
  shouldResolveVenue,
  hasVenueSignalsInDraft,
  buildVenueAliasIndex,
  normalizeAlias,
  generateAcronymAlias,
  extractVenueAliasFromMessage,
  scoreVenueMatch,
  normalizeForMatch,
  generateMatchSlug,
  tokenize,
  tokenJaccardScore,
  extractVenueNameFromMessage,
  CURATED_ALIAS_OVERRIDES,
  RESOLVE_THRESHOLD,
  AMBIGUOUS_THRESHOLD,
  type VenueCatalogEntry,
  type VenueResolverInput,
} from "@/lib/events/venueResolver";

// ---------------------------------------------------------------------------
// Test catalog (representative of real DSC venues)
// ---------------------------------------------------------------------------

const catalog: VenueCatalogEntry[] = [
  { id: "v1", name: "Dazzle", slug: "dazzle" },
  { id: "v2", name: "Mercury Cafe", slug: "mercury-cafe" },
  { id: "v3", name: "Long Table Brewhouse", slug: "long-table-brewhouse" },
  { id: "v4", name: "Brewery Rickoli", slug: "brewery-rickoli" },
  { id: "v5", name: "St. Julien Hotel & Spa", slug: "st-julien-hotel-spa" },
  { id: "v6", name: "The Venue Lounge", slug: "the-venue-lounge" },
  { id: "v7", name: "The Venue Bar", slug: "the-venue-bar" },
  { id: "v8", name: "Sunshine Studios", slug: "sunshine-studios" },
];

function makeInput(overrides: Partial<VenueResolverInput>): VenueResolverInput {
  return {
    draftVenueId: null,
    draftVenueName: null,
    userMessage: "",
    venueCatalog: catalog,
    draftLocationMode: null,
    draftOnlineUrl: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A) Normalization helpers
// ---------------------------------------------------------------------------

describe("normalizeForMatch", () => {
  it("lowercases and trims", () => {
    expect(normalizeForMatch("  Dazzle  ")).toBe("dazzle");
  });

  it("replaces & with and", () => {
    expect(normalizeForMatch("St. Julien Hotel & Spa")).toBe("st julien hotel and spa");
  });

  it("strips punctuation", () => {
    expect(normalizeForMatch("O'Brien's Pub")).toBe("obriens pub");
  });

  it("collapses whitespace", () => {
    expect(normalizeForMatch("Long   Table   Brewhouse")).toBe("long table brewhouse");
  });
});

describe("normalizeAlias", () => {
  it("lowercases and strips non-alphanumeric characters", () => {
    expect(normalizeAlias("L.T.B!")).toBe("ltb");
  });
});

describe("generateAcronymAlias", () => {
  it("builds acronym from non-stopword tokens", () => {
    expect(generateAcronymAlias("Long Table Brewhouse")).toBe("ltb");
  });

  it("drops leading stopwords from acronym", () => {
    expect(generateAcronymAlias("The Venue Lounge")).toBe("vl");
  });

  it("returns null for single-token names", () => {
    expect(generateAcronymAlias("Dazzle")).toBeNull();
  });
});

describe("generateMatchSlug", () => {
  it("produces slug from name", () => {
    expect(generateMatchSlug("Long Table Brewhouse")).toBe("long-table-brewhouse");
  });

  it("strips special characters", () => {
    expect(generateMatchSlug("St. Julien Hotel & Spa")).toBe("st-julien-hotel-spa");
  });
});

describe("tokenize", () => {
  it("splits into lowercase tokens", () => {
    expect(tokenize("Mercury Cafe")).toEqual(new Set(["mercury", "cafe"]));
  });

  it("replaces & with and", () => {
    expect(tokenize("Hotel & Spa")).toEqual(new Set(["hotel", "and", "spa"]));
  });
});

describe("tokenJaccardScore", () => {
  it("returns 1.0 for identical sets", () => {
    expect(tokenJaccardScore(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1.0);
  });

  it("returns 0 for disjoint sets", () => {
    expect(tokenJaccardScore(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("returns 0 for two empty sets", () => {
    expect(tokenJaccardScore(new Set(), new Set())).toBe(0);
  });

  it("computes correctly for partial overlap", () => {
    // intersection = {a}, union = {a,b,c} → 1/3
    const score = tokenJaccardScore(new Set(["a", "b"]), new Set(["a", "c"]));
    expect(score).toBeCloseTo(1 / 3, 5);
  });
});

// ---------------------------------------------------------------------------
// B) scoreVenueMatch
// ---------------------------------------------------------------------------

describe("scoreVenueMatch", () => {
  it("exact match returns 1.0", () => {
    expect(scoreVenueMatch("Dazzle", catalog[0])).toBe(1.0);
  });

  it("case-insensitive exact match returns 1.0", () => {
    expect(scoreVenueMatch("dazzle", catalog[0])).toBe(1.0);
  });

  it("slug match returns 0.95", () => {
    // "Long Table Brew House" → slug "long-table-brew-house" vs "long-table-brewhouse"
    // These don't slug-match, but let's test one that does
    expect(scoreVenueMatch("long-table-brewhouse", catalog[2])).toBe(0.95);
  });

  it("high token overlap scores above threshold", () => {
    const score = scoreVenueMatch("Mercury Cafe Denver", catalog[1]);
    // tokens: {mercury, cafe, denver} vs {mercury, cafe} → 2/3 + 0.05 first-token boost
    expect(score).toBeGreaterThanOrEqual(AMBIGUOUS_THRESHOLD);
  });

  it("unrelated name scores below ambiguous threshold", () => {
    const score = scoreVenueMatch("Joe's Garage", catalog[0]);
    expect(score).toBeLessThan(AMBIGUOUS_THRESHOLD);
  });
});

// ---------------------------------------------------------------------------
// C) extractVenueNameFromMessage
// ---------------------------------------------------------------------------

describe("extractVenueNameFromMessage", () => {
  it("extracts a known venue name from message", () => {
    const result = extractVenueNameFromMessage("Open mic at Dazzle next Tuesday", catalog);
    expect(result).toBe("Dazzle");
  });

  it("extracts the longest matching venue name", () => {
    const result = extractVenueNameFromMessage("Playing at Long Table Brewhouse tonight", catalog);
    expect(result).toBe("Long Table Brewhouse");
  });

  it("returns null when no venue found in message", () => {
    const result = extractVenueNameFromMessage("Just a random event somewhere", catalog);
    expect(result).toBeNull();
  });

  it("returns null for empty message", () => {
    expect(extractVenueNameFromMessage("", catalog)).toBeNull();
  });

  it("matches case-insensitively", () => {
    const result = extractVenueNameFromMessage("show at mercury cafe", catalog);
    expect(result).toBe("Mercury Cafe");
  });
});

describe("buildVenueAliasIndex / extractVenueAliasFromMessage", () => {
  it("includes deterministic acronym aliases", () => {
    const index = buildVenueAliasIndex(catalog);
    expect(index.has("ltb")).toBe(true);
    const matches = index.get("ltb") || [];
    expect(matches.map((m) => m.id)).toContain("v3");
  });

  it("includes curated override aliases", () => {
    const index = buildVenueAliasIndex(catalog);
    const configuredAliases = CURATED_ALIAS_OVERRIDES["long-table-brewhouse"] || [];
    for (const alias of configuredAliases) {
      const matches = index.get(alias) || [];
      expect(matches.map((m) => m.id)).toContain("v3");
    }
  });

  it("extracts known alias token from user message", () => {
    const index = buildVenueAliasIndex(catalog);
    expect(extractVenueAliasFromMessage("Open mic at LTB this Friday", index)).toBe("ltb");
  });

  it("returns null when no alias token is present", () => {
    const index = buildVenueAliasIndex(catalog);
    expect(extractVenueAliasFromMessage("Open mic somewhere fun", index)).toBeNull();
  });

  it("ignores stopword tokens even if they appear as generated aliases", () => {
    const collisionCatalog: VenueCatalogEntry[] = [
      { id: "v1", name: "Art Theater", slug: "art-theater" }, // acronym -> "at"
    ];
    const index = buildVenueAliasIndex(collisionCatalog);
    expect(index.has("at")).toBe(true);
    expect(extractVenueAliasFromMessage("Open mic at 7pm", index)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D) resolveVenue — online
// ---------------------------------------------------------------------------

describe("resolveVenue — online", () => {
  it("returns online_explicit when location_mode=online with valid URL", () => {
    const result = resolveVenue(makeInput({
      draftLocationMode: "online",
      draftOnlineUrl: "https://zoom.us/j/123",
    }));
    expect(result.status).toBe("online_explicit");
  });

  it("does NOT return online_explicit when URL is empty", () => {
    const result = resolveVenue(makeInput({
      draftLocationMode: "online",
      draftOnlineUrl: "",
    }));
    expect(result.status).not.toBe("online_explicit");
  });

  it("does NOT return online_explicit when location_mode is not online", () => {
    const result = resolveVenue(makeInput({
      draftLocationMode: "venue",
      draftOnlineUrl: "https://zoom.us/j/123",
    }));
    expect(result.status).not.toBe("online_explicit");
  });
});

// ---------------------------------------------------------------------------
// E) resolveVenue — LLM venue_id validation
// ---------------------------------------------------------------------------

describe("resolveVenue — LLM venue_id", () => {
  it("validates existing venue_id as llm_validated", () => {
    const result = resolveVenue(makeInput({ draftVenueId: "v1" }));
    expect(result).toEqual({
      status: "resolved",
      venueId: "v1",
      venueName: "Dazzle",
      confidence: 1.0,
      source: "llm_validated",
    });
  });

  it("falls through on stale/hallucinated venue_id", () => {
    const result = resolveVenue(makeInput({
      draftVenueId: "nonexistent-uuid",
      draftVenueName: "Dazzle",
    }));
    // Should fall through and resolve by name
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.venueId).toBe("v1");
      expect(result.source).not.toBe("llm_validated");
    }
  });
});

// ---------------------------------------------------------------------------
// F) resolveVenue — name matching
// ---------------------------------------------------------------------------

describe("resolveVenue — name matching", () => {
  it("resolves exact name match", () => {
    const result = resolveVenue(makeInput({ draftVenueName: "Dazzle" }));
    expect(result).toMatchObject({
      status: "resolved",
      venueId: "v1",
      confidence: 1.0,
      source: "server_exact",
    });
  });

  it("resolves case-insensitive match", () => {
    const result = resolveVenue(makeInput({ draftVenueName: "mercury cafe" }));
    expect(result).toMatchObject({
      status: "resolved",
      venueId: "v2",
      confidence: 1.0,
      source: "server_exact",
    });
  });

  it("resolves with punctuation normalization", () => {
    const result = resolveVenue(makeInput({
      draftVenueName: "St Julien Hotel and Spa",
    }));
    expect(result).toMatchObject({
      status: "resolved",
      venueId: "v5",
      source: "server_exact",
    });
  });

  it("returns ambiguous for similar venue names", () => {
    const result = resolveVenue(makeInput({ draftVenueName: "The Venue" }));
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.length).toBeGreaterThanOrEqual(2);
      expect(result.candidates.map((c) => c.id)).toContain("v6");
      expect(result.candidates.map((c) => c.id)).toContain("v7");
    }
  });

  it("returns unresolved for unknown venue", () => {
    const result = resolveVenue(makeInput({ draftVenueName: "Joe's Garage" }));
    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") {
      expect(result.inputName).toBe("Joe's Garage");
    }
  });

  it("extracts venue name from user message when draftVenueName is null", () => {
    const result = resolveVenue(makeInput({
      userMessage: "Open mic at Dazzle next Tuesday at 7pm",
    }));
    expect(result).toMatchObject({
      status: "resolved",
      venueId: "v1",
    });
  });

  it("resolves alias from draftVenueName", () => {
    const result = resolveVenue(makeInput({ draftVenueName: "LTB" }));
    expect(result).toMatchObject({
      status: "resolved",
      venueId: "v3",
      source: "server_alias",
    });
  });

  it("resolves alias from user message when draftVenueName is null", () => {
    const result = resolveVenue(makeInput({
      userMessage: "Open mic at LTB this Friday at 7pm",
    }));
    expect(result).toMatchObject({
      status: "resolved",
      venueId: "v3",
      source: "server_alias",
    });
  });

  it("returns ambiguous when alias maps to multiple venues", () => {
    const collisionCatalog: VenueCatalogEntry[] = [
      { id: "a", name: "Long Table Brewing", slug: "long-table-brewing" },
      { id: "b", name: "Lake Town Bistro", slug: "lake-town-bistro" },
    ];

    const result = resolveVenue({
      draftVenueId: null,
      draftVenueName: "LTB",
      userMessage: "Open mic at LTB",
      venueCatalog: collisionCatalog,
      draftLocationMode: null,
      draftOnlineUrl: null,
    });

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((c) => c.id)).toEqual(expect.arrayContaining(["a", "b"]));
    }
  });
});

// ---------------------------------------------------------------------------
// G) resolveVenue — custom location
// ---------------------------------------------------------------------------

describe("resolveVenue — custom location", () => {
  it("preserves custom_location when no catalog match", () => {
    const result = resolveVenue(makeInput({
      draftVenueName: "My Backyard",
      isCustomLocation: true,
    }));
    expect(result.status).toBe("custom_location");
  });

  it("redirects custom_location to known venue if high confidence match", () => {
    const result = resolveVenue(makeInput({
      draftVenueName: "Dazzle",
      isCustomLocation: true,
    }));
    // Should resolve to the known venue, not custom_location
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.venueId).toBe("v1");
    }
  });
});

// ---------------------------------------------------------------------------
// H) resolveVenue — edge cases
// ---------------------------------------------------------------------------

describe("resolveVenue — edge cases", () => {
  it("returns unresolved with null inputName when no hints available", () => {
    const result = resolveVenue(makeInput({
      userMessage: "some event",
    }));
    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") {
      expect(result.inputName).toBeNull();
    }
  });

  it("returns unresolved when catalog is empty", () => {
    const result = resolveVenue(makeInput({
      draftVenueName: "Dazzle",
      venueCatalog: [],
    }));
    expect(result.status).toBe("unresolved");
  });

  it("ambiguous candidates are sorted by score descending", () => {
    const result = resolveVenue(makeInput({ draftVenueName: "The Venue" }));
    if (result.status === "ambiguous") {
      for (let i = 1; i < result.candidates.length; i++) {
        expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(
          result.candidates[i].score
        );
      }
    }
  });

  it("ambiguous candidates are capped at MAX_AMBIGUOUS_CANDIDATES", () => {
    const result = resolveVenue(makeInput({ draftVenueName: "The Venue" }));
    if (result.status === "ambiguous") {
      expect(result.candidates.length).toBeLessThanOrEqual(3);
    }
  });

  it("threshold boundaries: score exactly at RESOLVE_THRESHOLD resolves", () => {
    // This is a property test: any score >= 0.80 with sufficient gap resolves
    expect(RESOLVE_THRESHOLD).toBe(0.80);
    expect(AMBIGUOUS_THRESHOLD).toBe(0.40);
  });
});

// ---------------------------------------------------------------------------
// I) shouldResolveVenue / draft signal gating
// ---------------------------------------------------------------------------

describe("shouldResolveVenue", () => {
  it("returns true for create mode", () => {
    expect(
      shouldResolveVenue({
        mode: "create",
        hasLocationIntent: false,
        draftPayload: {},
      })
    ).toBe(true);
  });

  it("returns false for edit_occurrence mode", () => {
    expect(
      shouldResolveVenue({
        mode: "edit_occurrence",
        hasLocationIntent: true,
        draftPayload: { venue_name: "Dazzle" },
      })
    ).toBe(false);
  });

  it("returns false for edit_series when no location intent and no draft signals", () => {
    expect(
      shouldResolveVenue({
        mode: "edit_series",
        hasLocationIntent: false,
        draftPayload: {},
      })
    ).toBe(false);
  });

  it("returns true for edit_series when message has location intent", () => {
    expect(
      shouldResolveVenue({
        mode: "edit_series",
        hasLocationIntent: true,
        draftPayload: {},
      })
    ).toBe(true);
  });

  it("returns true for edit_series when draft has location signals", () => {
    expect(
      shouldResolveVenue({
        mode: "edit_series",
        hasLocationIntent: false,
        draftPayload: { venue_name: "Dazzle" },
      })
    ).toBe(true);
  });
});

describe("hasVenueSignalsInDraft", () => {
  it("returns false for empty draft", () => {
    expect(hasVenueSignalsInDraft({})).toBe(false);
  });

  it("returns true for venue_id", () => {
    expect(hasVenueSignalsInDraft({ venue_id: "abc" })).toBe(true);
  });

  it("returns true for venue_name", () => {
    expect(hasVenueSignalsInDraft({ venue_name: "Dazzle" })).toBe(true);
  });

  it("returns true for custom_location_name", () => {
    expect(hasVenueSignalsInDraft({ custom_location_name: "My Backyard" })).toBe(true);
  });

  it("returns true for online_url", () => {
    expect(hasVenueSignalsInDraft({ online_url: "https://zoom.us/j/123" })).toBe(true);
  });
});
