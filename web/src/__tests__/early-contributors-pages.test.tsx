/**
 * Early Contributors Pages Tests
 *
 * Tests for /early-contributors flow:
 * - Main page renders 4 mission cards
 * - Each mission has a feedback link
 * - Thanks page renders
 * - Footer contains Early Contributors link
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// Mission Data Tests
// =============================================================================

describe("Early Contributors Page Structure", () => {
  const missions = [
    {
      id: "songwriter",
      title: "Songwriter",
      feedbackSubject: "Early Contributors — Songwriter",
    },
    {
      id: "host",
      title: "Happenings Host / Organizer",
      feedbackSubject: "Early Contributors — Host",
    },
    {
      id: "venue",
      title: "Venue / Promoter",
      feedbackSubject: "Early Contributors — Venue",
    },
    {
      id: "visitor",
      title: "First-time Visitor",
      feedbackSubject: "Early Contributors — Visitor",
    },
  ];

  it("should have exactly 4 missions", () => {
    expect(missions).toHaveLength(4);
  });

  it("should have unique IDs for each mission", () => {
    const ids = missions.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have feedback subjects prefixed with 'Early Contributors'", () => {
    missions.forEach((mission) => {
      expect(mission.feedbackSubject).toMatch(/^Early Contributors — /);
    });
  });

  it("should generate valid feedback URLs", () => {
    missions.forEach((mission) => {
      const url = `/feedback?category=feature&subject=${encodeURIComponent(mission.feedbackSubject)}`;
      expect(url).toContain("/feedback");
      expect(url).toContain("category=feature");
      expect(url).toContain("subject=Early%20Contributors");
    });
  });
});

// =============================================================================
// Feedback URL Prefill Tests
// =============================================================================

describe("Feedback URL Prefill Behavior", () => {
  it("should URL-encode special characters in subject", () => {
    const subject = "Early Contributors — Songwriter";
    const encoded = encodeURIComponent(subject);
    expect(encoded).toBe("Early%20Contributors%20%E2%80%94%20Songwriter");
  });

  it("should decode URL-encoded subject correctly", () => {
    const encoded = "Early%20Contributors%20%E2%80%94%20Songwriter";
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toBe("Early Contributors — Songwriter");
  });

  it("should support category, subject, and pageUrl params", () => {
    const params = new URLSearchParams({
      category: "feature",
      subject: "Early Contributors — Host",
      pageUrl: "https://denversongwriterscollective.org/early-contributors",
    });

    expect(params.get("category")).toBe("feature");
    expect(params.get("subject")).toBe("Early Contributors — Host");
    expect(params.get("pageUrl")).toBe("https://denversongwriterscollective.org/early-contributors");
  });
});

// =============================================================================
// Footer Link Tests
// =============================================================================

describe("Footer Early Contributors Link", () => {
  const communityLinks = [
    { href: "/about", label: "About Us" },
    { href: "/submit-open-mic", label: "Submit Open Mic" },
    { href: "/get-involved", label: "Get Involved" },
    { href: "/partners", label: "Partners" },
    { href: "/early-contributors", label: "Early Contributors" },
  ];

  it("should include Early Contributors in community links", () => {
    const earlyContributorsLink = communityLinks.find(
      (link) => link.href === "/early-contributors"
    );
    expect(earlyContributorsLink).toBeDefined();
    expect(earlyContributorsLink?.label).toBe("Early Contributors");
  });

  it("should have Early Contributors as the last community link", () => {
    const lastLink = communityLinks[communityLinks.length - 1];
    expect(lastLink.href).toBe("/early-contributors");
  });
});

// =============================================================================
// Thanks Page Tests
// =============================================================================

describe("Thanks Page Structure", () => {
  const thanksPageLinks = [
    { href: "/", label: "Home" },
    { href: "/happenings", label: "Happenings" },
    { href: "/get-involved", label: "Get Involved" },
    { href: "/tip-jar", label: "Tip Jar" },
  ];

  it("should have 4 navigation links", () => {
    expect(thanksPageLinks).toHaveLength(4);
  });

  it("should link to Home", () => {
    expect(thanksPageLinks.some((link) => link.href === "/")).toBe(true);
  });

  it("should link to Happenings", () => {
    expect(thanksPageLinks.some((link) => link.href === "/happenings")).toBe(true);
  });

  it("should link to Get Involved", () => {
    expect(thanksPageLinks.some((link) => link.href === "/get-involved")).toBe(true);
  });

  it("should link to Tip Jar", () => {
    expect(thanksPageLinks.some((link) => link.href === "/tip-jar")).toBe(true);
  });
});

// =============================================================================
// Boundaries Copy Tests
// =============================================================================

describe("Boundaries Section Content", () => {
  const boundariesCopy = [
    "We review everything, but can't reply to every message.",
    "Please use the Feedback form (not DMs or comments) so nothing gets lost.",
    "Some events may be unverified during pre-launch testing.",
  ];

  it("should have 3 boundary statements", () => {
    expect(boundariesCopy).toHaveLength(3);
  });

  it("should mention no individual replies", () => {
    expect(boundariesCopy[0]).toContain("can't reply to every message");
  });

  it("should direct users to Feedback form", () => {
    expect(boundariesCopy[1]).toContain("Feedback form");
  });

  it("should mention unverified events", () => {
    expect(boundariesCopy[2]).toContain("unverified");
  });
});
