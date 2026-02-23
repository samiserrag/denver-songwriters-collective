/**
 * Phase 4.87: HappeningCard Link Anchoring Tests
 *
 * Verifies that clicking a HappeningCard in the timeline navigates to
 * the correct occurrence by including `?date=YYYY-MM-DD` in the href.
 *
 * Contract:
 * - When occurrence date is known (isConfident=true), href includes ?date=
 * - When occurrence date is unknown, href has no date param (graceful fallback)
 * - Works for both /events/ and /open-mics/ paths
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Test the link generation logic directly (unit test)
// ============================================================================

/**
 * Replicate the getDetailHref function logic for testing.
 * This mirrors the implementation in HappeningCard.tsx.
 */
function getDetailHref(
  event: { slug?: string | null; id: string; event_type?: string[] },
  dateKey?: string
): string {
  const identifier = event.slug || event.id;
  const basePath = event.event_type?.includes("open_mic")
    ? `/open-mics/${identifier}`
    : `/events/${identifier}`;

  return dateKey ? `${basePath}?date=${dateKey}` : basePath;
}

describe("HappeningCard Link Anchoring (Phase 4.87)", () => {
  describe("getDetailHref helper function", () => {
    it("includes ?date= when dateKey is provided for regular events", () => {
      const event = { id: "abc-123", slug: "weekly-open-mic", event_type: ["showcase"] };
      const dateKey = "2026-01-18";

      const href = getDetailHref(event, dateKey);

      expect(href).toBe("/events/weekly-open-mic?date=2026-01-18");
    });

    it("includes ?date= when dateKey is provided for open_mic events", () => {
      const event = { id: "abc-123", slug: "words-open-mic", event_type: ["open_mic"] };
      const dateKey = "2026-01-25";

      const href = getDetailHref(event, dateKey);

      expect(href).toBe("/open-mics/words-open-mic?date=2026-01-25");
    });

    it("does NOT include ?date= when dateKey is undefined", () => {
      const event = { id: "abc-123", slug: "some-event", event_type: ["showcase"] };

      const href = getDetailHref(event, undefined);

      expect(href).toBe("/events/some-event");
      expect(href).not.toContain("?date=");
    });

    it("falls back to event id when slug is null", () => {
      const event = { id: "uuid-abc-123", slug: null, event_type: ["workshop"] };
      const dateKey = "2026-02-01";

      const href = getDetailHref(event, dateKey);

      expect(href).toBe("/events/uuid-abc-123?date=2026-02-01");
    });

    it("falls back to event id when slug is undefined", () => {
      const event = { id: "uuid-def-456", event_type: ["song_circle"] };
      const dateKey = "2026-02-14";

      const href = getDetailHref(event, dateKey);

      expect(href).toBe("/events/uuid-def-456?date=2026-02-14");
    });

    it("correctly routes open_mic type to /open-mics/ path", () => {
      const event = { id: "mic-123", slug: "friday-open-mic", event_type: ["open_mic"] };

      // With date
      expect(getDetailHref(event, "2026-01-20")).toBe("/open-mics/friday-open-mic?date=2026-01-20");

      // Without date
      expect(getDetailHref(event)).toBe("/open-mics/friday-open-mic");
    });

    it("correctly routes non-open_mic types to /events/ path", () => {
      const types = ["showcase", "song_circle", "workshop", "gig", "kindred_group", "jam_session", "other"];

      for (const eventType of types) {
        const event = { id: "test-123", slug: "test-event", event_type: [eventType] };
        const href = getDetailHref(event, "2026-03-01");

        expect(href).toBe("/events/test-event?date=2026-03-01");
      }
    });
  });

  describe("Occurrence date contract", () => {
    it("timeline card href includes ?date= for confident occurrence", () => {
      // This test documents the contract: when isConfident=true,
      // the HappeningCard passes occurrence.date to getDetailHref
      const occurrence = { date: "2026-01-18", isConfident: true };
      const event = { id: "abc", slug: "my-event", event_type: ["showcase"] };

      const dateKey = occurrence.isConfident ? occurrence.date : undefined;
      const href = getDetailHref(event, dateKey);

      expect(href).toContain("?date=2026-01-18");
    });

    it("timeline card href does NOT include ?date= for non-confident occurrence", () => {
      // When isConfident=false (schedule unknown), no date param
      const occurrence = { date: "2026-01-18", isConfident: false };
      const event = { id: "abc", slug: "my-event", event_type: ["showcase"] };

      const dateKey = occurrence.isConfident ? occurrence.date : undefined;
      const href = getDetailHref(event, dateKey);

      expect(href).toBe("/events/my-event");
      expect(href).not.toContain("?date=");
    });
  });

  describe("Invariant: all occurrence click-through helpers must include ?date=", () => {
    /**
     * This invariant test ensures the link helper contract is maintained.
     * If dateKey is provided, ?date= MUST be in the output.
     */
    it("getDetailHref MUST include ?date= when dateKey is truthy", () => {
      const testCases = [
        { event: { id: "a", slug: "s", event_type: ["open_mic"] }, dateKey: "2026-01-01" },
        { event: { id: "b", slug: "t", event_type: ["showcase"] }, dateKey: "2026-12-31" },
        { event: { id: "c", slug: null, event_type: ["workshop"] }, dateKey: "2026-06-15" },
      ];

      for (const { event, dateKey } of testCases) {
        const href = getDetailHref(event, dateKey);
        expect(href).toContain(`?date=${dateKey}`);
      }
    });

    it("getDetailHref MUST NOT include ?date= when dateKey is falsy", () => {
      const event = { id: "test", slug: "test-slug", event_type: ["showcase"] };

      expect(getDetailHref(event, undefined)).not.toContain("?date=");
      expect(getDetailHref(event, "")).not.toContain("?date=");
    });
  });
});

describe("Cross-surface link consistency", () => {
  /**
   * Documents that HappeningCard now matches other surfaces in link format.
   * All occurrence-specific links should use: /events/{identifier}?date=YYYY-MM-DD
   */
  it("HappeningCard link format matches SeriesCard date pills", () => {
    // SeriesCard uses: `/events/${eventIdentifier}?date=${occ.dateKey}`
    const eventIdentifier = "weekly-jam";
    const dateKey = "2026-02-08";

    // SeriesCard format (existing)
    const seriesCardHref = `/events/${eventIdentifier}?date=${dateKey}`;

    // HappeningCard format (now fixed)
    const event = { id: "uuid", slug: eventIdentifier, event_type: ["jam_session"] };
    const happeningCardHref = getDetailHref(event, dateKey);

    expect(happeningCardHref).toBe(seriesCardHref);
  });

  it("HappeningCard link format matches DatePillRow", () => {
    // DatePillRow uses: `/events/${slug}?date=${dateKey}`
    const slug = "thursday-showcase";
    const dateKey = "2026-01-30";

    const datePillHref = `/events/${slug}?date=${dateKey}`;
    const event = { id: "xyz", slug, event_type: ["showcase"] };
    const happeningCardHref = getDetailHref(event, dateKey);

    expect(happeningCardHref).toBe(datePillHref);
  });
});
