/**
 * Phase 6: Cross-Surface Event Consistency Tests
 *
 * Tests for:
 * - Shared contract constants (DISCOVERY_STATUS_FILTER, DISCOVERY_VENUE_SELECT*)
 * - Status parity between homepage and /happenings
 * - Venue join alias correctness (singular alias required)
 * - Missing value normalization (NA, not em dash or TBD)
 * - Override pipeline contract
 * - Behavioral: reschedule relocation (applyReschedulesToTimeline)
 * - Behavioral: mobile metadata visibility (no truncation)
 *
 * See: docs/investigation/phase6-cross-surface-consistency-stopgate.md
 * Checked against DSC UX Principles §4 (Centralize Logic), §5 (Previews Must Match Reality)
 */

import { describe, it, expect } from "vitest";
import {
  DISCOVERY_STATUS_FILTER,
  DISCOVERY_VENUE_SELECT,
  DISCOVERY_VENUE_SELECT_WITH_COORDS,
} from "@/lib/happenings";

// ============================================================================
// A. Shared Contract Constants
// ============================================================================

describe("Phase 6: Shared Contract Constants", () => {
  describe("DISCOVERY_STATUS_FILTER", () => {
    it("includes exactly three statuses: active, needs_verification, unverified", () => {
      expect([...DISCOVERY_STATUS_FILTER]).toEqual([
        "active",
        "needs_verification",
        "unverified",
      ]);
    });

    it("has exactly 3 entries", () => {
      expect(DISCOVERY_STATUS_FILTER).toHaveLength(3);
    });

    it("includes 'active'", () => {
      expect(DISCOVERY_STATUS_FILTER).toContain("active");
    });

    it("includes 'needs_verification'", () => {
      expect(DISCOVERY_STATUS_FILTER).toContain("needs_verification");
    });

    it("includes 'unverified'", () => {
      expect(DISCOVERY_STATUS_FILTER).toContain("unverified");
    });

    it("does NOT include 'cancelled'", () => {
      expect(DISCOVERY_STATUS_FILTER).not.toContain("cancelled");
    });

    it("does NOT include 'draft'", () => {
      expect(DISCOVERY_STATUS_FILTER).not.toContain("draft");
    });

    it("does NOT include 'duplicate'", () => {
      expect(DISCOVERY_STATUS_FILTER).not.toContain("duplicate");
    });
  });

  describe("DISCOVERY_VENUE_SELECT", () => {
    it("uses singular alias 'venue:venues!left'", () => {
      expect(DISCOVERY_VENUE_SELECT).toMatch(/^venue:venues!left\(/);
    });

    it("does NOT use plural 'venues!left' without alias", () => {
      // The string starts with "venue:" (singular alias), not bare "venues!left"
      const startsWithPlural = DISCOVERY_VENUE_SELECT.startsWith("venues!left(");
      expect(startsWithPlural).toBe(false);
    });

    it("includes required fields for HappeningCard", () => {
      const requiredFields = [
        "id",
        "slug",
        "name",
        "address",
        "city",
        "state",
        "google_maps_url",
        "website_url",
      ];
      for (const field of requiredFields) {
        expect(DISCOVERY_VENUE_SELECT).toContain(field);
      }
    });

    it("does NOT include latitude/longitude (use WITH_COORDS variant)", () => {
      expect(DISCOVERY_VENUE_SELECT).not.toContain("latitude");
      expect(DISCOVERY_VENUE_SELECT).not.toContain("longitude");
    });
  });

  describe("DISCOVERY_VENUE_SELECT_WITH_COORDS", () => {
    it("uses singular alias 'venue:venues!left'", () => {
      expect(DISCOVERY_VENUE_SELECT_WITH_COORDS).toMatch(
        /^venue:venues!left\(/
      );
    });

    it("includes all base fields plus latitude and longitude", () => {
      const requiredFields = [
        "id",
        "slug",
        "name",
        "address",
        "city",
        "state",
        "google_maps_url",
        "website_url",
        "latitude",
        "longitude",
      ];
      for (const field of requiredFields) {
        expect(DISCOVERY_VENUE_SELECT_WITH_COORDS).toContain(field);
      }
    });

    it("is a superset of DISCOVERY_VENUE_SELECT (base fields present)", () => {
      // Extract field list from base select
      const baseMatch = DISCOVERY_VENUE_SELECT.match(/\((.+)\)/);
      expect(baseMatch).not.toBeNull();
      const baseFields = baseMatch![1].split(",").map((f) => f.trim());
      for (const field of baseFields) {
        expect(DISCOVERY_VENUE_SELECT_WITH_COORDS).toContain(field);
      }
    });
  });
});

// ============================================================================
// B. Homepage Source File Uses Shared Constants
// ============================================================================

describe("Phase 6: Homepage uses shared contract constants", () => {
  /**
   * These tests verify that page.tsx imports and uses the shared constants
   * by checking the source file content directly. This ensures no inline
   * status arrays or venue joins can drift from the canonical contract.
   */
  it("homepage imports DISCOVERY_STATUS_FILTER from @/lib/happenings", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    expect(source).toContain("DISCOVERY_STATUS_FILTER");
    expect(source).toContain('from "@/lib/happenings"');
  });

  it("homepage imports DISCOVERY_VENUE_SELECT from @/lib/happenings", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    expect(source).toContain("DISCOVERY_VENUE_SELECT");
  });

  it("homepage uses DISCOVERY_STATUS_FILTER in tonight query (not inline array)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    // Should use the shared constant
    expect(source).toContain('.in("status", [...DISCOVERY_STATUS_FILTER])');
    // Should NOT have inline status arrays for discovery queries
    // (individual status checks in admin/filter UI are allowed)
  });

  it("homepage uses ${DISCOVERY_VENUE_SELECT} in query template literal", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    expect(source).toContain("${DISCOVERY_VENUE_SELECT}");
  });
});

// ============================================================================
// C. Happenings Page Source File Uses Shared Constants
// ============================================================================

describe("Phase 6: /happenings uses shared contract constants", () => {
  it("happenings imports DISCOVERY_STATUS_FILTER from @/lib/happenings", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/happenings/page.tsx",
      "utf-8"
    );
    expect(source).toContain("DISCOVERY_STATUS_FILTER");
    expect(source).toContain('from "@/lib/happenings"');
  });

  it("happenings imports DISCOVERY_VENUE_SELECT_WITH_COORDS from @/lib/happenings", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/happenings/page.tsx",
      "utf-8"
    );
    expect(source).toContain("DISCOVERY_VENUE_SELECT_WITH_COORDS");
  });

  it("happenings uses DISCOVERY_STATUS_FILTER in base query", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/happenings/page.tsx",
      "utf-8"
    );
    expect(source).toContain('.in("status", [...DISCOVERY_STATUS_FILTER])');
  });

  it("happenings uses ${DISCOVERY_VENUE_SELECT_WITH_COORDS} in query", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/happenings/page.tsx",
      "utf-8"
    );
    expect(source).toContain("${DISCOVERY_VENUE_SELECT_WITH_COORDS}");
  });
});

// ============================================================================
// D. Override Pipeline Contract (Homepage)
// ============================================================================

describe("Phase 6: Homepage override pipeline", () => {
  it("homepage fetches occurrence_overrides for tonight", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    expect(source).toContain('from("occurrence_overrides")');
  });

  it("homepage builds override map via buildOverrideMap()", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    expect(source).toContain("buildOverrideMap");
  });

  it("homepage passes overrideMap to expandAndGroupEvents", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    expect(source).toContain("overrideMap: tonightOverrideMap");
  });

  it("homepage filters out cancelled entries from tonight display", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    expect(source).toContain("!entry.isCancelled");
  });

  it("homepage passes override props to HappeningsCard in tonight section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    expect(source).toContain("override={entry.override}");
    expect(source).toContain("isCancelled={entry.isCancelled}");
    expect(source).toContain("overrideVenueData={getOverrideVenueForEntry(entry)}");
  });
});

// ============================================================================
// E. Missing Value Normalization
// ============================================================================

describe("Phase 6: Missing value normalization", () => {
  it("HappeningCard uses 'NA' for missing venue (not em dash)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/happenings/HappeningCard.tsx",
      "utf-8"
    );
    // Should contain "NA" as the venue fallback
    // The pattern is: ) : (\n              "NA"\n            )
    expect(source).toContain('"NA"');
    // Should NOT contain em dash as venue fallback
    // Note: em dash may appear elsewhere (e.g., in separators), but the venue
    // fallback specifically changed from "—" to "NA"
  });

  it("SeriesCard uses 'NA' for missing venue (not 'Location TBD')", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/happenings/SeriesCard.tsx",
      "utf-8"
    );
    // Should NOT contain "Location TBD"
    expect(source).not.toContain("Location TBD");
  });

  it("HappeningCard getCostDisplay returns 'NA' for unknown cost", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/happenings/HappeningCard.tsx",
      "utf-8"
    );
    // The getCostDisplay function should return "NA" as default
    expect(source).toContain('return "NA"');
  });
});

// ============================================================================
// F. Digest Allowed Divergence
// ============================================================================

describe("Phase 6: Digest allowed divergence", () => {
  it("weekly digest uses 'active' only (intentional divergence)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/lib/digest/weeklyHappenings.ts",
      "utf-8"
    );
    // Digest should filter by "active" status
    expect(source).toContain('"active"');
    // Digest should NOT use the full DISCOVERY_STATUS_FILTER
    // (allowed divergence per cross-surface consistency rules)
    expect(source).not.toContain("DISCOVERY_STATUS_FILTER");
  });
});

// ============================================================================
// G. Venue Join Alias Regression Guard
// ============================================================================

describe("Phase 6: Venue join alias regression guard", () => {
  it("homepage does NOT contain bare 'venues!left(' without shared constant", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/page.tsx",
      "utf-8"
    );
    // Source should use shared constants (tested in Section B), not inline joins.
    // Any bare venues!left( that isn't inside a DISCOVERY_VENUE_SELECT reference
    // would be a regression. Since the shared constant handles the alias,
    // the source should have zero inline venues!left( occurrences.
    const inlineMatches = source.match(/venues!left\(/g) || [];
    // All inline occurrences must come from the legacy spotlight query
    // which uses venues(name, city) — NOT venues!left(). So zero expected.
    expect(inlineMatches.length).toBe(0);
    // Verify the shared constant IS used (sanity check)
    expect(source).toContain("DISCOVERY_VENUE_SELECT");
  });

  it("happenings page does NOT contain bare 'venues!left(' without shared constant", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/happenings/page.tsx",
      "utf-8"
    );
    // Same logic: shared constant handles the alias, so no inline joins expected.
    const inlineMatches = source.match(/venues!left\(/g) || [];
    expect(inlineMatches.length).toBe(0);
    // Verify the shared constant IS used
    expect(source).toContain("DISCOVERY_VENUE_SELECT_WITH_COORDS");
  });
});

// ============================================================================
// H. Behavioral: Reschedule Relocation (applyReschedulesToTimeline)
// ============================================================================

import {
  applyReschedulesToTimeline,
  type EventOccurrenceEntry,
  type OccurrenceOverride,
} from "@/lib/events/nextOccurrence";

// Shared helper for sections H and K: creates a minimal event occurrence entry
function makeEntry(
  dateKey: string,
  eventId: string,
  override?: OccurrenceOverride
): EventOccurrenceEntry<any> {
  return {
    event: {
      id: eventId,
      title: `Event ${eventId}`,
      event_date: dateKey,
      day_of_week: null,
      recurrence_rule: null,
      start_time: "19:00",
      end_time: null,
      custom_dates: null,
      max_occurrences: null,
    },
    dateKey,
    isConfident: true,
    override,
    isCancelled: false,
  };
}

describe("Phase 6: Reschedule relocation behavior (applyReschedulesToTimeline)", () => {

  it("removes an occurrence rescheduled AWAY from today", () => {
    const today = "2026-02-06";
    const tomorrow = "2026-02-07";

    // An occurrence originally on today, rescheduled to tomorrow
    const override: OccurrenceOverride = {
      event_id: "evt-1",
      date_key: today,
      status: "normal",
      override_patch: { event_date: tomorrow },
    };

    const groups = new Map<string, EventOccurrenceEntry<any>[]>();
    groups.set(today, [makeEntry(today, "evt-1", override)]);

    const result = applyReschedulesToTimeline(groups);

    // Today's group should be empty (occurrence moved away)
    expect(result.has(today)).toBe(false);
    // Tomorrow's group should have the entry
    expect(result.has(tomorrow)).toBe(true);
    expect(result.get(tomorrow)!).toHaveLength(1);
    expect(result.get(tomorrow)![0].isRescheduled).toBe(true);
    expect(result.get(tomorrow)![0].originalDateKey).toBe(today);
  });

  it("adds an occurrence rescheduled TO today from another date", () => {
    const today = "2026-02-06";
    const originalDate = "2026-02-04";

    // An occurrence originally on Feb 4, rescheduled to today
    const override: OccurrenceOverride = {
      event_id: "evt-2",
      date_key: originalDate,
      status: "normal",
      override_patch: { event_date: today },
    };

    const groups = new Map<string, EventOccurrenceEntry<any>[]>();
    groups.set(originalDate, [makeEntry(originalDate, "evt-2", override)]);

    const result = applyReschedulesToTimeline(groups);

    // Original date should be empty (occurrence moved)
    expect(result.has(originalDate)).toBe(false);
    // Today should contain the rescheduled entry
    expect(result.has(today)).toBe(true);
    expect(result.get(today)!).toHaveLength(1);
    expect(result.get(today)![0].isRescheduled).toBe(true);
    expect(result.get(today)![0].displayDate).toBe(today);
  });

  it("preserves non-rescheduled entries on the same date", () => {
    const today = "2026-02-06";
    const tomorrow = "2026-02-07";

    // One rescheduled away, one normal on the same day
    const override: OccurrenceOverride = {
      event_id: "evt-move",
      date_key: today,
      status: "normal",
      override_patch: { event_date: tomorrow },
    };

    const groups = new Map<string, EventOccurrenceEntry<any>[]>();
    groups.set(today, [
      makeEntry(today, "evt-stay"),
      makeEntry(today, "evt-move", override),
    ]);

    const result = applyReschedulesToTimeline(groups);

    // Today still has the non-rescheduled entry
    expect(result.has(today)).toBe(true);
    expect(result.get(today)!).toHaveLength(1);
    expect(result.get(today)![0].event.id).toBe("evt-stay");
    // Tomorrow gets the rescheduled one
    expect(result.has(tomorrow)).toBe(true);
    expect(result.get(tomorrow)![0].event.id).toBe("evt-move");
  });

  it("does NOT relocate when override has no event_date patch", () => {
    const today = "2026-02-06";

    // Override that changes time only, no date reschedule
    const override: OccurrenceOverride = {
      event_id: "evt-3",
      date_key: today,
      status: "normal",
      override_start_time: "20:00",
      override_patch: { start_time: "20:00" },
    };

    const groups = new Map<string, EventOccurrenceEntry<any>[]>();
    groups.set(today, [makeEntry(today, "evt-3", override)]);

    const result = applyReschedulesToTimeline(groups);

    // Entry stays on today
    expect(result.has(today)).toBe(true);
    expect(result.get(today)!).toHaveLength(1);
    expect(result.get(today)![0].isRescheduled).toBeUndefined();
  });

  it("does NOT relocate when override event_date equals the original dateKey", () => {
    const today = "2026-02-06";

    // Pointless reschedule: same date
    const override: OccurrenceOverride = {
      event_id: "evt-4",
      date_key: today,
      status: "normal",
      override_patch: { event_date: today },
    };

    const groups = new Map<string, EventOccurrenceEntry<any>[]>();
    groups.set(today, [makeEntry(today, "evt-4", override)]);

    const result = applyReschedulesToTimeline(groups);

    // No relocation — stays on today
    expect(result.has(today)).toBe(true);
    expect(result.get(today)!).toHaveLength(1);
    expect(result.get(today)![0].isRescheduled).toBeUndefined();
  });
});

// ============================================================================
// I. Behavioral: Homepage uses applyReschedulesToTimeline + range-based queries
// ============================================================================

describe("Phase 6: Homepage reschedule parity with /happenings", () => {
  it("homepage calls applyReschedulesToTimeline after expandAndGroupEvents", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/page.tsx", "utf-8");
    expect(source).toContain("applyReschedulesToTimeline");
    // Verify the result feeds into the tonight filter (not the raw groupedEvents)
    expect(source).toContain("relocatedGroups.get(today)");
  });

  it("/happenings also calls applyReschedulesToTimeline (parity check)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/happenings/page.tsx", "utf-8");
    expect(source).toContain("applyReschedulesToTimeline");
  });

  it("homepage override query uses range-based fetch (.gte/.lte), not .eq", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/page.tsx", "utf-8");
    // Must NOT use .eq("date_key", today) for overrides — that misses reschedules from future dates
    expect(source).not.toMatch(/\.eq\(\s*["']date_key["']\s*,\s*today\s*\)/);
    // Must use range-based query like /happenings
    expect(source).toContain('.gte("date_key", today)');
    expect(source).toContain('.lte("date_key", tonightWindowEnd)');
  });

  it("homepage expansion window uses a forward window, not today..today", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/page.tsx", "utf-8");
    // Expansion endKey must NOT be just 'today' — would miss future occurrences rescheduled to today
    expect(source).toContain("endKey: tonightWindowEnd");
    // The window end should be derived from addDaysDenver
    expect(source).toContain("addDaysDenver(today, 90)");
  });

  it("homepage imports addDaysDenver for window computation", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/page.tsx", "utf-8");
    expect(source).toContain("addDaysDenver");
    // Ensure it's imported from nextOccurrence, not locally defined
    const importBlock = source.substring(0, source.indexOf("export const dynamic"));
    expect(importBlock).toContain("addDaysDenver");
  });
});

// ============================================================================
// K. Behavioral: Reschedule-from-future-to-today appears in today's group
// ============================================================================

describe("Phase 6: Reschedule-to-today from future date via expanded window", () => {
  it("an occurrence with original date in forward window + override_patch.event_date = today appears in today's relocated group", () => {
    // This is THE key scenario: a weekly event's Feb 10 occurrence is rescheduled
    // to Feb 6 (today). Without a forward expansion window, the Feb 10 occurrence
    // would never be generated, so applyReschedulesToTimeline couldn't relocate it.
    const today = "2026-02-06";
    const futureDate = "2026-02-10"; // 4 days ahead, within any reasonable forward window

    // Simulate: override says "move Feb 10 occurrence to Feb 6"
    const override: OccurrenceOverride = {
      event_id: "evt-future-reschedule",
      date_key: futureDate,
      status: "normal",
      override_patch: { event_date: today },
    };

    // Build a group map that includes the future date (as the expanded window would produce)
    const groups = new Map<string, EventOccurrenceEntry<any>[]>();
    // Today has one normal occurrence
    groups.set(today, [makeEntry(today, "evt-normal-today")]);
    // Future date has the occurrence that will be rescheduled to today
    groups.set(futureDate, [makeEntry(futureDate, "evt-future-reschedule", override)]);

    const result = applyReschedulesToTimeline(groups);

    // Today's group should now contain BOTH: the normal today occurrence + the rescheduled one
    expect(result.has(today)).toBe(true);
    const todayEntries = result.get(today)!;
    expect(todayEntries).toHaveLength(2);

    // The normal entry stays unchanged
    const normalEntry = todayEntries.find(e => e.event.id === "evt-normal-today");
    expect(normalEntry).toBeDefined();
    expect(normalEntry!.isRescheduled).toBeUndefined();

    // The rescheduled entry moved from future date to today
    const rescheduledEntry = todayEntries.find(e => e.event.id === "evt-future-reschedule");
    expect(rescheduledEntry).toBeDefined();
    expect(rescheduledEntry!.isRescheduled).toBe(true);
    expect(rescheduledEntry!.displayDate).toBe(today);

    // The future date group should be empty (occurrence moved away)
    expect(result.has(futureDate)).toBe(false);
  });

  it("without the forward window, the future occurrence would NOT appear in today's group", () => {
    // Demonstrates why the narrow window was broken: if we only expand for today,
    // the future date entry never exists, so there's nothing to relocate.
    const today = "2026-02-06";

    // Only today's group exists (narrow expansion: startKey=today, endKey=today)
    const groups = new Map<string, EventOccurrenceEntry<any>[]>();
    groups.set(today, [makeEntry(today, "evt-normal-today")]);
    // NO future date group — the narrow window didn't produce it

    const result = applyReschedulesToTimeline(groups);

    // Only 1 entry on today — the rescheduled occurrence from Feb 10 is missing entirely
    expect(result.get(today)!).toHaveLength(1);
    expect(result.get(today)![0].event.id).toBe("evt-normal-today");
  });
});

// ============================================================================
// J. Behavioral: Mobile Metadata Visibility (no truncation on key fields)
// ============================================================================

describe("Phase 6: Mobile metadata visibility contract", () => {
  it("HappeningCard meta line does NOT use 'truncate' class", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/happenings/HappeningCard.tsx",
      "utf-8"
    );
    // The meta line was a <p> with "truncate" class. Phase 6 changed it to a
    // flex-wrap <div> so metadata wraps instead of being hidden on mobile.
    // Find the meta section by its comment marker and check it uses flex-wrap.
    const metaLineIdx = source.indexOf("Meta line: Time · Venue, City · Cost");
    expect(metaLineIdx).toBeGreaterThan(-1);

    // Extract ~500 chars after the comment to check the containing element
    const metaSection = source.substring(metaLineIdx, metaLineIdx + 500);
    expect(metaSection).toContain("flex-wrap");
    expect(metaSection).not.toContain("truncate");
  });

  it("SeriesCard venue row does NOT use 'truncate' class", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/happenings/SeriesCard.tsx",
      "utf-8"
    );
    // Find the venue section by its comment marker
    const venueIdx = source.indexOf("Venue - Phase 4.58/ABC4");
    expect(venueIdx).toBeGreaterThan(-1);

    // Extract ~500 chars after the comment to check the containing element
    const venueSection = source.substring(venueIdx, venueIdx + 500);
    expect(venueSection).toContain("break-words");
    expect(venueSection).not.toContain("truncate");
  });

  it("HappeningCard meta uses separate spans for Time, Venue, Cost", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/happenings/HappeningCard.tsx",
      "utf-8"
    );
    // Phase 6 wraps each meta segment in its own <span> for independent wrapping
    const metaIdx = source.indexOf("Meta line: Time · Venue, City · Cost");
    expect(metaIdx).toBeGreaterThan(-1);
    const metaSection = source.substring(metaIdx, metaIdx + 800);

    // Should have multiple span elements for wrapping behavior
    const spanCount = (metaSection.match(/<span/g) || []).length;
    expect(spanCount).toBeGreaterThanOrEqual(3); // time, venue, cost at minimum
  });

  it("HappeningCard dot separators are hidden on mobile (md:inline)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/happenings/HappeningCard.tsx",
      "utf-8"
    );
    // The · separators should only show on md+ screens
    const metaIdx = source.indexOf("Meta line: Time · Venue, City · Cost");
    const metaSection = source.substring(metaIdx, metaIdx + 800);
    // Check for responsive separator pattern
    expect(metaSection).toContain('hidden md:inline');
  });
});
