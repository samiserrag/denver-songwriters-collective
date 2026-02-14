/**
 * MEDIA-EMBED Bandcamp Paste Resilience — Patches A+B+C
 *
 * Covers:
 *  A) onPaste interception (iframe and shortcode detection)
 *  B) Bandcamp [bandcamp ...] shortcode parser in parseEmbedInput
 *  C) Error-path fallback resolved to "" instead of garbage rawInput
 */
import { describe, it, expect } from "vitest";
import { parseEmbedInput } from "@/lib/mediaEmbeds";

// ---------------------------------------------------------------------------
// Patch B: Bandcamp shortcode parser
// ---------------------------------------------------------------------------
describe("parseEmbedInput — Bandcamp shortcode", () => {
  it("parses minimal [bandcamp album=N] shortcode", () => {
    const result = parseEmbedInput("[bandcamp album=123456789]");
    expect(result).toEqual({
      url: "https://bandcamp.com/EmbeddedPlayer/album=123456789/size=large/tracklist=false/artwork=small/transparent=true/",
    });
  });

  it("parses shortcode with all common WordPress params", () => {
    const result = parseEmbedInput(
      '[bandcamp width=100% height=120 album=2345678901 size=large bgcol=ffffff linkcol=0687f5 tracklist=false artwork=small transparent=true]'
    );
    expect(result).toHaveProperty("url");
    const url = (result as { url: string }).url;
    expect(url).toContain("album=2345678901");
    expect(url.startsWith("https://bandcamp.com/EmbeddedPlayer/")).toBe(true);
  });

  it("returns error-free result (no 'error' key) for valid shortcode", () => {
    const result = parseEmbedInput("[bandcamp width=350 height=470 album=999]");
    expect("error" in result).toBe(false);
    expect("url" in result).toBe(true);
  });

  it("does NOT match shortcode missing album= param", () => {
    // Without album=, the regex won't match; falls through to plain URL handling
    const result = parseEmbedInput("[bandcamp width=100% height=120]");
    // Should NOT produce a valid embed URL; will be treated as plain text
    // (which isn't a valid URL, but that's fine — classifyUrl will catch it later)
    expect("url" in result).toBe(true);
    const url = (result as { url: string }).url;
    expect(url).not.toContain("EmbeddedPlayer");
  });

  it("does NOT match unrelated shortcodes", () => {
    const result = parseEmbedInput("[youtube id=abc123]");
    expect("url" in result).toBe(true);
    // Treated as plain text, not a bandcamp shortcode
    expect((result as { url: string }).url).toBe("[youtube id=abc123]");
  });

  it("is case-insensitive for the shortcode tag", () => {
    const result = parseEmbedInput("[BANDCAMP album=555]");
    expect("url" in result).toBe(true);
    expect((result as { url: string }).url).toContain("album=555");
  });
});

// ---------------------------------------------------------------------------
// Patch A: onPaste detection logic (unit-testable predicate)
// ---------------------------------------------------------------------------
describe("onPaste interception triggers", () => {
  // The onPaste handler calls e.preventDefault() + handleUrlChange when the
  // pasted text contains "<iframe" or "[bandcamp". We test the detection logic.
  function shouldIntercept(text: string): boolean {
    return Boolean(text && (text.includes("<iframe") || text.includes("[bandcamp")));
  }

  it("intercepts Bandcamp iframe paste", () => {
    const text = `<iframe src="https://bandcamp.com/EmbeddedPlayer/album=123"></iframe>`;
    expect(shouldIntercept(text)).toBe(true);
  });

  it("intercepts Bandcamp shortcode paste", () => {
    expect(shouldIntercept("[bandcamp album=123]")).toBe(true);
  });

  it("intercepts YouTube iframe paste", () => {
    const text = `<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>`;
    expect(shouldIntercept(text)).toBe(true);
  });

  it("does NOT intercept plain URL paste", () => {
    expect(shouldIntercept("https://youtube.com/watch?v=abc123")).toBe(false);
  });

  it("does NOT intercept empty paste", () => {
    expect(shouldIntercept("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Patch C: Error path does not store garbage in URL field
// ---------------------------------------------------------------------------
describe("parseEmbedInput — error path fallback", () => {
  it("returns error (not garbage URL) for non-iframe HTML", () => {
    const result = parseEmbedInput("<div>not an iframe</div>");
    expect("error" in result).toBe(true);
    // The key assertion: 'url' should NOT be present with garbage
    expect("url" in result).toBe(false);
  });

  it("returns error for iframe from disallowed host", () => {
    const result = parseEmbedInput(
      `<iframe src="https://evil.com/embed"></iframe>`
    );
    expect("error" in result).toBe(true);
    expect("url" in result).toBe(false);
  });

  it("returns error for iframe with non-https src", () => {
    const result = parseEmbedInput(
      `<iframe src="http://bandcamp.com/EmbeddedPlayer/album=1"></iframe>`
    );
    expect("error" in result).toBe(true);
    expect("url" in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: shortcode → classifyUrl pipeline
// ---------------------------------------------------------------------------
describe("shortcode → classifyUrl pipeline", () => {
  it("shortcode output is classified as bandcamp/audio by classifyUrl", async () => {
    const { classifyUrl } = await import("@/lib/mediaEmbeds");
    const parsed = parseEmbedInput("[bandcamp album=987654]");
    expect("url" in parsed).toBe(true);
    const classified = classifyUrl((parsed as { url: string }).url);
    expect(classified.provider).toBe("bandcamp");
    expect(classified.kind).toBe("audio");
    expect(classified.embed_url).toContain("EmbeddedPlayer");
  });
});

// ---------------------------------------------------------------------------
// Wiring: MediaEmbedsEditor uses type="text" and onPaste
// ---------------------------------------------------------------------------
describe("MediaEmbedsEditor wiring", () => {
  it('uses type="text" inputMode="url" instead of type="url"', async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../components/media/MediaEmbedsEditor.tsx"),
      "utf-8"
    );
    // Patch A: type="text" + inputMode="url"
    expect(source).toContain('type="text"');
    expect(source).toContain('inputMode="url"');
    expect(source).not.toContain('type="url"');
  });

  it("has onPaste handler that intercepts iframe and shortcode content", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../components/media/MediaEmbedsEditor.tsx"),
      "utf-8"
    );
    expect(source).toContain("onPaste");
    expect(source).toContain("<iframe");
    expect(source).toContain("[bandcamp");
    expect(source).toContain("e.preventDefault()");
    expect(source).toContain("clipboardData");
  });

  it('error path resolves to "" not rawInput', async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../components/media/MediaEmbedsEditor.tsx"),
      "utf-8"
    );
    // Patch C: error fallback is "" not rawInput
    expect(source).toContain('"url" in parsed ? parsed.url : ""');
    expect(source).not.toContain('"url" in parsed ? parsed.url : rawInput');
  });
});
