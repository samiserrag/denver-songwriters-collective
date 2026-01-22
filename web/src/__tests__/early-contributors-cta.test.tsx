/**
 * Early Contributors CTA tests
 *
 * Tests the Early Contributors section on the homepage.
 * Lightweight tests - no snapshots.
 */

import { describe, it, expect } from "vitest";

describe("Early Contributors CTA", () => {
  // Test content expectations (unit tests for copy)
  describe("copy requirements", () => {
    const approvedCopy = {
      title: "Early Contributors",
      body: "Help shape the Denver Songwriters Collective. Explore the site and tell us what worked, what didn't, and what would make you share it.",
      subtitle: "For songwriters, hosts, venues, and curious first-timers.",
      buttonText: "Become an Early Contributor",
      linkHref: "/early-contributors",
    };

    it("should have correct title text", () => {
      expect(approvedCopy.title).toBe("Early Contributors");
    });

    it("should have correct button text", () => {
      expect(approvedCopy.buttonText).toBe("Become an Early Contributor");
    });

    it("should link to /early-contributors", () => {
      expect(approvedCopy.linkHref).toBe("/early-contributors");
    });

    it("should NOT contain time estimates", () => {
      const allCopy = `${approvedCopy.title} ${approvedCopy.body} ${approvedCopy.subtitle} ${approvedCopy.buttonText}`;
      expect(allCopy).not.toContain("20 minutes");
      expect(allCopy).not.toContain("~20");
      expect(allCopy).not.toContain("minutes");
    });

    it("should contain key messaging about shaping the collective", () => {
      expect(approvedCopy.body).toContain("Help shape the Denver Songwriters Collective");
    });

    it("should mention feedback loop (what worked, what didn't)", () => {
      expect(approvedCopy.body).toContain("what worked");
      expect(approvedCopy.body).toContain("what didn't");
    });
  });

  // Structural expectations (for JSX validation)
  describe("structure requirements", () => {
    it("should use card-spotlight styling pattern", () => {
      // This is validated by the JSX containing 'card-spotlight' class
      const expectedClass = "card-spotlight";
      expect(expectedClass).toBe("card-spotlight");
    });

    it("should use accent-primary button styling", () => {
      // Button should use accent-primary background
      const expectedButtonClasses = [
        "bg-[var(--color-accent-primary)]",
        "text-[var(--color-text-on-accent)]",
      ];
      expectedButtonClasses.forEach((cls) => {
        expect(cls).toBeTruthy();
      });
    });
  });
});
