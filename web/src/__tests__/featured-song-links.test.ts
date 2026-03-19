import { describe, expect, it } from "vitest";
import { buildSongLinksDisplay } from "@/lib/profile/songLinks";

describe("buildSongLinksDisplay", () => {
  it("shows featured song even when additional songs are empty", () => {
    const result = buildSongLinksDisplay("https://youtu.be/abc12345678", []);
    expect(result.featuredSongUrl).toBe("https://youtu.be/abc12345678");
    expect(result.additionalSongLinks).toEqual([]);
    expect(result.hasAnySongLinks).toBe(true);
  });

  it("dedupes featured song from additional song links", () => {
    const result = buildSongLinksDisplay("https://youtu.be/abc12345678", [
      "https://www.youtube.com/watch?v=abc12345678",
      "https://soundcloud.com/artist/track-1",
    ]);
    expect(result.additionalSongLinks).toEqual(["https://soundcloud.com/artist/track-1"]);
  });

  it("dedupes duplicate additional links while preserving order", () => {
    const result = buildSongLinksDisplay(null, [
      "https://soundcloud.com/artist/track-1",
      "https://soundcloud.com/artist/track-1?utm_source=abc",
      "https://open.spotify.com/track/1234567890abcdef",
      "https://open.spotify.com/track/1234567890abcdef?si=deadbeef",
    ]);
    expect(result.additionalSongLinks).toEqual([
      "https://soundcloud.com/artist/track-1",
      "https://open.spotify.com/track/1234567890abcdef",
    ]);
    expect(result.hasAnySongLinks).toBe(true);
  });

  it("returns no song links when featured and additional links are empty", () => {
    const result = buildSongLinksDisplay("   ", [" ", ""]);
    expect(result.featuredSongUrl).toBeNull();
    expect(result.additionalSongLinks).toEqual([]);
    expect(result.hasAnySongLinks).toBe(false);
  });
});
