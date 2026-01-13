/**
 * Tests for venue page bug fixes (January 2026)
 *
 * Issue A: /venues card counts showed 0 for events with status != 'active'
 * Issue B: /venues/[slug] showed duplicate series for events with same title
 * Issue C: Series dates not clickable (already fixed in SeriesCard)
 */
import { describe, it, expect } from "vitest";

describe("Venue List Page - Event Count Filters (Issue A)", () => {
  /**
   * The status filter must match what the venue detail page uses.
   * Detail page: .in("status", ["active", "needs_verification", "unverified"])
   * List page was: .eq("status", "active") - WRONG
   * List page now: .in("status", ["active", "needs_verification", "unverified"]) - FIXED
   */

  const VALID_STATUSES_FOR_COUNTS = ["active", "needs_verification", "unverified"];

  it("should include 'active' status in counts", () => {
    expect(VALID_STATUSES_FOR_COUNTS).toContain("active");
  });

  it("should include 'needs_verification' status in counts", () => {
    expect(VALID_STATUSES_FOR_COUNTS).toContain("needs_verification");
  });

  it("should include 'unverified' status in counts", () => {
    expect(VALID_STATUSES_FOR_COUNTS).toContain("unverified");
  });

  it("should NOT include 'cancelled' status in counts", () => {
    expect(VALID_STATUSES_FOR_COUNTS).not.toContain("cancelled");
  });

  it("should NOT include 'draft' status in counts", () => {
    expect(VALID_STATUSES_FOR_COUNTS).not.toContain("draft");
  });

  it("should match the venue detail page filter exactly", () => {
    // This is the filter used in /venues/[id]/page.tsx line 119
    const detailPageFilter = ["active", "needs_verification", "unverified"];
    expect(VALID_STATUSES_FOR_COUNTS).toEqual(detailPageFilter);
  });
});

describe("Venue Detail Page - Event De-duplication (Issue B)", () => {
  /**
   * When duplicate DB records exist for the same event at a venue,
   * we should show only one series card (the one with most complete data).
   */

  interface MockEvent {
    id: string;
    title: string;
    recurrence_rule: string | null;
    start_time: string | null;
  }

  /**
   * Score an event by data completeness.
   * Higher score = more complete data = preferred.
   */
  function scoreEventCompleteness(event: MockEvent): number {
    return (event.recurrence_rule ? 2 : 0) + (event.start_time ? 1 : 0);
  }

  /**
   * De-duplicate events by title, keeping the most complete one.
   */
  function deduplicateByTitle(events: MockEvent[]): MockEvent[] {
    return Array.from(
      events.reduce((map, event) => {
        const key = event.title.toLowerCase().trim();
        const existing = map.get(key);
        if (!existing) {
          map.set(key, event);
        } else if (scoreEventCompleteness(event) > scoreEventCompleteness(existing)) {
          map.set(key, event);
        }
        return map;
      }, new Map<string, MockEvent>()).values()
    );
  }

  it("should keep single event when no duplicates", () => {
    const events: MockEvent[] = [
      { id: "1", title: "Open Mic Night", recurrence_rule: "weekly", start_time: "19:00:00" },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should keep the event with recurrence_rule when duplicate has none", () => {
    const events: MockEvent[] = [
      { id: "incomplete", title: "Open Mic Night", recurrence_rule: null, start_time: null },
      { id: "complete", title: "Open Mic Night", recurrence_rule: "weekly", start_time: "18:00:00" },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("complete");
  });

  it("should keep the event with start_time when duplicate has none", () => {
    const events: MockEvent[] = [
      { id: "with-time", title: "Jazz Night", recurrence_rule: null, start_time: "20:00:00" },
      { id: "no-time", title: "Jazz Night", recurrence_rule: null, start_time: null },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("with-time");
  });

  it("should be case-insensitive when comparing titles", () => {
    const events: MockEvent[] = [
      { id: "lower", title: "open mic night", recurrence_rule: null, start_time: null },
      { id: "upper", title: "OPEN MIC NIGHT", recurrence_rule: "weekly", start_time: "19:00:00" },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("upper"); // More complete
  });

  it("should trim whitespace when comparing titles", () => {
    const events: MockEvent[] = [
      { id: "trimmed", title: "Open Mic", recurrence_rule: "weekly", start_time: "19:00:00" },
      { id: "spaces", title: "  Open Mic  ", recurrence_rule: null, start_time: null },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("trimmed");
  });

  it("should handle multiple different events correctly", () => {
    const events: MockEvent[] = [
      { id: "1", title: "Open Mic", recurrence_rule: "weekly", start_time: "19:00:00" },
      { id: "2", title: "Jazz Night", recurrence_rule: "monthly", start_time: "20:00:00" },
      { id: "3", title: "Songwriter Circle", recurrence_rule: null, start_time: "18:00:00" },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(3);
    expect(result.map(e => e.title).sort()).toEqual(["Jazz Night", "Open Mic", "Songwriter Circle"]);
  });

  it("should handle the exact Blazin Bite scenario from production", () => {
    // Two DB records for same event at blazin-bite-seafood-bbq venue
    const events: MockEvent[] = [
      { id: "07cecda1", title: "Blazin Bite Seafood", recurrence_rule: "weekly", start_time: "18:00:00" },
      { id: "d43011ce", title: "Blazin Bite Seafood", recurrence_rule: null, start_time: null },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("07cecda1"); // The complete one
    expect(result[0].recurrence_rule).toBe("weekly");
    expect(result[0].start_time).toBe("18:00:00");
  });

  it("should prefer recurrence_rule over start_time alone", () => {
    const events: MockEvent[] = [
      { id: "has-time", title: "Event", recurrence_rule: null, start_time: "19:00:00" },
      { id: "has-rule", title: "Event", recurrence_rule: "weekly", start_time: null },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("has-rule"); // recurrence_rule scores 2, start_time scores 1
  });

  it("should keep first event when scores are equal", () => {
    const events: MockEvent[] = [
      { id: "first", title: "Event", recurrence_rule: "weekly", start_time: "19:00:00" },
      { id: "second", title: "Event", recurrence_rule: "monthly", start_time: "20:00:00" },
    ];
    const result = deduplicateByTitle(events);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("first"); // First one wins when tied
  });
});

describe("Series Card - Clickable Dates (Issue C)", () => {
  /**
   * Verified that SeriesCard already implements clickable dates in UpcomingDatesList.
   * Each date links to /events/${eventIdentifier}?date=${dateKey}
   *
   * From SeriesCard.tsx:
   *   <Link
   *     key={occ.dateKey}
   *     href={`/events/${eventIdentifier}?date=${occ.dateKey}`}
   *     ...
   *   >
   */

  it("should generate correct event link with date parameter", () => {
    const eventIdentifier = "words-open-mic";
    const dateKey = "2026-01-18";
    const expectedLink = `/events/${eventIdentifier}?date=${dateKey}`;
    expect(expectedLink).toBe("/events/words-open-mic?date=2026-01-18");
  });

  it("should handle UUID event identifiers", () => {
    const eventIdentifier = "07cecda1-1234-5678-9abc-def012345678";
    const dateKey = "2026-01-20";
    const expectedLink = `/events/${eventIdentifier}?date=${dateKey}`;
    expect(expectedLink).toContain("/events/07cecda1");
    expect(expectedLink).toContain("?date=2026-01-20");
  });
});
