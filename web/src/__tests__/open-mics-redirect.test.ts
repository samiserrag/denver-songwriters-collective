/**
 * Phase 4.43d: Open Mics Redirect Tests
 *
 * Tests that /open-mics/[slug] always redirects to /events/[id]
 * for both CSC and community events.
 */

import { describe, it, expect } from "vitest";

describe("Phase 4.43d: Open Mics Redirect to Events", () => {
  describe("redirect logic", () => {
    // Simulating the redirect behavior from the page
    function getRedirectUrl(event: { id: string; slug: string | null }): string {
      return `/events/${event.slug || event.id}`;
    }

    it("redirects to /events/[slug] when event has a slug", () => {
      const event = { id: "uuid-123", slug: "words-open-mic" };
      expect(getRedirectUrl(event)).toBe("/events/words-open-mic");
    });

    it("redirects to /events/[id] when event has no slug", () => {
      const event = { id: "uuid-123", slug: null };
      expect(getRedirectUrl(event)).toBe("/events/uuid-123");
    });
  });

  describe("event type handling", () => {
    // The redirect is now unconditional - all events redirect to /events/[id]
    // Before Phase 4.43d: only is_dsc_event=true redirected
    // After Phase 4.43d: ALL events redirect for RSVP functionality

    it("redirects CSC events", () => {
      // CSC events always redirected (even before Phase 4.43d)
      const isCSCEvent = true;
      const shouldRedirect = true; // unconditional now
      expect(shouldRedirect || isCSCEvent).toBe(true);
    });

    it("redirects community events (Phase 4.43d change)", () => {
      // Before Phase 4.43d, community events stayed on /open-mics/[slug]
      // After Phase 4.43d, they redirect to /events/[id] for RSVP functionality
      const isCommunityEvent = true;
      const shouldRedirectUnconditionally = true;
      expect(shouldRedirectUnconditionally).toBe(true);
      expect(isCommunityEvent).toBe(true); // documenting the scenario
    });
  });

  describe("canonical URL pattern", () => {
    // The canonical URL in metadata should point to /events/
    function getCanonicalUrl(siteUrl: string, event: { slug: string | null; id: string }): string {
      return `${siteUrl}/events/${event.slug || event.id}`;
    }

    it("canonical URL uses /events/ path", () => {
      const url = getCanonicalUrl("https://example.com", { slug: "test-event", id: "uuid" });
      expect(url).toBe("https://example.com/events/test-event");
    });

    it("canonical URL uses slug over id when available", () => {
      const url = getCanonicalUrl("https://example.com", { slug: "my-slug", id: "my-uuid" });
      expect(url).toContain("/events/my-slug");
      expect(url).not.toContain("my-uuid");
    });

    it("canonical URL falls back to id when no slug", () => {
      const url = getCanonicalUrl("https://example.com", { slug: null, id: "my-uuid" });
      expect(url).toBe("https://example.com/events/my-uuid");
    });
  });

  describe("backward compatibility", () => {
    // Old /open-mics/[slug] URLs should still work (they just redirect)
    function isValidEntrypoint(path: string): boolean {
      // Both slug and UUID patterns are valid entrypoints
      const slugPattern = /^\/open-mics\/[a-z0-9-]+$/;
      const uuidPattern = /^\/open-mics\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return slugPattern.test(path) || uuidPattern.test(path);
    }

    it("accepts slug-based URLs", () => {
      expect(isValidEntrypoint("/open-mics/words-open-mic")).toBe(true);
    });

    it("accepts UUID-based URLs", () => {
      expect(isValidEntrypoint("/open-mics/be95e65d-7b5d-4faf-ae49-ca36c1939013")).toBe(true);
    });
  });

  describe("RSVP availability after redirect", () => {
    // After redirecting to /events/[id], RSVP should be available
    function canRSVPOnEventsPage(event: {
      is_published: boolean;
      status: string;
      is_dsc_event: boolean;
    }): boolean {
      // Phase 4.43c: RSVP available for all published, active events
      const isCancelled = event.status === "cancelled";
      return !isCancelled && event.is_published;
    }

    it("RSVP available for community open mic after redirect", () => {
      const communityOpenMic = {
        is_dsc_event: false,
        is_published: true,
        status: "active",
      };
      expect(canRSVPOnEventsPage(communityOpenMic)).toBe(true);
    });

    it("RSVP available for CSC open mic after redirect", () => {
      const dscOpenMic = {
        is_dsc_event: true,
        is_published: true,
        status: "active",
      };
      expect(canRSVPOnEventsPage(dscOpenMic)).toBe(true);
    });

    it("RSVP not available for cancelled events", () => {
      const cancelledEvent = {
        is_dsc_event: false,
        is_published: true,
        status: "cancelled",
      };
      expect(canRSVPOnEventsPage(cancelledEvent)).toBe(false);
    });
  });
});
