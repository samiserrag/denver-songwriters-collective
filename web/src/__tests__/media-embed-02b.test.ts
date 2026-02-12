import { describe, expect, it } from "vitest";
import { buildEmbedRows, classifyUrl, type MediaEmbedTargetType } from "@/lib/mediaEmbeds";

describe("Phase 02B target types", () => {
  const createdBy = "admin-1";

  it("builds rows with target_type=event", () => {
    const rows = buildEmbedRows(
      ["https://youtube.com/watch?v=abc123xyz"],
      { type: "event" as MediaEmbedTargetType, id: "event-1" },
      createdBy
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].target_type).toBe("event");
    expect(rows[0].target_id).toBe("event-1");
    expect(rows[0].date_key).toBeNull();
  });

  it("builds rows with target_type=event_override and date_key", () => {
    const rows = buildEmbedRows(
      ["https://youtube.com/watch?v=abc123xyz"],
      { type: "event_override" as MediaEmbedTargetType, id: "event-1", date_key: "2025-03-15" },
      createdBy
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].target_type).toBe("event_override");
    expect(rows[0].target_id).toBe("event-1");
    expect(rows[0].date_key).toBe("2025-03-15");
  });

  it("builds rows with target_type=blog_post", () => {
    const rows = buildEmbedRows(
      ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"],
      { type: "blog_post" as MediaEmbedTargetType, id: "post-1" },
      createdBy
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].target_type).toBe("blog_post");
    expect(rows[0].target_id).toBe("post-1");
    expect(rows[0].date_key).toBeNull();
  });

  it("builds rows with target_type=gallery_album", () => {
    const rows = buildEmbedRows(
      ["https://soundcloud.com/artist/track"],
      { type: "gallery_album" as MediaEmbedTargetType, id: "album-1" },
      createdBy
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].target_type).toBe("gallery_album");
    expect(rows[0].target_id).toBe("album-1");
    expect(rows[0].provider).toBe("external");
    expect(rows[0].date_key).toBeNull();
  });

  it("builds multiple mixed-provider rows with correct positions across target types", () => {
    const urls = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      "https://bandcamp.com/album/test",
    ];

    for (const targetType of ["event", "blog_post", "gallery_album"] as MediaEmbedTargetType[]) {
      const rows = buildEmbedRows(urls, { type: targetType, id: "id-1" }, createdBy);
      expect(rows).toHaveLength(3);
      expect(rows[0].position).toBe(0);
      expect(rows[0].provider).toBe("youtube");
      expect(rows[1].position).toBe(1);
      expect(rows[1].provider).toBe("spotify");
      expect(rows[2].position).toBe(2);
      expect(rows[2].provider).toBe("external");
      expect(rows.every((r) => r.target_type === targetType)).toBe(true);
    }
  });
});

describe("classifyUrl safety checks for Phase 02B", () => {
  it("rejects javascript: protocol URLs", () => {
    expect(() => classifyUrl("javascript:alert(1)")).toThrow();
  });

  it("rejects data: URLs", () => {
    expect(() => classifyUrl("data:text/html,<script>alert(1)</script>")).toThrow();
  });

  it("handles YouTube short URL", () => {
    const result = classifyUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(result.provider).toBe("youtube");
    expect(result.kind).toBe("video");
    expect(result.embed_url).toContain("youtube-nocookie.com");
  });

  it("handles Spotify playlist URL", () => {
    const result = classifyUrl("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");
    expect(result.provider).toBe("spotify");
    expect(result.kind).toBe("audio");
    expect(result.embed_url).toContain("spotify.com/embed");
  });
});
