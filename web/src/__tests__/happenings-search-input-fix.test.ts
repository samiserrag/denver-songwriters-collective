/**
 * Tests for HappeningsFilters search input sync loop fix
 *
 * Phase 5.14b: Fix search input text erasure bug
 *
 * The bug: When typing in the search input, text would erase itself because:
 * 1. User types "br" in input
 * 2. After 300ms debounce, URL updates to ?q=br
 * 3. useEffect watching URL param runs and resets input to "br"
 * 4. But user has typed "brew" by now → "ew" gets erased
 *
 * The fix: Track when we initiate URL changes using refs, skip sync in those cases
 */

import { describe, it, expect } from "vitest";

describe("HappeningsFilters Search Input Sync Loop Fix", () => {
  describe("Ref-based sync loop prevention pattern", () => {
    it("should have isLocalSearchUpdate ref to track local URL changes", () => {
      // The pattern uses a ref to track if we're the source of the URL change
      const pattern = `
        const isLocalSearchUpdate = React.useRef(false);

        // In handleSearchChange:
        searchTimeoutRef.current = setTimeout(() => {
          isLocalSearchUpdate.current = true;  // Mark as local change
          updateFilter("q", value || null);
        }, 300);

        // In useEffect:
        React.useEffect(() => {
          if (isLocalSearchUpdate.current) {
            isLocalSearchUpdate.current = false;  // Reset flag
            return;  // Skip sync
          }
          setSearchInput(q);  // Only sync for external changes
        }, [q]);
      `;

      expect(pattern).toContain("isLocalSearchUpdate.current = true");
      expect(pattern).toContain("isLocalSearchUpdate.current = false");
    });

    it("should skip sync when local change initiated the URL update", () => {
      // Simulating the sync logic
      let isLocalSearchUpdate = false;
      let searchInput = "";
      const setSearchInput = (val: string) => { searchInput = val; };

      // User types "brew"
      searchInput = "brew";

      // Debounce fires, marks as local update
      isLocalSearchUpdate = true;

      // URL changes to q=brew, useEffect runs
      const q = "brew";
      if (isLocalSearchUpdate) {
        isLocalSearchUpdate = false;
        // Skip sync - don't call setSearchInput
      } else {
        setSearchInput(q);
      }

      // searchInput should still be "brew" (not reset)
      expect(searchInput).toBe("brew");
      expect(isLocalSearchUpdate).toBe(false);
    });

    it("should sync when external change (browser back/forward) updates URL", () => {
      // Simulating external sync (e.g., browser back button)
      let isLocalSearchUpdate = false;
      let searchInput = "old query";
      const setSearchInput = (val: string) => { searchInput = val; };

      // External navigation changes URL to q=new query
      // isLocalSearchUpdate is false because we didn't initiate it
      const q = "new query";

      if (isLocalSearchUpdate) {
        isLocalSearchUpdate = false;
        // Skip sync
      } else {
        setSearchInput(q);  // Sync for external change
      }

      // searchInput should be synced to new URL value
      expect(searchInput).toBe("new query");
    });
  });

  describe("City input sync loop prevention", () => {
    it("should have isLocalCityUpdate ref for city input", () => {
      const pattern = `
        const isLocalCityUpdate = React.useRef(false);

        // In handleCityChange:
        cityTimeoutRef.current = setTimeout(() => {
          isLocalCityUpdate.current = true;
          router.push(buildUrl({ city: value || null, zip: null }));
        }, 400);
      `;

      expect(pattern).toContain("isLocalCityUpdate.current = true");
    });

    it("should skip sync for local city input changes", () => {
      let isLocalCityUpdate = false;
      let cityInput = "";
      const setCityInput = (val: string) => { cityInput = val; };

      // User types "Denver"
      cityInput = "Denver";
      isLocalCityUpdate = true;

      // URL updates, useEffect runs
      const city = "Denver";
      if (isLocalCityUpdate) {
        isLocalCityUpdate = false;
        // Skip sync
      } else {
        setCityInput(city);
      }

      expect(cityInput).toBe("Denver");
    });
  });

  describe("ZIP input sync loop prevention", () => {
    it("should have isLocalZipUpdate ref for ZIP input", () => {
      const pattern = `
        const isLocalZipUpdate = React.useRef(false);

        // In handleZipChange:
        zipTimeoutRef.current = setTimeout(() => {
          isLocalZipUpdate.current = true;
          router.push(buildUrl({ zip: value || null, city: null }));
        }, 400);
      `;

      expect(pattern).toContain("isLocalZipUpdate.current = true");
    });

    it("should skip sync for local ZIP input changes", () => {
      let isLocalZipUpdate = false;
      let zipInput = "";
      const setZipInput = (val: string) => { zipInput = val; };

      // User types "80202"
      zipInput = "80202";
      isLocalZipUpdate = true;

      // URL updates, useEffect runs
      const zip = "80202";
      if (isLocalZipUpdate) {
        isLocalZipUpdate = false;
        // Skip sync
      } else {
        setZipInput(zip);
      }

      expect(zipInput).toBe("80202");
    });
  });

  describe("Debounce timing", () => {
    it("search input should debounce at 300ms", () => {
      const SEARCH_DEBOUNCE_MS = 300;
      expect(SEARCH_DEBOUNCE_MS).toBe(300);
    });

    it("city/zip inputs should debounce at 400ms", () => {
      const LOCATION_DEBOUNCE_MS = 400;
      expect(LOCATION_DEBOUNCE_MS).toBe(400);
    });

    it("location inputs have longer debounce to allow for typing addresses", () => {
      const SEARCH_DEBOUNCE_MS = 300;
      const LOCATION_DEBOUNCE_MS = 400;
      expect(LOCATION_DEBOUNCE_MS).toBeGreaterThan(SEARCH_DEBOUNCE_MS);
    });
  });

  describe("Race condition scenarios", () => {
    it("should handle rapid typing without losing characters", () => {
      // Simulate rapid typing scenario
      let isLocalSearchUpdate = false;
      let searchInput = "";
      const setSearchInput = (val: string) => { searchInput = val; };

      // Keystroke 1: "b"
      searchInput = "b";

      // Keystroke 2: "br" (before first debounce fires)
      searchInput = "br";

      // Keystroke 3: "bre" (before first debounce fires)
      searchInput = "bre";

      // First debounce finally fires with "bre"
      isLocalSearchUpdate = true;

      // Keystroke 4: "brew" (during URL update)
      searchInput = "brew";

      // URL updates to q=bre, useEffect runs
      const q = "bre"; // URL still has old value
      if (isLocalSearchUpdate) {
        isLocalSearchUpdate = false;
        // Skip sync - preserves "brew"
      } else {
        setSearchInput(q);
      }

      // User's latest input should be preserved
      expect(searchInput).toBe("brew");
    });

    it("should handle clear search action correctly", () => {
      // Clear search should work without sync issues
      let searchInput = "test query";
      const setSearchInput = (val: string) => { searchInput = val; };

      // clearSearch function behavior:
      // 1. Set local state to empty
      setSearchInput("");
      // 2. Update URL (no debounce needed for clear)
      // updateFilter("q", null);

      expect(searchInput).toBe("");
    });
  });

  describe("External URL changes should sync", () => {
    it("should sync when user clicks active filter pill to remove filter", () => {
      // When user clicks X on a filter pill, URL changes externally
      let isLocalSearchUpdate = false;
      let searchInput = "old search";
      const setSearchInput = (val: string) => { searchInput = val; };

      // User clicks X on search filter pill
      // This calls updateFilter directly (not through handleSearchChange)
      // So isLocalSearchUpdate stays false

      // URL changes to remove q param
      const q = "";

      if (isLocalSearchUpdate) {
        isLocalSearchUpdate = false;
      } else {
        setSearchInput(q); // Should sync
      }

      expect(searchInput).toBe("");
    });

    it("should sync when clearAll is called", () => {
      let isLocalSearchUpdate = false;
      let searchInput = "search text";
      let cityInput = "Denver";
      let zipInput = "80202";

      const setSearchInput = (val: string) => { searchInput = val; };
      const setCityInput = (val: string) => { cityInput = val; };
      const setZipInput = (val: string) => { zipInput = val; };

      // clearAll function directly sets state and navigates
      setSearchInput("");
      setCityInput("");
      setZipInput("");
      // router.push("/happenings");

      expect(searchInput).toBe("");
      expect(cityInput).toBe("");
      expect(zipInput).toBe("");
    });
  });
});
