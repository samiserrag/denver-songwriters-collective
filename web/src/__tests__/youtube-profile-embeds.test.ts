import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveYouTubeProfileEmbedUrl } from "@/lib/youtubeProfileEmbeds";

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("resolveYouTubeProfileEmbedUrl", () => {
  it("derives uploads playlist embeds from channel id URLs without an API key", async () => {
    await expect(
      resolveYouTubeProfileEmbedUrl("https://www.youtube.com/channel/UC7LteDIZYaYTnTueJyrR-dg")
    ).resolves.toBe("https://www.youtube-nocookie.com/embed/videoseries?list=UU7LteDIZYaYTnTueJyrR-dg");
  });

  it("falls back for handle URLs when no YouTube API key is configured", async () => {
    delete process.env.YOUTUBE_DATA_API_KEY;
    delete process.env.GOOGLE_YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_API_KEY;

    await expect(resolveYouTubeProfileEmbedUrl("https://www.youtube.com/@someartist")).resolves.toBeNull();
  });

  it("uses the YouTube Data API for handle URLs when configured", async () => {
    process.env.YOUTUBE_DATA_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            contentDetails: {
              relatedPlaylists: {
                uploads: "UUabc123uploads",
              },
            },
          },
        ],
      }),
    } as Response);

    await expect(resolveYouTubeProfileEmbedUrl("https://www.youtube.com/@someartist/videos")).resolves.toBe(
      "https://www.youtube-nocookie.com/embed/videoseries?list=UUabc123uploads"
    );

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.searchParams.get("forHandle")).toBe("@someartist");
    expect(requestedUrl.searchParams.get("part")).toBe("contentDetails");
    expect(requestedUrl.searchParams.get("key")).toBe("test-key");
  });
});
