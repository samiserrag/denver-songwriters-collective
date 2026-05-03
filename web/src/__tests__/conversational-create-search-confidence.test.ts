import { describe, expect, it } from "vitest";
import {
  buildConciergeSearchEvidenceDisplay,
  shouldSuppressVenueAddressQuestion,
} from "../app/(protected)/dashboard/my-events/_components/conciergeSearchEvidence";
import type { WebSearchVerificationResult } from "../lib/events/interpretEventContract";

const source = { url: "https://example.com/rmu-breckenridge", title: "RMU Breckenridge", domain: "example.com" };
const mapsSource = { url: "https://maps.app.goo.gl/example", title: "Google Maps", domain: "maps.app.goo.gl" };

function baseVerification(overrides: Partial<WebSearchVerificationResult> = {}): WebSearchVerificationResult {
  return {
    status: "searched",
    summary: "Search completed.",
    facts: [],
    sources: [source],
    venue_search: {
      status: "verified",
      summary: "Official venue page found for RMU Breckenridge.",
      confidence: "high",
      attempted_queries: ["RMU Breck", "RMU Breckenridge", "@rmubreck", "RMU Breckenridge address"],
      facts: ["Official venue page confirms the RMU Breckenridge address in Breckenridge, CO 80424."],
      sources: [source],
    },
    event_search: {
      status: "not_found",
      summary: "No exact public open mic listing was found.",
      confidence: "medium",
      attempted_queries: ["RMU Breckenridge open mic"],
      facts: [],
      sources: [],
    },
    fact_buckets: {
      user_provided: ["User asked to search for RMU Breckenridge."],
      extracted: ["Flyer says open mic every Wednesday 7-9pm."],
      inferred: [],
      searched_verified: ["RMU Breckenridge official venue page found with high confidence."],
      conflicts: [],
      true_unknowns: ["cost", "signup link", "direct source link"],
    },
    suggested_questions: [],
    ...overrides,
  };
}

describe("CRUI concierge source-confidence display", () => {
  it("shows partial success and suppresses street-address questions when venue is verified and exact-event search times out", () => {
    const display = buildConciergeSearchEvidenceDisplay({
      verification: baseVerification({
        event_search: {
          status: "timeout",
          summary: "Exact-event search timed out before returning a public open mic listing.",
          confidence: "unknown",
          attempted_queries: ["RMU Breckenridge open mic"],
          facts: [],
          sources: [],
        },
      }),
      draftPayload: {
        venue_name: "RMU Breckenridge",
        custom_address: "114 S Main St",
        custom_city: "Breckenridge",
        custom_state: "CO",
      },
    });

    expect(display?.kind).toBe("venue_partial");
    expect(display?.summary).toContain("I found source-backed venue details for RMU Breckenridge");
    expect(display?.summary).toContain("Exact-event search timed out");
    expect(display?.summary).toContain("flyer/post");
    expect(shouldSuppressVenueAddressQuestion({
      display,
      clarificationQuestion: "What is the street address?",
      blockingFields: ["custom_address"],
    })).toBe(true);
  });

  it("shows missing event details only when venue is verified and exact-event search misses", () => {
    const display = buildConciergeSearchEvidenceDisplay({
      verification: baseVerification(),
      draftPayload: { venue_name: "RMU Breckenridge" },
    });

    expect(display?.kind).toBe("venue_partial");
    expect(display?.summary).toContain("I did not find a public listing for this exact event");
    expect(display?.missingFields).toEqual(["cost", "signup link", "source link"]);
    expect(display?.followupQuestion).toBe("Optional details still unknown: cost, signup link, and source link.");
    expect(display?.missingFields).not.toContain("address");
  });

  it("reports venue and exact-event timeout categories separately when all search times out", () => {
    const display = buildConciergeSearchEvidenceDisplay({
      verification: baseVerification({
        status: "no_reliable_sources",
        summary: "Search timed out.",
        sources: [],
        venue_search: {
          status: "timeout",
          summary: "Venue search timed out.",
          confidence: "unknown",
          attempted_queries: ["RMU Breck", "RMU Breckenridge address"],
          facts: [],
          sources: [],
        },
        event_search: {
          status: "timeout",
          summary: "Exact-event search timed out.",
          confidence: "unknown",
          attempted_queries: ["RMU Breckenridge open mic"],
          facts: [],
          sources: [],
        },
      }),
    });

    expect(display?.kind).toBe("all_timeout");
    expect(display?.summary).toContain("Search timed out");
    expect(display?.details).toContain("Venue search tried: RMU Breck, RMU Breckenridge address");
    expect(display?.details).toContain("Exact-event search tried: RMU Breckenridge open mic");
  });

  it("preserves existing checked-source display when the exact event is verified", () => {
    const display = buildConciergeSearchEvidenceDisplay({
      verification: baseVerification({
        summary: "Exact event listing found.",
        event_search: {
          status: "verified",
          summary: "Exact recurring open mic listing found.",
          confidence: "high",
          attempted_queries: ["RMU Breckenridge open mic"],
          facts: ["Public listing confirms the recurring open mic."],
          sources: [source],
        },
      }),
      draftPayload: { venue_name: "RMU Breckenridge" },
    });

    expect(display?.kind).toBe("event_verified");
    expect(display?.label).toBe("Checked online");
    expect(display?.summary).toBe("Exact event listing found.");
    expect(display?.sourceLinks).toEqual([source]);
  });

  it("preserves normal fallback when no venue confidence exists", () => {
    const display = buildConciergeSearchEvidenceDisplay({
      verification: baseVerification({
        status: "no_reliable_sources",
        summary: "Search did not find reliable venue or exact-event sources.",
        sources: [],
        venue_search: {
          status: "not_found",
          summary: "No reliable venue source was returned.",
          confidence: "unknown",
          attempted_queries: ["Unknown venue"],
          facts: [],
          sources: [],
        },
        event_search: {
          status: "not_found",
          summary: "No reliable exact event source was returned.",
          confidence: "unknown",
          attempted_queries: ["Unknown venue open mic"],
          facts: [],
          sources: [],
        },
      }),
    });

    expect(display?.kind).toBe("no_confidence");
    expect(display?.label).toBe("Search tried");
    expect(shouldSuppressVenueAddressQuestion({
      display,
      clarificationQuestion: "What is the street address?",
      blockingFields: ["custom_address"],
    })).toBe(false);
  });

  it("filters Google Maps URLs from displayed source links so they are not treated as event external sources", () => {
    const display = buildConciergeSearchEvidenceDisplay({
      verification: baseVerification({ sources: [mapsSource, source] }),
      draftPayload: { venue_name: "RMU Breckenridge" },
    });

    expect(display?.sourceLinks).toEqual([source]);
  });

  it("uses category-level venue sources when the top-level source union is empty", () => {
    const display = buildConciergeSearchEvidenceDisplay({
      verification: baseVerification({ sources: [] }),
      draftPayload: { venue_name: "RMU Breckenridge" },
    });

    expect(display?.sourceLinks).toEqual([source]);
  });
});
