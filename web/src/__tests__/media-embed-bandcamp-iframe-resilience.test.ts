import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  parseEmbedInput,
  classifyUrl,
  buildEmbedRowsSafe,
  buildEmbedRows,
  type MediaEmbedTargetType,
} from "@/lib/mediaEmbeds";

const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// parseEmbedInput — iframe src extraction
// ---------------------------------------------------------------------------
describe("parseEmbedInput", () => {
  it("passes a plain URL through unchanged", () => {
    const result = parseEmbedInput("https://youtube.com/watch?v=abc123xyz");
    expect(result).toEqual({ url: "https://youtube.com/watch?v=abc123xyz" });
  });

  it("trims whitespace from a plain URL", () => {
    const result = parseEmbedInput("  https://youtube.com/watch?v=abc123xyz  ");
    expect(result).toEqual({ url: "https://youtube.com/watch?v=abc123xyz" });
  });

  it("returns error for empty input", () => {
    expect(parseEmbedInput("")).toEqual({ error: "Input is required." });
    expect(parseEmbedInput("   ")).toEqual({ error: "Input is required." });
  });

  it("rejects non-iframe HTML snippets", () => {
    const result = parseEmbedInput("<script>alert(1)</script>");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Only URLs or <iframe>");
  });

  it("extracts src from a YouTube iframe snippet", () => {
    const snippet = `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    const result = parseEmbedInput(snippet);
    expect(result).toEqual({ url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });

  it("extracts src from a Spotify iframe snippet", () => {
    const snippet = `<iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    const result = parseEmbedInput(snippet);
    expect(result).toEqual({ url: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC" });
  });

  it("extracts src from a Bandcamp iframe snippet", () => {
    const snippet = `<iframe style="border: 0; width: 100%; height: 120px;" src="https://bandcamp.com/EmbeddedPlayer/album=123456/size=large/bgcol=ffffff/linkcol=0687f5" seamless></iframe>`;
    const result = parseEmbedInput(snippet);
    expect(result).toEqual({ url: "https://bandcamp.com/EmbeddedPlayer/album=123456/size=large/bgcol=ffffff/linkcol=0687f5" });
  });

  it("rejects iframe with non-https src", () => {
    const snippet = `<iframe src="http://example.com/embed"></iframe>`;
    const result = parseEmbedInput(snippet);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Only https");
  });

  it("rejects iframe from disallowed host", () => {
    const snippet = `<iframe src="https://evil.com/embed/track"></iframe>`;
    const result = parseEmbedInput(snippet);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("not allowed");
  });

  it("rejects iframe with no src attribute", () => {
    const snippet = `<iframe width="560" height="315"></iframe>`;
    const result = parseEmbedInput(snippet);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Could not find src");
  });

  it("rejects iframe with javascript: src", () => {
    const snippet = `<iframe src="javascript:alert(1)"></iframe>`;
    const result = parseEmbedInput(snippet);
    expect(result).toHaveProperty("error");
    // May hit "not a valid URL" or "Only https" depending on parser
  });

  it("handles single-quoted src attribute", () => {
    const snippet = `<iframe src='https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'></iframe>`;
    const result = parseEmbedInput(snippet);
    expect(result).toEqual({ url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });
});

// ---------------------------------------------------------------------------
// classifyUrl — Bandcamp
// ---------------------------------------------------------------------------
describe("classifyUrl Bandcamp support", () => {
  it("classifies Bandcamp EmbeddedPlayer as bandcamp/audio", () => {
    const result = classifyUrl("https://bandcamp.com/EmbeddedPlayer/album=123456/size=large");
    expect(result.provider).toBe("bandcamp");
    expect(result.kind).toBe("audio");
    expect(result.embed_url).toBe("https://bandcamp.com/EmbeddedPlayer/album=123456/size=large");
  });

  it("classifies www.bandcamp.com EmbeddedPlayer as bandcamp", () => {
    const result = classifyUrl("https://www.bandcamp.com/EmbeddedPlayer/track=789");
    expect(result.provider).toBe("bandcamp");
    expect(result.kind).toBe("audio");
  });

  it("classifies non-embed bandcamp URL (artist page) as external", () => {
    const result = classifyUrl("https://bandcamp.com/artist/test-album");
    expect(result.provider).toBe("external");
    expect(result.kind).toBe("external");
    expect(result.embed_url).toBeNull();
  });

  it("classifies artist.bandcamp.com as external (not a subdomain we handle)", () => {
    const result = classifyUrl("https://artist.bandcamp.com/album/test");
    expect(result.provider).toBe("external");
    expect(result.kind).toBe("external");
  });
});

// ---------------------------------------------------------------------------
// buildEmbedRowsSafe — per-row error resilience
// ---------------------------------------------------------------------------
describe("buildEmbedRowsSafe per-row resilience", () => {
  const target = { type: "profile" as MediaEmbedTargetType, id: "user-1" };
  const createdBy = "user-1";

  it("returns errors for invalid rows without failing the batch", () => {
    const urls = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "not-a-url",
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    ];
    const result = buildEmbedRowsSafe(urls, target, createdBy);

    // Two valid rows
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].provider).toBe("youtube");
    expect(result.rows[0].position).toBe(0);
    expect(result.rows[1].provider).toBe("spotify");
    expect(result.rows[1].position).toBe(1);

    // One error
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
    expect(result.errors[0].url).toBe("not-a-url");
  });

  it("handles all-invalid inputs gracefully", () => {
    const urls = ["not-a-url", "also-invalid"];
    const result = buildEmbedRowsSafe(urls, target, createdBy);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });

  it("handles all-valid inputs with zero errors", () => {
    const urls = ["https://youtube.com/watch?v=abc123xyz"];
    const result = buildEmbedRowsSafe(urls, target, createdBy);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("skips empty strings without producing errors", () => {
    const urls = ["", "  ", "https://youtube.com/watch?v=abc123xyz", ""];
    const result = buildEmbedRowsSafe(urls, target, createdBy);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("handles iframe snippets mixed with URLs", () => {
    const urls = [
      `<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>`,
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      `<iframe src="https://bandcamp.com/EmbeddedPlayer/album=123456"></iframe>`,
    ];
    const result = buildEmbedRowsSafe(urls, target, createdBy);
    expect(result.rows).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].provider).toBe("youtube");
    expect(result.rows[1].provider).toBe("spotify");
    expect(result.rows[2].provider).toBe("bandcamp");
  });

  it("collects iframe extraction errors without failing valid rows", () => {
    const urls = [
      "https://youtube.com/watch?v=abc123xyz",
      `<iframe src="https://evil.com/bad"></iframe>`, // disallowed host
      `<script>alert(1)</script>`, // non-iframe HTML
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    ];
    const result = buildEmbedRowsSafe(urls, target, createdBy);
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].index).toBe(1);
    expect(result.errors[1].index).toBe(2);
  });

  it("backward-compatible buildEmbedRows still works (drops invalid rows silently)", () => {
    const urls = [
      "https://youtube.com/watch?v=abc123xyz",
      "not-a-url",
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    ];
    const rows = buildEmbedRows(urls, target, createdBy);
    // buildEmbedRows returns only valid rows, no errors property
    expect(rows).toHaveLength(2);
    expect(rows[0].provider).toBe("youtube");
    expect(rows[1].provider).toBe("spotify");
  });
});

// ---------------------------------------------------------------------------
// Page wiring: non-admin blog edit loads media embeds
// ---------------------------------------------------------------------------
describe("non-admin blog edit page loads media embeds", () => {
  it("imports readMediaEmbeds and passes mediaEmbedUrls to BlogPostForm", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/blog/[id]/edit/page.tsx"),
      "utf-8"
    );
    expect(source).toContain("readMediaEmbeds");
    expect(source).toContain("mediaEmbedUrls");
    expect(source).toContain("mediaEmbedUrls={mediaEmbedUrls}");
  });
});

// ---------------------------------------------------------------------------
// Page wiring: BlogPostForm shows MediaEmbedsEditor for all users
// ---------------------------------------------------------------------------
describe("BlogPostForm shows MediaEmbedsEditor for all users", () => {
  it("renders MediaEmbedsEditor without admin gate", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/admin/blog/BlogPostForm.tsx"),
      "utf-8"
    );
    expect(source).toContain("MediaEmbedsEditor");
    // Should NOT be wrapped in isAdmin check
    expect(source).not.toMatch(/\{isAdmin\s*&&[^}]*MediaEmbedsEditor/);
  });
});

// ---------------------------------------------------------------------------
// Page wiring: override page passes overrideRescheduledDate
// ---------------------------------------------------------------------------
describe("occurrence override date bug fix wiring", () => {
  it("override page extracts overrideRescheduledDate from overridePatch", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/page.tsx"),
      "utf-8"
    );
    expect(source).toContain("overrideRescheduledDate");
    expect(source).toContain("overridePatch?.event_date");
  });

  it("EventForm accepts overrideRescheduledDate prop and uses it for occurrenceDate init", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/my-events/_components/EventForm.tsx"),
      "utf-8"
    );
    expect(source).toContain("overrideRescheduledDate");
    // Should NOT use event.event_date !== occurrenceDateKey pattern
    expect(source).not.toContain("event.event_date !== occurrenceDateKey");
  });
});

// ---------------------------------------------------------------------------
// CSP wiring: bandcamp.com in frame-src
// ---------------------------------------------------------------------------
describe("CSP frame-src includes bandcamp", () => {
  it("next.config.ts frame-src includes bandcamp.com", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "../next.config.ts"),
      "utf-8"
    );
    expect(source).toContain("bandcamp.com");
  });
});

// ---------------------------------------------------------------------------
// OrderedMediaEmbeds Bandcamp rendering wiring
// ---------------------------------------------------------------------------
describe("OrderedMediaEmbeds Bandcamp rendering", () => {
  it("renders bandcamp provider with sandboxed iframe", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "components/media/OrderedMediaEmbeds.tsx"),
      "utf-8"
    );
    expect(source).toContain('embed.provider === "bandcamp"');
    expect(source).toContain("sandbox=");
    expect(source).toContain("allow-scripts");
    expect(source).toContain("Bandcamp player");
  });
});
