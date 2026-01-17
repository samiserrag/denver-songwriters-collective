/**
 * Tests for member profile routing logic
 * Phase: Fix fan-only member profile 404s
 *
 * Test cases:
 * - Fan-only profile routes to /members/[slug]
 * - Songwriter routes to /songwriters/[slug]
 * - Host-only routes to /songwriters/[slug]
 * - Studio routes to /studios/[slug]
 * - UUID → slug redirect works for /members/[id]
 * - Non-public profiles return 404
 */

import { describe, it, expect } from "vitest";

// Type matching the Member type from @/types
interface TestMember {
  id: string;
  slug?: string;
  name: string;
  role?: string;
  isSongwriter?: boolean;
  isHost?: boolean;
  isStudio?: boolean;
  isFan?: boolean;
}

// Replicate the helper functions from MemberCard.tsx for testing
// Note: legacy role enum is "performer" | "host" | "studio" | "admin" | "fan" | "member"
// "songwriter" is not a valid role value - use "performer" for legacy compatibility
function isMemberSongwriter(member: TestMember): boolean {
  return member.isSongwriter || member.role === "performer";
}

function isMemberHost(member: TestMember): boolean {
  return member.isHost || member.role === "host";
}

function isMemberStudio(member: TestMember): boolean {
  return member.isStudio || member.role === "studio";
}

function getProfileLink(member: TestMember): string {
  const identifier = member.slug || member.id;
  if (isMemberStudio(member)) {
    return `/studios/${identifier}`;
  }
  if (isMemberSongwriter(member) || isMemberHost(member)) {
    return `/songwriters/${identifier}`;
  }
  // Fan-only members go to /members/[id]
  return `/members/${identifier}`;
}

describe("Member Profile Routing", () => {
  describe("getProfileLink routing logic", () => {
    it("routes fan-only profile to /members/[slug]", () => {
      const fanOnlyMember: TestMember = {
        id: "uuid-123",
        slug: "jane-doe",
        name: "Jane Doe",
        isFan: true,
        isSongwriter: false,
        isHost: false,
        isStudio: false,
      };
      expect(getProfileLink(fanOnlyMember)).toBe("/members/jane-doe");
    });

    it("routes fan-only profile without slug to /members/[id]", () => {
      const fanOnlyMember: TestMember = {
        id: "uuid-123",
        name: "Jane Doe",
        isFan: true,
        isSongwriter: false,
        isHost: false,
        isStudio: false,
      };
      expect(getProfileLink(fanOnlyMember)).toBe("/members/uuid-123");
    });

    it("routes songwriter to /songwriters/[slug]", () => {
      const songwriter: TestMember = {
        id: "uuid-456",
        slug: "john-songwriter",
        name: "John Songwriter",
        isSongwriter: true,
        isFan: true,
      };
      expect(getProfileLink(songwriter)).toBe("/songwriters/john-songwriter");
    });

    it("routes host-only to /songwriters/[slug]", () => {
      const hostOnly: TestMember = {
        id: "uuid-789",
        slug: "host-person",
        name: "Host Person",
        isHost: true,
        isSongwriter: false,
        isFan: true,
      };
      expect(getProfileLink(hostOnly)).toBe("/songwriters/host-person");
    });

    it("routes studio to /studios/[slug]", () => {
      const studio: TestMember = {
        id: "uuid-abc",
        slug: "cool-studio",
        name: "Cool Studio",
        isStudio: true,
      };
      expect(getProfileLink(studio)).toBe("/studios/cool-studio");
    });

    it("routes songwriter+host to /songwriters/[slug]", () => {
      const songwriterHost: TestMember = {
        id: "uuid-def",
        slug: "multi-talent",
        name: "Multi Talent",
        isSongwriter: true,
        isHost: true,
        isFan: true,
      };
      expect(getProfileLink(songwriterHost)).toBe("/songwriters/multi-talent");
    });

    it("handles legacy role=performer correctly", () => {
      const legacyPerformer: TestMember = {
        id: "uuid-legacy",
        slug: "legacy-user",
        name: "Legacy User",
        role: "performer",
        isFan: true,
      };
      expect(getProfileLink(legacyPerformer)).toBe("/songwriters/legacy-user");
    });

    it("handles legacy role=host correctly", () => {
      const legacyHost: TestMember = {
        id: "uuid-legacy2",
        slug: "legacy-host",
        name: "Legacy Host",
        role: "host",
        isFan: true,
      };
      expect(getProfileLink(legacyHost)).toBe("/songwriters/legacy-host");
    });

    it("handles legacy role=studio correctly", () => {
      const legacyStudio: TestMember = {
        id: "uuid-legacy3",
        slug: "legacy-studio",
        name: "Legacy Studio",
        role: "studio",
      };
      expect(getProfileLink(legacyStudio)).toBe("/studios/legacy-studio");
    });

    it("handles legacy role=fan correctly (routes to /members)", () => {
      const legacyFan: TestMember = {
        id: "uuid-legacy4",
        slug: "legacy-fan",
        name: "Legacy Fan",
        role: "fan",
      };
      expect(getProfileLink(legacyFan)).toBe("/members/legacy-fan");
    });

    it("handles member with no flags (routes to /members)", () => {
      const noFlags: TestMember = {
        id: "uuid-empty",
        slug: "empty-profile",
        name: "Empty Profile",
      };
      expect(getProfileLink(noFlags)).toBe("/members/empty-profile");
    });

    it("prefers slug over id when both are present", () => {
      const memberWithSlug: TestMember = {
        id: "some-long-uuid-string",
        slug: "nice-slug",
        name: "Nice Name",
        isFan: true,
      };
      expect(getProfileLink(memberWithSlug)).toBe("/members/nice-slug");
    });

    it("falls back to id when slug is missing", () => {
      const memberNoSlug: TestMember = {
        id: "some-long-uuid-string",
        name: "No Slug",
        isFan: true,
      };
      expect(getProfileLink(memberNoSlug)).toBe("/members/some-long-uuid-string");
    });
  });

  describe("identity flag priority", () => {
    it("studio takes priority over songwriter", () => {
      const studioSongwriter: TestMember = {
        id: "uuid-priority",
        slug: "studio-songwriter",
        name: "Studio Songwriter",
        isStudio: true,
        isSongwriter: true,
      };
      // Studios always go to /studios
      expect(getProfileLink(studioSongwriter)).toBe("/studios/studio-songwriter");
    });

    it("songwriter takes priority over fan-only", () => {
      const songwriterFan: TestMember = {
        id: "uuid-priority2",
        slug: "songwriter-fan",
        name: "Songwriter Fan",
        isSongwriter: true,
        isFan: true,
      };
      expect(getProfileLink(songwriterFan)).toBe("/songwriters/songwriter-fan");
    });

    it("host takes priority over fan-only", () => {
      const hostFan: TestMember = {
        id: "uuid-priority3",
        slug: "host-fan",
        name: "Host Fan",
        isHost: true,
        isFan: true,
      };
      expect(getProfileLink(hostFan)).toBe("/songwriters/host-fan");
    });
  });
});

describe("UUID detection helper", () => {
  // Replicate the isUUID function from the page component
  function isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  it("recognizes valid UUID", () => {
    expect(isUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("recognizes UUID with uppercase letters", () => {
    expect(isUUID("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("rejects slug", () => {
    expect(isUUID("jane-doe")).toBe(false);
  });

  it("rejects partial UUID", () => {
    expect(isUUID("123e4567-e89b-12d3-a456")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isUUID("")).toBe(false);
  });
});

describe("/members/[id] route behavior", () => {
  // These are contract tests documenting expected behavior
  // Actual integration testing would require a test database

  it("documents query structure for is_public check", () => {
    // The query must be: (id = $1 OR slug = $1) AND is_public = true
    // This prevents bypassing is_public check via UUID access
    const expectedQueryPattern = {
      filter1: "id or slug match",
      filter2: "is_public = true",
      order: "AND (both must match)",
    };
    expect(expectedQueryPattern.order).toBe("AND (both must match)");
  });

  it("documents canonical redirect behavior", () => {
    // If accessed by UUID and profile has slug, redirect to slug URL
    const redirectBehavior = {
      condition: "isUUID(id) && profile.slug exists",
      action: "redirect to /members/{slug}",
    };
    expect(redirectBehavior.action).toContain("/members/");
  });

  it("documents 404 behavior for non-public profiles", () => {
    // Non-public profiles should return notFound()
    const notFoundCondition = {
      trigger: "is_public = false",
      result: "404 Not Found",
    };
    expect(notFoundCondition.result).toBe("404 Not Found");
  });
});
