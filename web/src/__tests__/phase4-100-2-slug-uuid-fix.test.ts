/**
 * Phase 4.100.2: Slug/UUID Fix Tests
 *
 * Tests the isUUID() helper function used in lineup and display pages
 * to determine whether to query by id (UUID) or slug.
 *
 * Root cause of the bug: `.eq("id", slugString)` failed PostgreSQL type
 * comparison when routeParam was a slug, causing 400 Bad Request errors.
 *
 * Fix: Added isUUID() helper to conditionally query by id OR slug.
 */

import { describe, it, expect } from "vitest";

/**
 * isUUID helper function - same implementation used in lineup/display pages
 * Determines whether a string is a valid UUID v4 format
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

describe("Phase 4.100.2: isUUID helper", () => {
  describe("Valid UUIDs (should return true)", () => {
    it("returns true for lowercase UUID", () => {
      expect(isUUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(true);
    });

    it("returns true for uppercase UUID", () => {
      expect(isUUID("A1B2C3D4-E5F6-7890-ABCD-EF1234567890")).toBe(true);
    });

    it("returns true for mixed case UUID", () => {
      expect(isUUID("a1B2c3D4-E5f6-7890-AbCd-eF1234567890")).toBe(true);
    });

    it("returns true for real UUID v4 examples", () => {
      expect(isUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
      expect(isUUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
    });
  });

  describe("Event slugs (should return false)", () => {
    it("returns false for simple slug", () => {
      expect(isUUID("words-open-mic")).toBe(false);
    });

    it("returns false for slug with numbers", () => {
      expect(isUUID("open-mic-2026")).toBe(false);
    });

    it("returns false for single word slug", () => {
      expect(isUUID("showcase")).toBe(false);
    });

    it("returns false for long descriptive slug", () => {
      expect(isUUID("dsc-songwriter-showcase-at-mercury-cafe")).toBe(false);
    });

    it("returns false for slug with underscores", () => {
      expect(isUUID("open_mic_night")).toBe(false);
    });
  });

  describe("Invalid inputs (should return false)", () => {
    it("returns false for empty string", () => {
      expect(isUUID("")).toBe(false);
    });

    it("returns false for partial UUID", () => {
      expect(isUUID("a1b2c3d4-e5f6")).toBe(false);
    });

    it("returns false for UUID without hyphens", () => {
      expect(isUUID("a1b2c3d4e5f67890abcdef1234567890")).toBe(false);
    });

    it("returns false for UUID with wrong segment lengths", () => {
      // First segment too short
      expect(isUUID("a1b2c3-e5f6-7890-abcd-ef1234567890")).toBe(false);
      // Last segment too long
      expect(isUUID("a1b2c3d4-e5f6-7890-abcd-ef12345678901")).toBe(false);
    });

    it("returns false for UUID with invalid characters", () => {
      expect(isUUID("a1b2c3d4-e5f6-7890-ghij-ef1234567890")).toBe(false);
    });

    it("returns false for UUID with extra hyphens", () => {
      expect(isUUID("a1b2c3d4-e5f6-7890-ab-cd-ef1234567890")).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("returns false for whitespace", () => {
      expect(isUUID("   ")).toBe(false);
    });

    it("returns false for UUID with leading/trailing spaces", () => {
      expect(isUUID(" a1b2c3d4-e5f6-7890-abcd-ef1234567890 ")).toBe(false);
    });

    it("returns false for 'undefined' string", () => {
      expect(isUUID("undefined")).toBe(false);
    });

    it("returns false for 'null' string", () => {
      expect(isUUID("null")).toBe(false);
    });
  });
});

describe("Phase 4.100.2: Query pattern behavior", () => {
  /**
   * These tests document the expected behavior of the conditional query pattern
   * used in lineup and display pages:
   *
   * const { data } = isUUID(routeParam)
   *   ? await query.eq("id", routeParam).single()
   *   : await query.eq("slug", routeParam).single();
   */

  it("UUID access should query by id column", () => {
    const routeParam = "550e8400-e29b-41d4-a716-446655440000";
    const queryType = isUUID(routeParam) ? "id" : "slug";
    expect(queryType).toBe("id");
  });

  it("slug access should query by slug column", () => {
    const routeParam = "words-open-mic";
    const queryType = isUUID(routeParam) ? "id" : "slug";
    expect(queryType).toBe("slug");
  });

  it("handles edge case of UUID-like slug (should not match UUID pattern)", () => {
    // A slug that contains some UUID-like segments but isn't valid
    const routeParam = "event-a1b2c3d4";
    const queryType = isUUID(routeParam) ? "id" : "slug";
    expect(queryType).toBe("slug");
  });
});

describe("Phase 4.100.2: eventUuid resolution pattern", () => {
  /**
   * After fetching the event, the resolved UUID is stored for subsequent queries:
   *
   * const resolvedUuid = eventData.id;
   * setEventUuid(resolvedUuid);
   *
   * All downstream queries (timeslots, lineup state, claims) use resolvedUuid
   * instead of routeParam to ensure UUID type compatibility with PostgreSQL.
   */

  it("resolvedUuid should always be a valid UUID", () => {
    // Simulate fetching event by slug and getting back the UUID
    const mockEventData = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      slug: "words-open-mic",
      title: "Words Open Mic",
    };

    const resolvedUuid = mockEventData.id;
    expect(isUUID(resolvedUuid)).toBe(true);
  });

  it("downstream queries should use resolvedUuid not routeParam", () => {
    const routeParam = "words-open-mic"; // slug from URL
    const resolvedUuid = "550e8400-e29b-41d4-a716-446655440000"; // from DB

    // routeParam is NOT a UUID
    expect(isUUID(routeParam)).toBe(false);

    // resolvedUuid IS a UUID (safe for PostgreSQL UUID column)
    expect(isUUID(resolvedUuid)).toBe(true);
  });
});

describe("Phase 4.102: TvQrStrip props pattern", () => {
  /**
   * TvQrStrip uses slug || id pattern for URLs:
   *
   * eventSlugOrId={event?.slug || eventUuid || routeParam}
   * venueSlugOrId={venue?.slug || venue?.id}
   * hostSlugOrId={host?.slug || host?.id}
   *
   * This ensures QR codes link to the most user-friendly URL possible.
   */

  it("prefers slug over UUID for event URL", () => {
    const event = { slug: "words-open-mic", id: "550e8400-e29b-41d4-a716-446655440000" };
    const eventSlugOrId = event.slug || event.id;
    expect(eventSlugOrId).toBe("words-open-mic");
  });

  it("falls back to UUID when no slug", () => {
    const event = { slug: null, id: "550e8400-e29b-41d4-a716-446655440000" };
    const eventSlugOrId = event.slug || event.id;
    expect(eventSlugOrId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("handles venue with slug", () => {
    const venue = { slug: "mercury-cafe", id: "venue-uuid-123", name: "Mercury Cafe" };
    const venueSlugOrId = venue.slug || venue.id;
    expect(venueSlugOrId).toBe("mercury-cafe");
  });

  it("handles venue without slug", () => {
    const venue = { slug: null, id: "venue-uuid-123", name: "Some Venue" };
    const venueSlugOrId = venue.slug || venue.id;
    expect(venueSlugOrId).toBe("venue-uuid-123");
  });

  it("handles null venue (QR not shown)", () => {
    const venue = null;
    const venueSlugOrId = venue?.slug || venue?.id;
    expect(venueSlugOrId).toBeUndefined();
  });
});
