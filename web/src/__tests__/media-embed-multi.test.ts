import { describe, expect, it } from "vitest";
import {
  classifyUrl,
  buildEmbedRows,
  MediaEmbedValidationError,
} from "@/lib/mediaEmbeds";

describe("classifyUrl (multi-embed)", () => {
  it("classifies YouTube URLs as youtube/video with embed URL", () => {
    const result = classifyUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.provider).toBe("youtube");
    expect(result.kind).toBe("video");
    expect(result.embed_url).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("classifies Spotify URLs as spotify/audio with embed URL", () => {
    const result = classifyUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(result.provider).toBe("spotify");
    expect(result.kind).toBe("audio");
    expect(result.embed_url).toContain("open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
  });

  it("classifies non-allowlisted URLs as external with no embed URL", () => {
    const result = classifyUrl("https://soundcloud.com/artist/track");
    expect(result.provider).toBe("external");
    expect(result.kind).toBe("external");
    expect(result.embed_url).toBeNull();
  });

  it("classifies bandcamp URLs as external", () => {
    const result = classifyUrl("https://artist.bandcamp.com/album/test");
    expect(result.provider).toBe("external");
    expect(result.kind).toBe("external");
    expect(result.embed_url).toBeNull();
  });

  it("throws for empty URLs", () => {
    expect(() => classifyUrl("")).toThrow(MediaEmbedValidationError);
    expect(() => classifyUrl("   ")).toThrow(MediaEmbedValidationError);
  });

  it("throws for non-http URLs", () => {
    expect(() => classifyUrl("ftp://example.com/file")).toThrow(MediaEmbedValidationError);
  });
});

describe("buildEmbedRows", () => {
  const target = { type: "profile" as const, id: "user-123" };
  const createdBy = "user-123";

  it("builds ordered rows from mixed URLs", () => {
    const urls = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      "https://soundcloud.com/artist/track",
    ];

    const rows = buildEmbedRows(urls, target, createdBy);
    expect(rows).toHaveLength(3);
    expect(rows[0].position).toBe(0);
    expect(rows[0].provider).toBe("youtube");
    expect(rows[1].position).toBe(1);
    expect(rows[1].provider).toBe("spotify");
    expect(rows[2].position).toBe(2);
    expect(rows[2].provider).toBe("external");
  });

  it("filters empty strings", () => {
    const rows = buildEmbedRows(["", "  ", "https://youtube.com/watch?v=abc123xyz"], target, createdBy);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe("youtube");
  });

  it("returns empty array for empty input", () => {
    const rows = buildEmbedRows([], target, createdBy);
    expect(rows).toHaveLength(0);
  });

  it("preserves order", () => {
    const urls = [
      "https://soundcloud.com/a",
      "https://www.youtube.com/watch?v=abc123xyz",
    ];
    const rows = buildEmbedRows(urls, target, createdBy);
    expect(rows[0].position).toBe(0);
    expect(rows[0].provider).toBe("external");
    expect(rows[1].position).toBe(1);
    expect(rows[1].provider).toBe("youtube");
  });

  it("sets target_type and target_id correctly", () => {
    const rows = buildEmbedRows(
      ["https://youtube.com/watch?v=abc123xyz"],
      { type: "event", id: "event-456" },
      "user-789"
    );
    expect(rows[0].target_type).toBe("event");
    expect(rows[0].target_id).toBe("event-456");
    expect(rows[0].created_by).toBe("user-789");
  });
});
