import { describe, expect, it } from "vitest";
import { getEmbeddableMediaImportsFromMusicProfiles } from "@/lib/profile/musicProfiles";

describe("music profile import helper", () => {
  it("returns embeddable URLs from profile fields and skips existing embeds", () => {
    const result = getEmbeddableMediaImportsFromMusicProfiles(
      {
        youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        spotify_url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
        bandcamp_url: "https://myartist.bandcamp.com",
      },
      ["https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC"]
    );

    expect(result.importableUrls).toEqual([
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.field).toBe("bandcamp_url");
  });

  it("returns warnings for non-embeddable profile links", () => {
    const result = getEmbeddableMediaImportsFromMusicProfiles(
      {
        youtube_url: "https://youtube.com/@artistname",
        spotify_url: "https://open.spotify.com/artist/2CIMQHirSU0MQqyYHq0eOx",
      },
      []
    );

    expect(result.importableUrls).toEqual([]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.map((warning) => warning.field).sort()).toEqual([
      "spotify_url",
      "youtube_url",
    ]);
    expect(result.warnings.every((warning) => warning.reason.length > 0)).toBe(true);
  });
});
