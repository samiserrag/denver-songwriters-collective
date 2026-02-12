import { describe, expect, it } from "vitest";
import { MediaEmbedValidationError, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";

describe("media embed normalization", () => {
  it("normalizes YouTube video links to youtube-nocookie embed URLs", () => {
    const result = normalizeMediaEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
      expectedProvider: "youtube",
    });

    expect(result).toEqual({
      provider: "youtube",
      kind: "video",
      normalized_url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it("normalizes YouTube playlist links to youtube-nocookie videoseries URLs", () => {
    const result = normalizeMediaEmbedUrl("https://www.youtube.com/playlist?list=PL1234567890ABCD", {
      expectedProvider: "youtube",
    });

    expect(result).toEqual({
      provider: "youtube",
      kind: "playlist",
      normalized_url: "https://www.youtube-nocookie.com/embed/videoseries?list=PL1234567890ABCD",
    });
  });

  it("normalizes Spotify playlist and track links to embed URLs", () => {
    const playlist = normalizeMediaEmbedUrl("https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd", {
      expectedProvider: "spotify",
    });
    const track = normalizeMediaEmbedUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", {
      expectedProvider: "spotify",
    });

    expect(playlist).toEqual({
      provider: "spotify",
      kind: "playlist",
      normalized_url: "https://open.spotify.com/embed/playlist/37i9dQZF1DX0XUsuxWHRQd",
    });
    expect(track).toEqual({
      provider: "spotify",
      kind: "track",
      normalized_url: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
    });
  });

  it("rejects invalid hostnames", () => {
    expect(() =>
      normalizeMediaEmbedUrl("https://evil.example.com/watch?v=abc123", { expectedProvider: "youtube" })
    ).toThrow(MediaEmbedValidationError);
  });

  it("returns null for empty values", () => {
    expect(normalizeMediaEmbedUrl("   ", { expectedProvider: "youtube" })).toBeNull();
  });
});
