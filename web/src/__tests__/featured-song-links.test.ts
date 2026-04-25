import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSongLinksDisplay,
  getSongLinkEmbedMeta,
  getUnsupportedMusicLink,
  getUnsupportedMusicProfileLinks,
  getUnsupportedSongLinks,
  resolveSongLinkEmbedMeta,
} from "@/lib/profile/songLinks";

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("getSongLinkEmbedMeta", () => {
  it("returns youtube embed metadata for watch URLs", () => {
    const result = getSongLinkEmbedMeta("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result?.provider).toBe("youtube");
    if (!result || result.provider !== "youtube") return;
    expect(result.iframe.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("returns spotify embed metadata for spotify track URLs", () => {
    const result = getSongLinkEmbedMeta("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(result?.provider).toBe("spotify");
    if (!result || result.provider !== "spotify") return;
    expect(result.iframe.src).toBe("https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
  });

  it("returns null for non-embeddable profile URLs", () => {
    expect(getSongLinkEmbedMeta("https://www.youtube.com/@artist")).toBeNull();
    expect(getSongLinkEmbedMeta("https://soundcloud.com/artist/track")).toBeNull();
  });
});

describe("resolveSongLinkEmbedMeta", () => {
  it("resolves Bandcamp track pages to native Bandcamp player URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () =>
        `<html><head><meta name="bc-page-properties" content="{&quot;item_type&quot;:&quot;track&quot;,&quot;item_id&quot;:123456789}"></head></html>`,
    } as Response);

    const result = await resolveSongLinkEmbedMeta("https://artist.bandcamp.com/track/song-name");

    expect(result?.provider).toBe("bandcamp");
    if (!result || result.provider !== "bandcamp") return;
    expect(result.src).toBe(
      "https://bandcamp.com/EmbeddedPlayer/track=123456789/size=large/tracklist=false/artwork=small/transparent=true/"
    );
  });

  it("resolves ReverbNation song pages through trusted oEmbed iframe HTML", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "ReverbNation song",
        height: 390,
        html: `<iframe width="100%" height="390" src="https://www.reverbnation.com/widget_code/html_widget/artist_123?widget_id=55"></iframe>`,
      }),
    } as Response);

    const result = await resolveSongLinkEmbedMeta("https://www.reverbnation.com/example/song/123456-song-name");

    expect(result).toEqual({
      provider: "reverbnation",
      src: "https://www.reverbnation.com/widget_code/html_widget/artist_123?widget_id=55",
      title: "ReverbNation song",
      height: 390,
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.origin).toBe("https://www.reverbnation.com");
    expect(requestedUrl.pathname).toBe("/oembed");
    expect(requestedUrl.searchParams.get("format")).toBe("json");
    expect(requestedUrl.searchParams.get("url")).toBe(
      "https://www.reverbnation.com/example/song/123456-song-name"
    );
  });

  it("rejects ReverbNation oEmbed HTML when the iframe source is not ReverbNation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        html: `<iframe src="https://evil.example.com/player"></iframe>`,
      }),
    } as Response);

    await expect(resolveSongLinkEmbedMeta("https://www.reverbnation.com/example/song/123")).resolves.toBeNull();
  });
});

describe("unsupported music link guidance", () => {
  it("returns actionable Bandcamp guidance for unsupported links", () => {
    expect(getUnsupportedMusicLink("https://artist.bandcamp.com")).toEqual({
      url: "https://artist.bandcamp.com",
      label: "Bandcamp",
      guidance: "Use a Bandcamp track or album URL so the native player can load.",
    });
  });

  it("reports song links that did not resolve to native embeds", () => {
    const display = buildSongLinksDisplay("https://artist.bandcamp.com", [
      "https://open.spotify.com/track/1234567890abcdef",
    ]);
    const embedMap = new Map([
      [
        "https://open.spotify.com/track/1234567890abcdef",
        getSongLinkEmbedMeta("https://open.spotify.com/track/1234567890abcdef")!,
      ],
    ]);

    expect(getUnsupportedSongLinks(display, embedMap)).toEqual([
      {
        url: "https://artist.bandcamp.com",
        label: "Bandcamp",
        guidance: "Use a Bandcamp track or album URL so the native player can load.",
      },
    ]);
  });

  it("reports unsupported profile links without marking renderable profile embeds", () => {
    expect(
      getUnsupportedMusicProfileLinks({
        youtubeUrl: "https://www.youtube.com/channel/UC7LteDIZYaYTnTueJyrR-dg",
        spotifyUrl: "https://open.spotify.com/artist/2CIMQHirSU0MQqyYHq0eOx",
        bandcampUrl: null,
      })
    ).toEqual([]);

    expect(
      getUnsupportedMusicProfileLinks({
        youtubeUrl: "https://www.youtube.com/@unresolved",
        spotifyUrl: "https://open.spotify.com/user/serrasa",
        bandcampUrl: null,
      })
    ).toEqual([
      {
        url: "https://www.youtube.com/@unresolved",
        label: "YouTube",
        guidance: "Use a YouTube video, playlist, or channel URL that can resolve to uploads.",
      },
      {
        url: "https://open.spotify.com/user/serrasa",
        label: "Spotify",
        guidance: "Use a Spotify artist, track, album, or playlist URL instead of a user profile.",
      },
    ]);
  });
});
