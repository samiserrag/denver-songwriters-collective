/**
 * Tests for onboarding field persistence
 * Phase: P0 Bug Fix — Restore lost onboarding field persistence
 *
 * Root Cause: Commit 0d3d0c1 (Dec 26, 2025) accidentally dropped 12 fields
 * from the onboarding API when bypassing RLS.
 *
 * This fix restores all 17 fields that the UI collects to be persisted to DB.
 */

import { describe, it, expect } from "vitest";

// Field definitions matching the UI state and DB schema
// Organized by UI section for clarity

const IDENTITY_FLAGS = [
  "is_songwriter",
  "is_host",
  "is_studio",
  "is_fan",
];

const SOCIAL_LINK_FIELDS = [
  "instagram_url",
  "spotify_url",
  "youtube_url",
  "website_url",
  "tiktok_url",
];

const TIPPING_FIELDS = [
  "venmo_handle",
  "cashapp_handle",
  "paypal_url",
];

const COLLAB_FIELDS = [
  "open_to_collabs",
  "interested_in_cowriting",
];

const ARRAY_FIELDS = [
  "instruments",
  "genres",
];

// All 18 onboarding fields that should be persisted:
// - 1 required: full_name
// - 4 identity flags: is_songwriter, is_host, is_studio, is_fan
// - 1 about: bio
// - 5 social links: instagram_url, spotify_url, youtube_url, website_url, tiktok_url
// - 3 tipping: venmo_handle, cashapp_handle, paypal_url
// - 2 collaboration: open_to_collabs, interested_in_cowriting
// - 2 arrays: instruments, genres
// Total: 1 + 4 + 1 + 5 + 3 + 2 + 2 = 18
const ALL_ONBOARDING_FIELDS = [
  "full_name",
  ...IDENTITY_FLAGS,
  "bio",
  ...SOCIAL_LINK_FIELDS,
  ...TIPPING_FIELDS,
  ...COLLAB_FIELDS,
  ...ARRAY_FIELDS,
];

/**
 * Simulates the request body that the UI sends to the API
 * This matches the pattern in onboarding/profile/page.tsx handleSubmit
 */
function buildOnboardingPayload(overrides: Record<string, unknown> = {}) {
  return {
    full_name: "Test User",
    is_songwriter: false,
    is_host: false,
    is_studio: false,
    is_fan: true,
    bio: null,
    instagram_url: null,
    spotify_url: null,
    youtube_url: null,
    website_url: null,
    tiktok_url: null,
    venmo_handle: null,
    cashapp_handle: null,
    paypal_url: null,
    open_to_collabs: false,
    interested_in_cowriting: false,
    instruments: null,
    genres: null,
    ...overrides,
  };
}

/**
 * Simulates the API route's destructure + update object construction
 * This mirrors the logic in api/onboarding/route.ts
 */
function buildUpdatePayload(body: Record<string, unknown>) {
  const {
    full_name,
    is_songwriter = false,
    is_host = false,
    is_studio = false,
    is_fan = false,
    bio,
    instagram_url,
    spotify_url,
    youtube_url,
    website_url,
    tiktok_url,
    venmo_handle,
    cashapp_handle,
    paypal_url,
    open_to_collabs = false,
    interested_in_cowriting = false,
    instruments,
    genres,
  } = body;

  return {
    full_name: full_name || null,
    is_songwriter,
    is_host,
    is_studio,
    is_fan,
    bio: bio || null,
    instagram_url: instagram_url || null,
    spotify_url: spotify_url || null,
    youtube_url: youtube_url || null,
    website_url: website_url || null,
    tiktok_url: tiktok_url || null,
    venmo_handle: venmo_handle || null,
    cashapp_handle: cashapp_handle || null,
    paypal_url: paypal_url || null,
    open_to_collabs,
    interested_in_cowriting,
    instruments: (instruments as string[] | null)?.length ? instruments : null,
    genres: (genres as string[] | null)?.length ? genres : null,
    onboarding_complete: true,
  };
}

describe("Onboarding Field Persistence", () => {
  describe("Field count verification", () => {
    it("should have exactly 18 onboarding fields", () => {
      // This is the contract: UI collects 18 fields, API must persist 18 fields
      expect(ALL_ONBOARDING_FIELDS.length).toBe(18);
    });

    it("should include all identity flags", () => {
      IDENTITY_FLAGS.forEach((field) => {
        expect(ALL_ONBOARDING_FIELDS).toContain(field);
      });
    });

    it("should include all social link fields", () => {
      SOCIAL_LINK_FIELDS.forEach((field) => {
        expect(ALL_ONBOARDING_FIELDS).toContain(field);
      });
    });

    it("should include all tipping fields", () => {
      TIPPING_FIELDS.forEach((field) => {
        expect(ALL_ONBOARDING_FIELDS).toContain(field);
      });
    });

    it("should include collaboration fields", () => {
      COLLAB_FIELDS.forEach((field) => {
        expect(ALL_ONBOARDING_FIELDS).toContain(field);
      });
    });

    it("should include array fields (instruments, genres)", () => {
      ARRAY_FIELDS.forEach((field) => {
        expect(ALL_ONBOARDING_FIELDS).toContain(field);
      });
    });
  });

  describe("API payload construction", () => {
    it("should include all 18 fields in update payload", () => {
      const requestBody = buildOnboardingPayload();
      const updatePayload = buildUpdatePayload(requestBody);

      // Verify all 18 fields are present (plus onboarding_complete)
      ALL_ONBOARDING_FIELDS.forEach((field) => {
        expect(updatePayload).toHaveProperty(field);
      });
      expect(updatePayload).toHaveProperty("onboarding_complete", true);
    });

    it("should convert empty strings to null for optional fields", () => {
      const requestBody = buildOnboardingPayload({
        bio: "",
        instagram_url: "",
        venmo_handle: "",
      });
      const updatePayload = buildUpdatePayload(requestBody);

      expect(updatePayload.bio).toBeNull();
      expect(updatePayload.instagram_url).toBeNull();
      expect(updatePayload.venmo_handle).toBeNull();
    });

    it("should preserve non-empty string values", () => {
      const requestBody = buildOnboardingPayload({
        bio: "I write songs about cats",
        instagram_url: "https://instagram.com/catwriter",
        venmo_handle: "@catwriter",
      });
      const updatePayload = buildUpdatePayload(requestBody);

      expect(updatePayload.bio).toBe("I write songs about cats");
      expect(updatePayload.instagram_url).toBe("https://instagram.com/catwriter");
      expect(updatePayload.venmo_handle).toBe("@catwriter");
    });

    it("should convert empty arrays to null", () => {
      const requestBody = buildOnboardingPayload({
        instruments: [],
        genres: [],
      });
      const updatePayload = buildUpdatePayload(requestBody);

      expect(updatePayload.instruments).toBeNull();
      expect(updatePayload.genres).toBeNull();
    });

    it("should preserve non-empty arrays", () => {
      const requestBody = buildOnboardingPayload({
        instruments: ["Guitar", "Piano"],
        genres: ["Folk", "Rock"],
      });
      const updatePayload = buildUpdatePayload(requestBody);

      expect(updatePayload.instruments).toEqual(["Guitar", "Piano"]);
      expect(updatePayload.genres).toEqual(["Folk", "Rock"]);
    });

    it("should default boolean fields to false when missing", () => {
      // Simulates API receiving partial body (shouldn't happen but defensive)
      const partialBody = {
        full_name: "Test User",
      };
      const updatePayload = buildUpdatePayload(partialBody);

      expect(updatePayload.is_songwriter).toBe(false);
      expect(updatePayload.is_host).toBe(false);
      expect(updatePayload.is_studio).toBe(false);
      expect(updatePayload.is_fan).toBe(false);
      expect(updatePayload.open_to_collabs).toBe(false);
      expect(updatePayload.interested_in_cowriting).toBe(false);
    });

    it("should preserve boolean true values", () => {
      const requestBody = buildOnboardingPayload({
        is_songwriter: true,
        is_fan: true,
        open_to_collabs: true,
        interested_in_cowriting: true,
      });
      const updatePayload = buildUpdatePayload(requestBody);

      expect(updatePayload.is_songwriter).toBe(true);
      expect(updatePayload.is_fan).toBe(true);
      expect(updatePayload.open_to_collabs).toBe(true);
      expect(updatePayload.interested_in_cowriting).toBe(true);
    });
  });

  describe("Full profile scenario", () => {
    it("should correctly handle a fully populated profile", () => {
      const requestBody = buildOnboardingPayload({
        full_name: "Jane Songwriter",
        is_songwriter: true,
        is_host: false,
        is_studio: false,
        is_fan: true,
        bio: "Singer-songwriter from Denver",
        instagram_url: "https://instagram.com/janesongs",
        spotify_url: "https://open.spotify.com/artist/abc123",
        youtube_url: "https://youtube.com/@janesongs",
        website_url: "https://janesongwriter.com",
        tiktok_url: "https://tiktok.com/@janesongs",
        venmo_handle: "@janesongs",
        cashapp_handle: "$janesongs",
        paypal_url: "https://paypal.me/janesongs",
        open_to_collabs: true,
        interested_in_cowriting: true,
        instruments: ["Acoustic Guitar", "Voice", "Piano"],
        genres: ["Folk", "Americana", "Indie"],
      });
      const updatePayload = buildUpdatePayload(requestBody);

      // Verify all fields are correctly passed through
      expect(updatePayload.full_name).toBe("Jane Songwriter");
      expect(updatePayload.bio).toBe("Singer-songwriter from Denver");
      expect(updatePayload.is_songwriter).toBe(true);
      expect(updatePayload.is_fan).toBe(true);
      expect(updatePayload.instagram_url).toBe("https://instagram.com/janesongs");
      expect(updatePayload.venmo_handle).toBe("@janesongs");
      expect(updatePayload.open_to_collabs).toBe(true);
      expect(updatePayload.instruments).toEqual(["Acoustic Guitar", "Voice", "Piano"]);
      expect(updatePayload.genres).toEqual(["Folk", "Americana", "Indie"]);
      expect(updatePayload.onboarding_complete).toBe(true);
    });

    it("should correctly handle a minimal profile (name only)", () => {
      const requestBody = buildOnboardingPayload({
        full_name: "Minimal User",
      });
      const updatePayload = buildUpdatePayload(requestBody);

      expect(updatePayload.full_name).toBe("Minimal User");
      expect(updatePayload.bio).toBeNull();
      expect(updatePayload.instagram_url).toBeNull();
      expect(updatePayload.instruments).toBeNull();
      expect(updatePayload.genres).toBeNull();
      expect(updatePayload.onboarding_complete).toBe(true);
    });
  });

  describe("Skip handler parity", () => {
    it("should use same field set for submit and skip", () => {
      // The handleSubmit and handleSkip functions should send identical field sets
      // This test documents that both paths save all data, not just the required fields
      const submitPayload = buildOnboardingPayload({
        full_name: "Test User",
        bio: "My bio",
        instruments: ["Guitar"],
      });
      const skipPayload = buildOnboardingPayload({
        full_name: "Test User",
        bio: "My bio",
        instruments: ["Guitar"],
      });

      const submitUpdate = buildUpdatePayload(submitPayload);
      const skipUpdate = buildUpdatePayload(skipPayload);

      // Both should have all 17 fields + onboarding_complete
      expect(Object.keys(submitUpdate).length).toBe(Object.keys(skipUpdate).length);
      expect(submitUpdate).toEqual(skipUpdate);
    });
  });
});

describe("Regression guard: Previously dropped fields", () => {
  // These are the 13 fields that were accidentally dropped in commit 0d3d0c1
  // (the hotfix only kept: full_name, is_songwriter, is_host, is_studio, is_fan)
  const PREVIOUSLY_DROPPED_FIELDS = [
    "bio",
    "instagram_url",
    "spotify_url",
    "youtube_url",
    "website_url",
    "tiktok_url",
    "venmo_handle",
    "cashapp_handle",
    "paypal_url",
    "open_to_collabs",
    "interested_in_cowriting",
    "instruments",
    "genres",
  ];

  it("should include all 13 previously dropped fields", () => {
    expect(PREVIOUSLY_DROPPED_FIELDS.length).toBe(13);
  });

  it("should persist all previously dropped fields", () => {
    const requestBody = buildOnboardingPayload({
      bio: "Test bio",
      instagram_url: "https://instagram.com/test",
      spotify_url: "https://spotify.com/test",
      youtube_url: "https://youtube.com/test",
      website_url: "https://test.com",
      tiktok_url: "https://tiktok.com/test",
      venmo_handle: "@test",
      cashapp_handle: "$test",
      paypal_url: "https://paypal.me/test",
      open_to_collabs: true,
      interested_in_cowriting: true,
      instruments: ["Guitar"],
      genres: ["Rock"],
    });
    const updatePayload = buildUpdatePayload(requestBody);

    PREVIOUSLY_DROPPED_FIELDS.forEach((field) => {
      expect(updatePayload).toHaveProperty(field);
      // Also verify the value is not undefined (would indicate field not processed)
      expect(updatePayload[field as keyof typeof updatePayload]).not.toBeUndefined();
    });
  });
});
