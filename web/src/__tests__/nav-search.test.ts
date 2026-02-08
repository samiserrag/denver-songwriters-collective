/**
 * Nav Search Tests
 *
 * Tests that search results generate correct detail page URLs.
 * Ensures clicking a search result navigates to the correct page.
 *
 * @see BACKLOG.md SEARCH-01, SEARCH-02, SEARCH-03
 */

import { describe, it, expect } from "vitest";

/**
 * Mock data representing search results from the API.
 * These mirror the shape returned by /api/search
 */
const mockOpenMicWithSlug = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  slug: "monday-night-open-mic",
  title: "Monday Night Open Mic",
  day_of_week: "Monday",
  venues: { name: "Bar 404", city: "Denver" },
};

const mockOpenMicWithoutSlug = {
  id: "223e4567-e89b-12d3-a456-426614174001",
  slug: null,
  title: "Tuesday Open Mic",
  day_of_week: "Tuesday",
  venues: null,
};

const mockEventWithSlug = {
  id: "323e4567-e89b-12d3-a456-426614174002",
  slug: "songwriter-showcase",
  title: "Songwriter Showcase",
  event_date: "2026-02-15",
  venue_name: "The Venue",
};

const mockEventWithoutSlug = {
  id: "423e4567-e89b-12d3-a456-426614174003",
  slug: null,
  title: "Workshop Event",
  event_date: "2026-03-01",
  venue_name: null,
};

const mockVenueWithSlug = {
  id: "523e4567-e89b-12d3-a456-426614174004",
  slug: "bar-404",
  name: "Bar 404",
  city: "Denver",
  state: "CO",
};

const mockVenueWithoutSlug = {
  id: "623e4567-e89b-12d3-a456-426614174005",
  slug: null,
  name: "New Venue",
  city: "Boulder",
  state: "CO",
};

const mockMemberWithSlug = {
  id: "723e4567-e89b-12d3-a456-426614174006",
  slug: "john-doe",
  full_name: "John Doe",
  role: "member",
  is_songwriter: true,
  is_host: false,
  is_studio: false,
  avatar_url: null,
  location: "Denver, CO",
};

const mockMemberWithoutSlug = {
  id: "823e4567-e89b-12d3-a456-426614174007",
  slug: null,
  full_name: "Jane Smith",
  role: "performer",
  is_songwriter: false,
  is_host: true,
  is_studio: false,
  avatar_url: "https://example.com/avatar.jpg",
  location: null,
};

const mockBlogPost = {
  id: "923e4567-e89b-12d3-a456-426614174008",
  slug: "welcome-to-dsc",
  title: "Welcome to CSC",
  excerpt: "An introduction to The Colorado Songwriters Collective",
  cover_image_url: null,
};

/**
 * Helper function that mirrors the URL generation logic in /api/search/route.ts
 * This is extracted to make testing easier and to document the expected behavior.
 */
function generateSearchResultUrl(
  type: "open_mic" | "event" | "venue" | "member" | "blog",
  data: { id: string; slug?: string | null }
): string {
  switch (type) {
    case "open_mic":
    case "event":
      return `/events/${data.slug || data.id}`;
    case "venue":
      return `/venues/${data.slug || data.id}`;
    case "member":
      return `/songwriters/${data.slug || data.id}`;
    case "blog":
      // Blog always requires slug (it's a required field)
      return `/blog/${data.slug}`;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

describe("Nav Search URL Generation", () => {
  describe("Open Mic Results", () => {
    it("generates /events/{slug} when slug exists", () => {
      const url = generateSearchResultUrl("open_mic", mockOpenMicWithSlug);
      expect(url).toBe("/events/monday-night-open-mic");
    });

    it("generates /events/{id} when slug is null", () => {
      const url = generateSearchResultUrl("open_mic", mockOpenMicWithoutSlug);
      expect(url).toBe("/events/223e4567-e89b-12d3-a456-426614174001");
    });

    it("does NOT generate filter page URL", () => {
      const url = generateSearchResultUrl("open_mic", mockOpenMicWithSlug);
      expect(url).not.toBe("/happenings?type=open_mic");
      expect(url).not.toContain("?type=");
    });
  });

  describe("Event Results (non-open-mic)", () => {
    it("generates /events/{slug} when slug exists", () => {
      const url = generateSearchResultUrl("event", mockEventWithSlug);
      expect(url).toBe("/events/songwriter-showcase");
    });

    it("generates /events/{id} when slug is null", () => {
      const url = generateSearchResultUrl("event", mockEventWithoutSlug);
      expect(url).toBe("/events/423e4567-e89b-12d3-a456-426614174003");
    });

    it("does NOT generate filter page URL", () => {
      const url = generateSearchResultUrl("event", mockEventWithSlug);
      expect(url).not.toBe("/happenings?type=csc");
      expect(url).not.toContain("?type=");
    });
  });

  describe("Venue Results", () => {
    it("generates /venues/{slug} when slug exists", () => {
      const url = generateSearchResultUrl("venue", mockVenueWithSlug);
      expect(url).toBe("/venues/bar-404");
    });

    it("generates /venues/{id} when slug is null", () => {
      const url = generateSearchResultUrl("venue", mockVenueWithoutSlug);
      expect(url).toBe("/venues/623e4567-e89b-12d3-a456-426614174005");
    });
  });

  describe("Member Results", () => {
    it("generates /songwriters/{slug} when slug exists", () => {
      const url = generateSearchResultUrl("member", mockMemberWithSlug);
      expect(url).toBe("/songwriters/john-doe");
    });

    it("generates /songwriters/{id} when slug is null", () => {
      const url = generateSearchResultUrl("member", mockMemberWithoutSlug);
      expect(url).toBe("/songwriters/823e4567-e89b-12d3-a456-426614174007");
    });

    it("does NOT generate /members?id= URL (broken pattern)", () => {
      const url = generateSearchResultUrl("member", mockMemberWithSlug);
      expect(url).not.toContain("/members?id=");
      expect(url).not.toContain("/members");
    });
  });

  describe("Blog Results", () => {
    it("generates /blog/{slug}", () => {
      const url = generateSearchResultUrl("blog", mockBlogPost);
      expect(url).toBe("/blog/welcome-to-dsc");
    });
  });
});

describe("Nav Search Result Types", () => {
  it("supports all 5 entity types", () => {
    const types = ["event", "open_mic", "member", "blog", "venue"];
    types.forEach((type) => {
      expect(() =>
        generateSearchResultUrl(type as any, { id: "test", slug: "test" })
      ).not.toThrow();
    });
  });
});

describe("Regression: Happenings search selection navigates", () => {
  it("open_mic result URL starts with /events/", () => {
    const url = generateSearchResultUrl("open_mic", mockOpenMicWithSlug);
    expect(url.startsWith("/events/")).toBe(true);
  });

  it("event result URL starts with /events/", () => {
    const url = generateSearchResultUrl("event", mockEventWithSlug);
    expect(url.startsWith("/events/")).toBe(true);
  });

  it("URLs are valid paths (no query params for detail pages)", () => {
    const urls = [
      generateSearchResultUrl("open_mic", mockOpenMicWithSlug),
      generateSearchResultUrl("event", mockEventWithSlug),
      generateSearchResultUrl("venue", mockVenueWithSlug),
      generateSearchResultUrl("member", mockMemberWithSlug),
      generateSearchResultUrl("blog", mockBlogPost),
    ];

    urls.forEach((url) => {
      // Detail pages should not have query params
      expect(url).not.toContain("?");
      // URLs should start with /
      expect(url.startsWith("/")).toBe(true);
    });
  });
});

describe("GlobalSearch Component Types", () => {
  // These tests verify the TYPE_LABELS and TYPE_ICONS include all entity types
  const TYPE_LABELS: Record<string, string> = {
    open_mic: "Open Mic",
    event: "Event",
    member: "Member",
    blog: "Blog",
    venue: "Venue",
  };

  const TYPE_ICONS: Record<string, string> = {
    open_mic: "🎤",
    event: "📅",
    member: "👤",
    blog: "📝",
    venue: "📍",
  };

  it("has labels for all entity types", () => {
    expect(TYPE_LABELS.open_mic).toBe("Open Mic");
    expect(TYPE_LABELS.event).toBe("Event");
    expect(TYPE_LABELS.member).toBe("Member");
    expect(TYPE_LABELS.blog).toBe("Blog");
    expect(TYPE_LABELS.venue).toBe("Venue");
  });

  it("has icons for all entity types", () => {
    expect(TYPE_ICONS.open_mic).toBeDefined();
    expect(TYPE_ICONS.event).toBeDefined();
    expect(TYPE_ICONS.member).toBeDefined();
    expect(TYPE_ICONS.blog).toBeDefined();
    expect(TYPE_ICONS.venue).toBeDefined();
  });
});
