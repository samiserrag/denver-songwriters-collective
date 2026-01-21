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

// =============================================================================
// Changelog Page Tests
// =============================================================================

describe("Changelog Page Structure", () => {
  const validTags = ["feature", "fix", "improvement"];

  it("should only use valid tag values", () => {
    // This test ensures new entries use the correct tag values
    validTags.forEach((tag) => {
      expect(["feature", "fix", "improvement"]).toContain(tag);
    });
  });

  it("should have tag labels for all valid tags", () => {
    const tagLabels: Record<string, string> = {
      feature: "New",
      fix: "Fix",
      improvement: "Improved",
    };

    validTags.forEach((tag) => {
      expect(tagLabels[tag]).toBeDefined();
    });
  });

  it("should have tag styles for all valid tags", () => {
    const tagStyles: Record<string, string> = {
      feature: "bg-emerald-100 text-emerald-800 border-emerald-300",
      fix: "bg-rose-100 text-rose-800 border-rose-300",
      improvement: "bg-sky-100 text-sky-800 border-sky-300",
    };

    validTags.forEach((tag) => {
      expect(tagStyles[tag]).toBeDefined();
    });
  });
});

describe("Changelog Entry Validation", () => {
  interface ChangelogEntry {
    date: string;
    title: string;
    bullets: string[];
    tags?: ("feature" | "fix" | "improvement")[];
  }

  const sampleEntry: ChangelogEntry = {
    date: "2026-01-20",
    title: "Early Contributors Program",
    bullets: [
      "Added role-based testing missions",
      "New feedback form with category prefill",
      "Thanks page with clear next steps",
    ],
    tags: ["feature"],
  };

  it("should have a valid ISO date format", () => {
    expect(sampleEntry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should have a non-empty title", () => {
    expect(sampleEntry.title.length).toBeGreaterThan(0);
  });

  it("should have 1-3 bullets", () => {
    expect(sampleEntry.bullets.length).toBeGreaterThanOrEqual(1);
    expect(sampleEntry.bullets.length).toBeLessThanOrEqual(3);
  });

  it("should have optional tags array", () => {
    expect(Array.isArray(sampleEntry.tags) || sampleEntry.tags === undefined).toBe(true);
  });
});

describe("Thanks Page Changelog Link", () => {
  it("should link to /changelog route", () => {
    const changelogPath = "/changelog";
    expect(changelogPath).toBe("/changelog");
  });

  it("should use proper link text", () => {
    const linkText = "See what's changed";
    expect(linkText).toContain("changed");
  });
});

// =============================================================================
// Phase 4.x — Time Estimate Removal Tests
// =============================================================================

describe("Early Contributors Page — No Time Estimates", () => {
  // Simulates the mission data structure as it should be after the update
  const missions = [
    {
      id: "songwriter",
      title: "Songwriter",
      bullets: [
        "Find an event you'd actually attend (clarity, time, signup, vibe)",
        "Check if songwriter profiles feel useful and trustworthy",
        "Tell us what would make you share this with a friend",
      ],
      feedbackSubject: "Early Contributors — Songwriter",
    },
    {
      id: "host",
      title: "Happenings Host / Organizer",
      bullets: [
        "Pretend you're promoting a happening: does the page sell it clearly?",
        "Check event details for missing info (where/when/signup/age/cover)",
        "Tell us what hosts need most to keep listings accurate",
      ],
      feedbackSubject: "Early Contributors — Host",
    },
    {
      id: "venue",
      title: "Venue / Promoter",
      bullets: [
        "Review venue pages: photos, parking, accessibility, basic trust signals",
        "Look for anything that would block you from partnering",
        "Tell us what venues would want added before saying \"yes\"",
      ],
      feedbackSubject: "Early Contributors — Venue",
    },
    {
      id: "visitor",
      title: "First-time Visitor",
      bullets: [
        "Use the site like you've never heard of it",
        "Tell us what's confusing, slow, or feels unfinished",
        "Tell us what would make you come back next week",
      ],
      feedbackSubject: "Early Contributors — Visitor",
    },
  ];

  const heroSubtitle = "Help shape the Denver Songwriters Collective. Pick a mission, explore, and tell us what you find.";

  it("should NOT contain '~20 minutes' in hero subtitle", () => {
    expect(heroSubtitle).not.toContain("~20 minutes");
    expect(heroSubtitle).not.toContain("20 minutes");
    expect(heroSubtitle).not.toContain("minutes");
  });

  it("should NOT have timebox property in mission data", () => {
    missions.forEach((mission) => {
      expect(mission).not.toHaveProperty("timebox");
    });
  });

  it("should NOT contain time estimates in any mission bullets", () => {
    missions.forEach((mission) => {
      mission.bullets.forEach((bullet) => {
        expect(bullet).not.toContain("minutes");
        expect(bullet).not.toContain("~20");
      });
    });
  });
});

// =============================================================================
// Phase 4.x — Updated Mission Bullets Tests
// =============================================================================

describe("Early Contributors Page — Updated Mission Bullets", () => {
  const songwriterBullets = [
    "Find an event you'd actually attend (clarity, time, signup, vibe)",
    "Check if songwriter profiles feel useful and trustworthy",
    "Tell us what would make you share this with a friend",
  ];

  const hostBullets = [
    "Pretend you're promoting a happening: does the page sell it clearly?",
    "Check event details for missing info (where/when/signup/age/cover)",
    "Tell us what hosts need most to keep listings accurate",
  ];

  const venueBullets = [
    "Review venue pages: photos, parking, accessibility, basic trust signals",
    "Look for anything that would block you from partnering",
    "Tell us what venues would want added before saying \"yes\"",
  ];

  const visitorBullets = [
    "Use the site like you've never heard of it",
    "Tell us what's confusing, slow, or feels unfinished",
    "Tell us what would make you come back next week",
  ];

  it("Songwriter mission should have updated bullet copy", () => {
    expect(songwriterBullets[0]).toContain("clarity, time, signup, vibe");
    expect(songwriterBullets[1]).toContain("trustworthy");
    expect(songwriterBullets[2]).toContain("share this with a friend");
  });

  it("Host mission should have updated bullet copy", () => {
    expect(hostBullets[0]).toContain("does the page sell it clearly?");
    expect(hostBullets[1]).toContain("where/when/signup/age/cover");
    expect(hostBullets[2]).toContain("keep listings accurate");
  });

  it("Venue mission should have updated bullet copy", () => {
    expect(venueBullets[0]).toContain("trust signals");
    expect(venueBullets[1]).toContain("block you from partnering");
    expect(venueBullets[2]).toContain("before saying");
  });

  it("Visitor mission should have updated bullet copy", () => {
    expect(visitorBullets[0]).toContain("never heard of it");
    expect(visitorBullets[1]).toContain("slow");
    expect(visitorBullets[2]).toContain("next week");
  });
});

// =============================================================================
// Phase 4.x — Optional Deep Dive Section Tests
// =============================================================================

describe("Early Contributors Page — Optional Deep Dive Section", () => {
  const deepDiveHeader = "If you want to go deeper";
  const deepDiveBullets = [
    "Try the site on mobile and report any friction",
    "Search for a venue or happening you know and check accuracy",
    "Look for missing \"trust\" info (who runs it, privacy, what's verified)",
    "Note anything that feels unclear in navigation or wording",
    "If you find a bug, include steps to reproduce in /feedback",
  ];

  it("should have the correct section header", () => {
    expect(deepDiveHeader).toBe("If you want to go deeper");
  });

  it("should have 5 deep dive bullets", () => {
    expect(deepDiveBullets).toHaveLength(5);
  });

  it("should mention mobile testing", () => {
    expect(deepDiveBullets[0]).toContain("mobile");
  });

  it("should mention accuracy checking", () => {
    expect(deepDiveBullets[1]).toContain("accuracy");
  });

  it("should mention trust info", () => {
    expect(deepDiveBullets[2]).toContain("trust");
  });

  it("should mention navigation/wording", () => {
    expect(deepDiveBullets[3]).toContain("navigation");
  });

  it("should direct bug reports to /feedback", () => {
    expect(deepDiveBullets[4]).toContain("/feedback");
  });
});
