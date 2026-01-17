import { describe, it, expect } from "vitest";
import {
  buildSocialLinks,
  normalizeSocialUrl,
} from "@/components/profile/ProfileIcons";

describe("buildSocialLinks", () => {
  it("returns empty array when all fields are missing or null", () => {
    const result = buildSocialLinks({});
    expect(result).toEqual([]);

    const resultWithNulls = buildSocialLinks({
      instagram_url: null,
      facebook_url: null,
      twitter_url: null,
      youtube_url: null,
      spotify_url: null,
      tiktok_url: null,
      website_url: null,
    });
    expect(resultWithNulls).toEqual([]);
  });

  it("returns links in musician-centric priority order", () => {
    const profile = {
      instagram_url: "https://instagram.com/testuser",
      twitter_url: "https://x.com/testuser",
      youtube_url: "https://youtube.com/@testchannel",
      spotify_url: "https://open.spotify.com/artist/123",
      tiktok_url: "https://tiktok.com/@testuser",
      website_url: "https://example.com",
    };

    const result = buildSocialLinks(profile);

    // Expected order: Spotify → YouTube → Instagram → TikTok → Website → Twitter/X
    expect(result.map((link) => link.type)).toEqual([
      "spotify",
      "youtube",
      "instagram",
      "tiktok",
      "website",
      "twitter",
    ]);

    // Verify Twitter label is "X"
    const twitterLink = result.find((link) => link.type === "twitter");
    expect(twitterLink?.label).toBe("X");
  });

  it("preserves existing full URLs without modification", () => {
    const profile = {
      instagram_url: "https://instagram.com/existinguser",
      spotify_url: "https://open.spotify.com/artist/existingartist",
      website_url: "https://myband.com/music",
    };

    const result = buildSocialLinks(profile);

    expect(result.find((l) => l.type === "instagram")?.url).toBe(
      "https://instagram.com/existinguser"
    );
    expect(result.find((l) => l.type === "spotify")?.url).toBe(
      "https://open.spotify.com/artist/existingartist"
    );
    expect(result.find((l) => l.type === "website")?.url).toBe(
      "https://myband.com/music"
    );
  });
});

describe("normalizeSocialUrl", () => {
  it("converts Twitter handle to x.com URL", () => {
    expect(normalizeSocialUrl("someuser", "twitter")).toBe(
      "https://x.com/someuser"
    );
    expect(normalizeSocialUrl("@someuser", "twitter")).toBe(
      "https://x.com/someuser"
    );
  });

  it("adds https:// to bare website domain", () => {
    expect(normalizeSocialUrl("example.com", "website")).toBe(
      "https://example.com"
    );
    expect(normalizeSocialUrl("my-band.org/music", "website")).toBe(
      "https://my-band.org/music"
    );
  });

  it("preserves existing full URLs", () => {
    expect(normalizeSocialUrl("https://instagram.com/foo", "instagram")).toBe(
      "https://instagram.com/foo"
    );
    expect(normalizeSocialUrl("http://old-site.com", "website")).toBe(
      "http://old-site.com"
    );
    expect(normalizeSocialUrl("https://twitter.com/user", "twitter")).toBe(
      "https://twitter.com/user"
    );
  });

  it("returns null for null, undefined, or empty values", () => {
    expect(normalizeSocialUrl(null, "instagram")).toBeNull();
    expect(normalizeSocialUrl(undefined, "instagram")).toBeNull();
    expect(normalizeSocialUrl("", "instagram")).toBeNull();
    expect(normalizeSocialUrl("   ", "instagram")).toBeNull();
  });

  it("normalizes platform-specific handles correctly", () => {
    // Instagram
    expect(normalizeSocialUrl("myband", "instagram")).toBe(
      "https://instagram.com/myband"
    );
    expect(normalizeSocialUrl("@myband", "instagram")).toBe(
      "https://instagram.com/myband"
    );

    // YouTube
    expect(normalizeSocialUrl("mychannel", "youtube")).toBe(
      "https://youtube.com/@mychannel"
    );
    expect(normalizeSocialUrl("@mychannel", "youtube")).toBe(
      "https://youtube.com/@mychannel"
    );

    // TikTok
    expect(normalizeSocialUrl("tiktoker", "tiktok")).toBe(
      "https://tiktok.com/@tiktoker"
    );
    expect(normalizeSocialUrl("@tiktoker", "tiktok")).toBe(
      "https://tiktok.com/@tiktoker"
    );
  });
});
