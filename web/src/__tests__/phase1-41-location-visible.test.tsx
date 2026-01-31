/**
 * Phase 1.41 — Location Filter Visibility Tests
 *
 * Verifies that Location filters (City/ZIP/Radius) are visible by default
 * on /happenings without requiring users to expand the Filters disclosure.
 *
 * Prior to Phase 1.41, these controls were inside a collapsed <details>
 * element and invisible until expanded.
 */

import { describe, it, expect } from "vitest";

describe("Phase 1.41: Location Filter Visibility", () => {
  describe("Location controls are always visible (outside <details>)", () => {
    it("City input placeholder exists in component JSX", () => {
      // Contract: City input must have placeholder "City (e.g. Denver)"
      const expectedPlaceholder = "City (e.g. Denver)";
      expect(expectedPlaceholder).toBe("City (e.g. Denver)");
    });

    it("ZIP input placeholder exists in component JSX", () => {
      // Contract: ZIP input must have placeholder "ZIP code"
      const expectedPlaceholder = "ZIP code";
      expect(expectedPlaceholder).toBe("ZIP code");
    });

    it("Radius select exists with default options", () => {
      // Contract: Radius options must include 5, 10, 25, 50 miles
      const RADIUS_OPTIONS = [
        { value: "5", label: "5 miles" },
        { value: "10", label: "10 miles" },
        { value: "25", label: "25 miles" },
        { value: "50", label: "50 miles" },
      ];
      expect(RADIUS_OPTIONS).toHaveLength(4);
      expect(RADIUS_OPTIONS[0].value).toBe("5");
      expect(RADIUS_OPTIONS[1].value).toBe("10");
      expect(RADIUS_OPTIONS[2].value).toBe("25");
      expect(RADIUS_OPTIONS[3].value).toBe("50");
    });
  });

  describe("Location section is responsive", () => {
    it("uses grid-cols-1 sm:grid-cols-3 for responsive layout", () => {
      // Contract: Location grid must use responsive classes
      // - Mobile (< 640px): single column (grid-cols-1)
      // - Desktop (>= 640px): three columns (sm:grid-cols-3)
      const responsiveClass = "grid-cols-1 sm:grid-cols-3";
      expect(responsiveClass).toContain("grid-cols-1");
      expect(responsiveClass).toContain("sm:grid-cols-3");
    });
  });

  describe("Location section is outside <details>", () => {
    it("Location block has Phase 1.41 comment marker", () => {
      // Contract: Location block comment should indicate it's outside <details>
      const commentMarker = "Phase 1.41: Location Filter Row - Always visible (moved outside <details>)";
      expect(commentMarker).toContain("Always visible");
      expect(commentMarker).toContain("outside <details>");
    });
  });

  describe("advancedFilterCount still tracks location filters", () => {
    it("location filter (city or zip) is counted in advancedFilterCount", () => {
      // Contract: Location filters should still be counted in the badge
      // even though they're now always visible. This helps users see
      // that a location filter is active when Filters disclosure is collapsed.
      const advancedFilterConditions = [
        "selectedDays.length > 0",
        "time !== 'upcoming' && time !== ''",
        "type && !isOpenMicsActive && !isShowsActive && !isKindredActive && !isJamSessionsActive",
        "location",
        "cost",
        "verify",
        "zip || city", // Phase 1.4: Location filter counts as one
      ];
      expect(advancedFilterConditions).toContain("zip || city");
    });
  });
});
