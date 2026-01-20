/**
 * Bandcamp URL Support Tests
 *
 * Tests for:
 * 1. normalizeSocialUrl() handles Bandcamp URLs correctly
 * 2. buildSocialLinks() includes Bandcamp in correct position
 * 3. Music platform filtering for "Listen to My Music" section
 */

import { describe, expect, it } from "vitest";
import { normalizeSocialUrl, buildSocialLinks } from "@/components/profile/ProfileIcons";

describe("Bandcamp URL Normalization", () => {
  describe("normalizeSocialUrl with bandcamp platform", () => {
    it("returns null for null/undefined/empty values", () => {
      expect(normalizeSocialUrl(null, "bandcamp")).toBe(null);
      expect(normalizeSocialUrl(undefined, "bandcamp")).toBe(null);
      expect(normalizeSocialUrl("", "bandcamp")).toBe(null);
      expect(normalizeSocialUrl("   ", "bandcamp")).toBe(null);
    });

    it("preserves full Bandcamp URLs that start with https://", () => {
      expect(normalizeSocialUrl("https://artist.bandcamp.com", "bandcamp")).toBe(
        "https://artist.bandcamp.com"
      );
      expect(
        normalizeSocialUrl("https://someartist.bandcamp.com/album/great-songs", "bandcamp")
      ).toBe("https://someartist.bandcamp.com/album/great-songs");
    });

    it("adds https:// to Bandcamp URLs without protocol", () => {
      expect(normalizeSocialUrl("artist.bandcamp.com", "bandcamp")).toBe(
        "https://artist.bandcamp.com"
      );
      expect(normalizeSocialUrl("myband.bandcamp.com/album/first", "bandcamp")).toBe(
        "https://myband.bandcamp.com/album/first"
      );
    });

    it("converts bare username to bandcamp.com URL", () => {
      expect(normalizeSocialUrl("myartistname", "bandcamp")).toBe(
        "https://myartistname.bandcamp.com"
      );
      expect(normalizeSocialUrl("coolband", "bandcamp")).toBe(
        "https://coolband.bandcamp.com"
      );
    });

    it("strips @ prefix from bare username", () => {
      expect(normalizeSocialUrl("@myartistname", "bandcamp")).toBe(
        "https://myartistname.bandcamp.com"
      );
    });

    it("preserves http:// URLs as-is", () => {
      expect(normalizeSocialUrl("http://artist.bandcamp.com", "bandcamp")).toBe(
        "http://artist.bandcamp.com"
      );
    });
  });
});

describe("buildSocialLinks includes Bandcamp", () => {
  it("includes bandcamp_url when provided", () => {
    const profile = {
      bandcamp_url: "https://myartist.bandcamp.com",
    };

    const links = buildSocialLinks(profile);
    const bandcampLink = links.find((l) => l.type === "bandcamp");

    expect(bandcampLink).toBeDefined();
    expect(bandcampLink?.url).toBe("https://myartist.bandcamp.com");
    expect(bandcampLink?.label).toBe("Bandcamp");
  });

  it("places Bandcamp after Spotify in the order", () => {
    const profile = {
      spotify_url: "https://open.spotify.com/artist/123",
      bandcamp_url: "https://myartist.bandcamp.com",
      youtube_url: "https://youtube.com/@artist",
    };

    const links = buildSocialLinks(profile);
    const types = links.map((l) => l.type);

    // Order should be: spotify, bandcamp, youtube (per ProfileIcons.tsx)
    expect(types).toEqual(["spotify", "bandcamp", "youtube"]);
  });

  it("excludes bandcamp when bandcamp_url is null", () => {
    const profile = {
      spotify_url: "https://open.spotify.com/artist/123",
      bandcamp_url: null,
    };

    const links = buildSocialLinks(profile);
    const bandcampLink = links.find((l) => l.type === "bandcamp");

    expect(bandcampLink).toBeUndefined();
  });

  it("normalizes bare Bandcamp username in buildSocialLinks", () => {
    const profile = {
      bandcamp_url: "myartist",
    };

    const links = buildSocialLinks(profile);
    const bandcampLink = links.find((l) => l.type === "bandcamp");

    expect(bandcampLink?.url).toBe("https://myartist.bandcamp.com");
  });
});

describe("Music platform filtering for Listen to My Music section", () => {
  it("filters to music platforms: spotify, bandcamp, youtube", () => {
    const profile = {
      spotify_url: "https://open.spotify.com/artist/123",
      bandcamp_url: "https://myartist.bandcamp.com",
      youtube_url: "https://youtube.com/@artist",
      instagram_url: "https://instagram.com/artist",
      tiktok_url: "https://tiktok.com/@artist",
      website_url: "https://mysite.com",
      twitter_url: "https://x.com/artist",
    };

    const socialLinks = buildSocialLinks(profile);
    const musicPlatformLinks = socialLinks.filter((link) =>
      ["spotify", "bandcamp", "youtube"].includes(link.type)
    );

    expect(musicPlatformLinks).toHaveLength(3);
    expect(musicPlatformLinks.map((l) => l.type)).toEqual(["spotify", "bandcamp", "youtube"]);
  });

  it("returns empty array when no music platforms are set", () => {
    const profile = {
      instagram_url: "https://instagram.com/artist",
      tiktok_url: "https://tiktok.com/@artist",
    };

    const socialLinks = buildSocialLinks(profile);
    const musicPlatformLinks = socialLinks.filter((link) =>
      ["spotify", "bandcamp", "youtube"].includes(link.type)
    );

    expect(musicPlatformLinks).toHaveLength(0);
  });

  it("handles partial music platform presence", () => {
    const profile = {
      bandcamp_url: "https://myartist.bandcamp.com",
      instagram_url: "https://instagram.com/artist",
    };

    const socialLinks = buildSocialLinks(profile);
    const musicPlatformLinks = socialLinks.filter((link) =>
      ["spotify", "bandcamp", "youtube"].includes(link.type)
    );

    expect(musicPlatformLinks).toHaveLength(1);
    expect(musicPlatformLinks[0].type).toBe("bandcamp");
  });
});
