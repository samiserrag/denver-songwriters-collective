import { describe, expect, it } from "vitest";
import {
  buildEmbedRows,
  buildEmbedRowsSafe,
  classifyUrl,
  type MediaEmbedTargetType,
} from "@/lib/mediaEmbeds";

describe("MEDIA-EMBED-02D: venue target type", () => {
  const createdBy = "user-venue-mgr";

  it("builds rows with target_type=venue", () => {
    const rows = buildEmbedRows(
      ["https://youtube.com/watch?v=abc123xyz"],
      { type: "venue" as MediaEmbedTargetType, id: "venue-1" },
      createdBy
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].target_type).toBe("venue");
    expect(rows[0].target_id).toBe("venue-1");
    expect(rows[0].date_key).toBeNull();
    expect(rows[0].created_by).toBe(createdBy);
  });

  it("builds mixed-provider rows for venue target", () => {
    const urls = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      "https://example.com/about-venue",
    ];

    const rows = buildEmbedRows(
      urls,
      { type: "venue" as MediaEmbedTargetType, id: "venue-2" },
      createdBy
    );

    expect(rows).toHaveLength(3);
    expect(rows[0].position).toBe(0);
    expect(rows[0].provider).toBe("youtube");
    expect(rows[0].target_type).toBe("venue");
    expect(rows[1].position).toBe(1);
    expect(rows[1].provider).toBe("spotify");
    expect(rows[2].position).toBe(2);
    expect(rows[2].provider).toBe("external");
    expect(rows.every((r) => r.target_type === "venue")).toBe(true);
  });

  it("returns empty rows for empty URLs with venue target", () => {
    const rows = buildEmbedRows(
      [],
      { type: "venue" as MediaEmbedTargetType, id: "venue-3" },
      createdBy
    );
    expect(rows).toHaveLength(0);
  });

  it("skips invalid URLs and returns errors via buildEmbedRowsSafe", () => {
    const result = buildEmbedRowsSafe(
      [
        "https://youtube.com/watch?v=abc123xyz",
        "not-a-url",
        "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      ],
      { type: "venue" as MediaEmbedTargetType, id: "venue-4" },
      createdBy
    );

    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
    expect(result.errors[0].url).toBe("not-a-url");
  });

  it("venue is included in MediaEmbedTargetType union", () => {
    // TypeScript compilation test: this should compile without error
    const targetType: MediaEmbedTargetType = "venue";
    expect(targetType).toBe("venue");
  });
});

describe("MEDIA-EMBED-02D: venue builds alongside other target types", () => {
  const createdBy = "user-1";
  const testUrl = "https://youtube.com/watch?v=abc123xyz";

  it("venue target works identically to other target types", () => {
    const targets: Array<{ type: MediaEmbedTargetType; id: string }> = [
      { type: "event", id: "e-1" },
      { type: "event_override", id: "e-1" },
      { type: "profile", id: "p-1" },
      { type: "blog_post", id: "b-1" },
      { type: "gallery_album", id: "g-1" },
      { type: "venue", id: "v-1" },
    ];

    for (const target of targets) {
      const rows = buildEmbedRows([testUrl], target, createdBy);
      expect(rows).toHaveLength(1);
      expect(rows[0].target_type).toBe(target.type);
      expect(rows[0].target_id).toBe(target.id);
      expect(rows[0].provider).toBe("youtube");
    }
  });
});

describe("MEDIA-EMBED-02D: classifyUrl unchanged behavior", () => {
  it("still classifies YouTube correctly", () => {
    const result = classifyUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.provider).toBe("youtube");
    expect(result.kind).toBe("video");
  });

  it("still classifies Spotify correctly", () => {
    const result = classifyUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(result.provider).toBe("spotify");
    expect(result.kind).toBe("audio");
  });

  it("still classifies Bandcamp EmbeddedPlayer correctly", () => {
    const result = classifyUrl(
      "https://bandcamp.com/EmbeddedPlayer/album=123456/size=large/tracklist=false/artwork=small/transparent=true/"
    );
    expect(result.provider).toBe("bandcamp");
    expect(result.kind).toBe("audio");
    expect(result.embed_url).toBeTruthy();
  });

  it("still classifies external URLs correctly", () => {
    const result = classifyUrl("https://example.com/my-venue-page");
    expect(result.provider).toBe("external");
    expect(result.kind).toBe("external");
    expect(result.embed_url).toBeNull();
  });
});
