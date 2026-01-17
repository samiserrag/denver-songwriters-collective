/**
 * Tests for conditional onboarding step display
 *
 * Verifies that onboarding sections are shown/hidden based on selected identity flags.
 */

import { describe, it, expect } from "vitest";
import { getRelevantSections } from "../app/onboarding/profile/page";

describe("getRelevantSections - Conditional Onboarding Steps", () => {
  describe("No identity selected", () => {
    it("should show all sections when no identity is selected", () => {
      const sections = getRelevantSections({
        is_songwriter: false,
        is_host: false,
        is_studio: false,
        is_fan: false,
      });

      expect(sections).toContain("identity");
      expect(sections).toContain("instruments");
      expect(sections).toContain("about");
      expect(sections).toContain("social");
      expect(sections).toContain("tipping");
      expect(sections).toContain("collab");
      expect(sections).toHaveLength(6);
    });
  });

  describe("Fan-only", () => {
    it("should show only identity, instruments (for genres), and about for fan-only", () => {
      const sections = getRelevantSections({
        is_songwriter: false,
        is_host: false,
        is_studio: false,
        is_fan: true,
      });

      expect(sections).toContain("identity");
      expect(sections).toContain("instruments"); // Contains genres
      expect(sections).toContain("about");

      // Should NOT contain these
      expect(sections).not.toContain("social");
      expect(sections).not.toContain("tipping");
      expect(sections).not.toContain("collab");

      expect(sections).toHaveLength(3);
    });
  });

  describe("Songwriter-only", () => {
    it("should show all sections for songwriter", () => {
      const sections = getRelevantSections({
        is_songwriter: true,
        is_host: false,
        is_studio: false,
        is_fan: false,
      });

      expect(sections).toContain("identity");
      expect(sections).toContain("instruments");
      expect(sections).toContain("about");
      expect(sections).toContain("social");
      expect(sections).toContain("tipping");
      expect(sections).toContain("collab");
      expect(sections).toHaveLength(6);
    });
  });

  describe("Host-only", () => {
    it("should show identity, about, and social for host-only", () => {
      const sections = getRelevantSections({
        is_songwriter: false,
        is_host: true,
        is_studio: false,
        is_fan: false,
      });

      expect(sections).toContain("identity");
      expect(sections).toContain("about");
      expect(sections).toContain("social");

      // Should NOT contain these
      expect(sections).not.toContain("instruments");
      expect(sections).not.toContain("tipping");
      expect(sections).not.toContain("collab");

      expect(sections).toHaveLength(3);
    });
  });

  describe("Studio-only", () => {
    it("should show identity, about, and social for studio-only", () => {
      const sections = getRelevantSections({
        is_songwriter: false,
        is_host: false,
        is_studio: true,
        is_fan: false,
      });

      expect(sections).toContain("identity");
      expect(sections).toContain("about");
      expect(sections).toContain("social");

      // Should NOT contain these
      expect(sections).not.toContain("instruments");
      expect(sections).not.toContain("tipping");
      expect(sections).not.toContain("collab");

      expect(sections).toHaveLength(3);
    });
  });

  describe("Songwriter + Fan (multi-role)", () => {
    it("should show all sections when songwriter is selected (superset)", () => {
      const sections = getRelevantSections({
        is_songwriter: true,
        is_host: false,
        is_studio: false,
        is_fan: true,
      });

      // Songwriter gets all sections
      expect(sections).toContain("identity");
      expect(sections).toContain("instruments");
      expect(sections).toContain("about");
      expect(sections).toContain("social");
      expect(sections).toContain("tipping");
      expect(sections).toContain("collab");
      expect(sections).toHaveLength(6);
    });
  });

  describe("Host + Fan (multi-role)", () => {
    it("should show union of host and fan sections", () => {
      const sections = getRelevantSections({
        is_songwriter: false,
        is_host: true,
        is_studio: false,
        is_fan: true,
      });

      // Union: identity + about + social (from host) + instruments (from fan for genres)
      expect(sections).toContain("identity");
      expect(sections).toContain("instruments"); // From fan
      expect(sections).toContain("about");
      expect(sections).toContain("social"); // From host

      // Neither host nor fan gets these
      expect(sections).not.toContain("tipping");
      expect(sections).not.toContain("collab");

      expect(sections).toHaveLength(4);
    });
  });

  describe("Host + Studio (multi-role)", () => {
    it("should show union of host and studio sections", () => {
      const sections = getRelevantSections({
        is_songwriter: false,
        is_host: true,
        is_studio: true,
        is_fan: false,
      });

      // Both get same sections: identity + about + social
      expect(sections).toContain("identity");
      expect(sections).toContain("about");
      expect(sections).toContain("social");

      // Neither gets these
      expect(sections).not.toContain("instruments");
      expect(sections).not.toContain("tipping");
      expect(sections).not.toContain("collab");

      expect(sections).toHaveLength(3);
    });
  });

  describe("All identities selected", () => {
    it("should show all sections when all identities are selected", () => {
      const sections = getRelevantSections({
        is_songwriter: true,
        is_host: true,
        is_studio: true,
        is_fan: true,
      });

      expect(sections).toContain("identity");
      expect(sections).toContain("instruments");
      expect(sections).toContain("about");
      expect(sections).toContain("social");
      expect(sections).toContain("tipping");
      expect(sections).toContain("collab");
      expect(sections).toHaveLength(6);
    });
  });

  describe("Section order", () => {
    it("should maintain consistent section order regardless of identity flags", () => {
      const expectedOrder = ["identity", "instruments", "about", "social", "tipping", "collab"];

      // All sections
      const allSections = getRelevantSections({
        is_songwriter: true,
        is_host: false,
        is_studio: false,
        is_fan: false,
      });
      expect(allSections).toEqual(expectedOrder);

      // Fan sections should be in order
      const fanSections = getRelevantSections({
        is_songwriter: false,
        is_host: false,
        is_studio: false,
        is_fan: true,
      });
      // Order among fan sections: identity, instruments, about
      expect(fanSections.indexOf("identity")).toBeLessThan(fanSections.indexOf("instruments"));
      expect(fanSections.indexOf("instruments")).toBeLessThan(fanSections.indexOf("about"));
    });
  });

  describe("Identity section always visible", () => {
    it("should always include identity section regardless of flags", () => {
      const testCases = [
        { is_songwriter: false, is_host: false, is_studio: false, is_fan: false },
        { is_songwriter: true, is_host: false, is_studio: false, is_fan: false },
        { is_songwriter: false, is_host: true, is_studio: false, is_fan: false },
        { is_songwriter: false, is_host: false, is_studio: true, is_fan: false },
        { is_songwriter: false, is_host: false, is_studio: false, is_fan: true },
        { is_songwriter: true, is_host: true, is_studio: true, is_fan: true },
      ];

      for (const flags of testCases) {
        const sections = getRelevantSections(flags);
        expect(sections).toContain("identity");
        expect(sections[0]).toBe("identity"); // First in order
      }
    });
  });
});

describe("Skip button behavior", () => {
  it("should allow completion regardless of selected sections", () => {
    // This test documents that the skip button saves all provided data
    // regardless of which sections are visible. The handleSkip function
    // sends all 18 fields to the API.

    // The actual API behavior is tested in onboarding-persistence.test.ts
    // Here we just verify the section visibility logic doesn't block completion.

    const fanSections = getRelevantSections({
      is_songwriter: false,
      is_host: false,
      is_studio: false,
      is_fan: true,
    });

    // Fan-only user can complete onboarding with limited sections
    expect(fanSections.length).toBeGreaterThan(0);
    expect(fanSections).toContain("identity");

    // The skip button is always available and saves data regardless of sections
    // This is a documentation test - actual behavior is in the component
  });
});
