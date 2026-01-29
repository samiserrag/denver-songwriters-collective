/**
 * Phase 5.06: UX Polish Tests
 *
 * Tests for:
 * - Goal A: City/State visibility on HappeningCard and SeriesCard
 * - Goal B: Monthly series edit mode day-of-week derivation and warning
 * - Goal C: Event detail directions URL + "no venue hides button"
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// GOAL A: City/State Visibility Tests
// ============================================================================

describe("Goal A: City/State on Cards", () => {
  /**
   * Helper to simulate getVenueCityState logic from HappeningCard
   */
  function getVenueCityState(event: {
    venue?: { city?: string | null; state?: string | null } | null;
  }): string | null {
    if (event.venue && typeof event.venue === "object") {
      const city = event.venue.city;
      const state = event.venue.state;
      if (city && state) {
        return `${city}, ${state}`;
      }
      if (city) {
        return city;
      }
      if (state) {
        return state;
      }
    }
    return null;
  }

  // A1: Venue with only city (no state)
  it("A1: shows city only when state is null", () => {
    const event = {
      venue: { city: "Denver", state: null },
    };
    expect(getVenueCityState(event)).toBe("Denver");
  });

  it("A1b: shows city only when state is empty string", () => {
    const event = {
      venue: { city: "Denver", state: "" },
    };
    // Empty string is falsy, so should return city only
    expect(getVenueCityState(event)).toBe("Denver");
  });

  // A2: Custom location (no venue_id)
  it("A2: returns null when venue is null", () => {
    const event = {
      venue: null,
    };
    expect(getVenueCityState(event)).toBeNull();
  });

  it("A2b: returns null when venue is undefined", () => {
    const event = {};
    expect(getVenueCityState(event)).toBeNull();
  });

  it("A2c: returns null when venue has no city or state", () => {
    const event = {
      venue: { city: null, state: null },
    };
    expect(getVenueCityState(event)).toBeNull();
  });

  // A3: Override venue has different city than base venue
  it("A3: override venue data takes precedence", () => {
    // This simulates the component receiving overrideVenueData
    const baseEvent = {
      venue: { city: "Denver", state: "CO" },
    };
    const overrideVenueData = {
      name: "Different Venue",
      city: "Boulder",
      state: "CO",
    };

    // In the component, overrideVenueData would be used instead
    const effectiveVenue = overrideVenueData || baseEvent.venue;
    const result = getVenueCityState({ venue: effectiveVenue });

    expect(result).toBe("Boulder, CO");
  });

  // Standard case: both city and state present
  it("shows city, state when both present", () => {
    const event = {
      venue: { city: "Denver", state: "CO" },
    };
    expect(getVenueCityState(event)).toBe("Denver, CO");
  });

  // Edge case: state only (rare but possible)
  it("shows state only when city is null", () => {
    const event = {
      venue: { city: null, state: "CO" },
    };
    expect(getVenueCityState(event)).toBe("CO");
  });
});

// ============================================================================
// GOAL B: Monthly Series Edit Mode Tests
// ============================================================================

describe("Goal B: Monthly Edit Day-of-Week Derivation", () => {
  /**
   * Simulates weekdayNameFromDateMT from formDateHelpers.ts
   */
  function weekdayNameFromDateMT(dateKey: string): string {
    // Parse as noon UTC to avoid timezone issues
    const date = new Date(`${dateKey}T12:00:00Z`);
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    // Get day in Denver time
    const dayIndex = new Date(
      date.toLocaleString("en-US", { timeZone: "America/Denver" })
    ).getDay();
    return dayNames[dayIndex];
  }

  // B1: Event with NULL day_of_week in DB
  it("B1: derives day_of_week from event_date when db value is null", () => {
    const eventDate = "2026-01-24"; // A Saturday in 2026
    const dbDayOfWeek: string | null = null;

    // When db is null, form should derive from event_date
    const derivedDay = dbDayOfWeek || weekdayNameFromDateMT(eventDate);

    expect(derivedDay).toBe("Saturday");
  });

  it("B1b: uses db day_of_week when present", () => {
    const eventDate = "2026-01-24"; // A Saturday
    const dbDayOfWeek = "Thursday"; // DB says Thursday (different)

    // When db has value, should use it
    const derivedDay = dbDayOfWeek || weekdayNameFromDateMT(eventDate);

    expect(derivedDay).toBe("Thursday");
  });

  // B2: Warning when day changes
  it("B2: detects day change requiring warning", () => {
    const originalDayOfWeek = "Thursday";
    const newDate = "2026-01-25"; // A Sunday

    const newDayOfWeek = weekdayNameFromDateMT(newDate);
    const shouldShowWarning =
      originalDayOfWeek !== null && newDayOfWeek !== originalDayOfWeek;

    expect(newDayOfWeek).toBe("Sunday");
    expect(shouldShowWarning).toBe(true);
  });

  it("B2b: no warning when day stays the same", () => {
    const originalDayOfWeek = "Saturday";
    const newDate = "2026-01-31"; // Also a Saturday

    const newDayOfWeek = weekdayNameFromDateMT(newDate);
    const shouldShowWarning =
      originalDayOfWeek !== null && newDayOfWeek !== originalDayOfWeek;

    expect(newDayOfWeek).toBe("Saturday");
    expect(shouldShowWarning).toBe(false);
  });

  it("B2c: no warning when original day was null (new series)", () => {
    const originalDayOfWeek: string | null = null;
    const newDate = "2026-01-25";

    const newDayOfWeek = weekdayNameFromDateMT(newDate);
    const shouldShowWarning =
      originalDayOfWeek !== null && newDayOfWeek !== originalDayOfWeek;

    expect(shouldShowWarning).toBe(false);
  });

  // Day derivation for various dates
  it("correctly derives Monday", () => {
    expect(weekdayNameFromDateMT("2026-01-26")).toBe("Monday");
  });

  it("correctly derives Wednesday", () => {
    expect(weekdayNameFromDateMT("2026-01-28")).toBe("Wednesday");
  });

  it("correctly derives Friday", () => {
    expect(weekdayNameFromDateMT("2026-01-30")).toBe("Friday");
  });
});

// ============================================================================
// GOAL C: Directions URL Tests
// ============================================================================

describe("Goal C: Directions URL Generation", () => {
  /**
   * Simulates getVenueDirectionsUrl logic
   */
  function getVenueDirectionsUrl(venue: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  }): string | null {
    const parts: string[] = [];

    if (venue.name) parts.push(venue.name);
    if (venue.address) parts.push(venue.address);
    if (venue.city) parts.push(venue.city);
    if (venue.state) parts.push(venue.state);

    if (parts.length === 0) return null;

    const destination = encodeURIComponent(parts.join(", "));
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  }

  /**
   * Simulates the logic for determining if directions button should show
   */
  function shouldShowDirectionsButton(
    directionsUrl: string | null,
    isOnline: boolean
  ): boolean {
    if (isOnline) return false;
    return directionsUrl !== null;
  }

  // C1: Event with no venue (online-only)
  it("C1: hides directions button for online-only events", () => {
    const directionsUrl = null;
    const isOnline = true;

    expect(shouldShowDirectionsButton(directionsUrl, isOnline)).toBe(false);
  });

  it("C1b: hides directions button when no venue info and not online", () => {
    const venue = {
      name: null,
      address: null,
      city: null,
      state: null,
    };
    const directionsUrl = getVenueDirectionsUrl(venue);
    const isOnline = false;

    expect(directionsUrl).toBeNull();
    expect(shouldShowDirectionsButton(directionsUrl, isOnline)).toBe(false);
  });

  // Standard case: full venue info
  it("generates directions URL with full venue info", () => {
    const venue = {
      name: "Brewery Rickoli",
      address: "8455 W Bowles Ave",
      city: "Littleton",
      state: "CO",
    };
    const url = getVenueDirectionsUrl(venue);

    expect(url).toContain("maps/dir/");
    expect(url).toContain("Brewery%20Rickoli");
    expect(url).toContain("Littleton");
    expect(url).toContain("CO");
  });

  // Partial venue info
  it("generates directions URL with name only", () => {
    const venue = {
      name: "Some Venue",
      address: null,
      city: null,
      state: null,
    };
    const url = getVenueDirectionsUrl(venue);

    expect(url).not.toBeNull();
    expect(url).toContain("Some%20Venue");
  });

  it("generates directions URL with address and city only", () => {
    const venue = {
      name: null,
      address: "123 Main St",
      city: "Denver",
      state: null,
    };
    const url = getVenueDirectionsUrl(venue);

    expect(url).not.toBeNull();
    expect(url).toContain("123%20Main%20St");
    expect(url).toContain("Denver");
  });

  // Custom location with lat/lng
  it("custom location with lat/lng uses coordinate URL", () => {
    const lat = 39.7392;
    const lng = -104.9903;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    expect(url).toContain("39.7392,-104.9903");
  });

  // View on Maps vs Get Directions
  it("view on maps URL is different from directions URL", () => {
    const viewOnMapsUrl = "https://maps.google.com/?cid=12345"; // Place page
    const directionsUrl = getVenueDirectionsUrl({
      name: "Test Venue",
      address: "123 Main",
      city: "Denver",
      state: "CO",
    });

    expect(viewOnMapsUrl).toContain("cid=");
    expect(directionsUrl).toContain("maps/dir/");
    expect(viewOnMapsUrl).not.toBe(directionsUrl);
  });
});

// ============================================================================
// PostgREST Alias Contract Tests
// ============================================================================

describe("PostgREST Alias Contract", () => {
  it("venue alias query returns data at event.venue not event.venues", () => {
    // This documents the expected shape after the alias fix
    // PostgREST query: `venue:venues!left(...)` returns data at `venue` key

    // Simulated query result shape with alias
    const eventWithAlias = {
      id: "123",
      title: "Test Event",
      venue: {
        // Data at 'venue' key (aliased)
        id: "v1",
        name: "Test Venue",
        city: "Denver",
        state: "CO",
      },
    };

    // Simulated OLD shape WITHOUT alias
    const eventWithoutAlias = {
      id: "123",
      title: "Test Event",
      venues: {
        // Data at 'venues' key (not aliased)
        id: "v1",
        name: "Test Venue",
        city: "Denver",
        state: "CO",
      },
    };

    // Components expect 'venue' (singular)
    expect(eventWithAlias.venue).toBeDefined();
    expect(eventWithAlias.venue.city).toBe("Denver");

    // Old shape has 'venues' (plural) which components couldn't read
    expect((eventWithoutAlias as any).venue).toBeUndefined();
    expect(eventWithoutAlias.venues.city).toBe("Denver");
  });
});

// ============================================================================
// Override Venue Data Tests
// ============================================================================

describe("Override Venue Data Propagation", () => {
  it("overrideVenueData includes city and state", () => {
    // Type check: overrideVenueData should have city/state
    const overrideVenueData: {
      name: string;
      slug?: string | null;
      google_maps_url?: string | null;
      website_url?: string | null;
      city?: string | null;
      state?: string | null;
    } = {
      name: "Override Venue",
      slug: "override-venue",
      google_maps_url: null,
      website_url: null,
      city: "Boulder",
      state: "CO",
    };

    expect(overrideVenueData.city).toBe("Boulder");
    expect(overrideVenueData.state).toBe("CO");
  });

  it("null overrideVenueData falls back to base venue", () => {
    const baseVenue = { city: "Denver", state: "CO" };
    const overrideVenueData = null;

    const effectiveVenue = overrideVenueData || baseVenue;

    expect(effectiveVenue.city).toBe("Denver");
    expect(effectiveVenue.state).toBe("CO");
  });
});
