/**
 * MEDIA-EMBED Bandcamp Atomic Upsert + Per-Row Render Resilience
 *
 * Covers:
 * 1. OrderedMediaEmbeds renders other rows even when one row is malformed
 * 2. Bandcamp provider with EmbeddedPlayer URL renders a sandboxed iframe
 * 3. A [bandcamp ...] shortcode string as URL does not crash other rows
 * 4. upsertMediaEmbeds calls the atomic RPC instead of separate delete+insert
 * 5. classifyUrl returns provider="bandcamp" (matching the expanded DB constraint)
 */
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OrderedMediaEmbeds } from "@/components/media/OrderedMediaEmbeds";
import { classifyUrl, buildEmbedRowsSafe, type MediaEmbedTargetType } from "@/lib/mediaEmbeds";

// ---------------------------------------------------------------------------
// 1. Per-row render resilience: malformed row does not block others
// ---------------------------------------------------------------------------
describe("OrderedMediaEmbeds per-row resilience", () => {
  it("renders YouTube and Spotify even when one row has an invalid URL", () => {
    const embeds = [
      { id: "1", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", provider: "youtube", kind: "video", position: 0 },
      { id: "2", url: "not-a-valid-url-at-all", provider: "external", kind: "external", position: 1 },
      { id: "3", url: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC", provider: "spotify", kind: "audio", position: 2 },
    ];

    const { container } = render(<OrderedMediaEmbeds embeds={embeds} />);
    const iframes = container.querySelectorAll("iframe");
    // YouTube and Spotify should render; the invalid row should be skipped
    expect(iframes.length).toBeGreaterThanOrEqual(2);
    const srcs = Array.from(iframes).map((f) => f.getAttribute("src"));
    expect(srcs.some((s) => s?.includes("youtube-nocookie.com"))).toBe(true);
    expect(srcs.some((s) => s?.includes("spotify.com"))).toBe(true);
  });

  it("renders YouTube when Bandcamp row has a garbage URL", () => {
    const embeds = [
      { id: "1", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", provider: "youtube", kind: "video", position: 0 },
      { id: "2", url: "[bandcamp album=12345]", provider: "bandcamp", kind: "audio", position: 1 },
    ];

    const { container } = render(<OrderedMediaEmbeds embeds={embeds} />);
    const iframes = container.querySelectorAll("iframe");
    // YouTube should still render even though the bandcamp row has a shortcode as URL
    expect(iframes.length).toBeGreaterThanOrEqual(1);
    expect(iframes[0].getAttribute("src")).toContain("youtube-nocookie.com");
  });

  it("renders nothing for a row with completely broken data without throwing", () => {
    const embeds = [
      // @ts-expect-error — deliberately passing malformed data to test resilience
      { id: "bad", url: null, provider: null, kind: null, position: 0 },
      { id: "2", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", provider: "youtube", kind: "video", position: 1 },
    ];

    // Should not throw
    const { container } = render(<OrderedMediaEmbeds embeds={embeds} />);
    const iframes = container.querySelectorAll("iframe");
    expect(iframes.length).toBeGreaterThanOrEqual(1);
    expect(iframes[0].getAttribute("src")).toContain("youtube-nocookie.com");
  });
});

// ---------------------------------------------------------------------------
// 2. Bandcamp renders as sandboxed iframe
// ---------------------------------------------------------------------------
describe("OrderedMediaEmbeds Bandcamp iframe rendering", () => {
  it("renders Bandcamp EmbeddedPlayer URL as a sandboxed iframe", () => {
    const embeds = [
      { id: "1", url: "https://bandcamp.com/EmbeddedPlayer/album=123456/size=large", provider: "bandcamp", kind: "audio", position: 0 },
    ];

    const { container } = render(<OrderedMediaEmbeds embeds={embeds} />);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toContain("bandcamp.com/EmbeddedPlayer");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-scripts");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(iframe?.getAttribute("title")).toBe("Bandcamp player");
  });
});

// ---------------------------------------------------------------------------
// 3. classifyUrl returns provider="bandcamp" for EmbeddedPlayer URLs
// ---------------------------------------------------------------------------
describe("classifyUrl Bandcamp provider value", () => {
  it("returns provider='bandcamp' (not 'external') for EmbeddedPlayer URLs", () => {
    const result = classifyUrl("https://bandcamp.com/EmbeddedPlayer/album=123456/size=large");
    expect(result.provider).toBe("bandcamp");
    expect(result.kind).toBe("audio");
  });
});

// ---------------------------------------------------------------------------
// 4. buildEmbedRowsSafe produces bandcamp provider rows
// ---------------------------------------------------------------------------
describe("buildEmbedRowsSafe bandcamp rows", () => {
  const target = { type: "event" as MediaEmbedTargetType, id: "event-1" };

  it("builds a bandcamp row with provider='bandcamp' from EmbeddedPlayer URL", () => {
    const urls = ["https://bandcamp.com/EmbeddedPlayer/album=123456/size=large"];
    const result = buildEmbedRowsSafe(urls, target, "user-1");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].provider).toBe("bandcamp");
    expect(result.rows[0].kind).toBe("audio");
    expect(result.errors).toHaveLength(0);
  });

  it("builds bandcamp row alongside youtube and spotify without errors", () => {
    const urls = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://bandcamp.com/EmbeddedPlayer/album=123456/size=large",
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    ];
    const result = buildEmbedRowsSafe(urls, target, "user-1");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].provider).toBe("youtube");
    expect(result.rows[1].provider).toBe("bandcamp");
    expect(result.rows[2].provider).toBe("spotify");
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Atomic upsert: upsertMediaEmbeds calls RPC
// ---------------------------------------------------------------------------
describe("upsertMediaEmbeds uses atomic RPC", () => {
  it("calls supabase.rpc('upsert_media_embeds') instead of separate delete+insert", async () => {
    const { upsertMediaEmbeds } = await import("@/lib/mediaEmbedsServer");

    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSupabase = {
      rpc: mockRpc,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await upsertMediaEmbeds(
      mockSupabase,
      { type: "event", id: "event-1" },
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith("upsert_media_embeds", {
      p_target_type: "event",
      p_target_id: "event-1",
      p_date_key: null,
      p_rows: expect.arrayContaining([
        expect.objectContaining({
          provider: "youtube",
          url: expect.stringContaining("youtube.com"),
        }),
      ]),
    });
  });

  it("does not call .from().delete() or .from().insert()", async () => {
    const { upsertMediaEmbeds } = await import("@/lib/mediaEmbedsServer");

    const mockFrom = vi.fn();
    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSupabase = {
      from: mockFrom,
      rpc: mockRpc,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await upsertMediaEmbeds(
      mockSupabase,
      { type: "event", id: "event-1" },
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
      "user-1"
    );

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("passes date_key for event_override scope", async () => {
    const { upsertMediaEmbeds } = await import("@/lib/mediaEmbedsServer");

    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSupabase = {
      rpc: mockRpc,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await upsertMediaEmbeds(
      mockSupabase,
      { type: "event_override", id: "event-1", date_key: "2026-02-19" },
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
      "user-1"
    );

    expect(mockRpc).toHaveBeenCalledWith("upsert_media_embeds", expect.objectContaining({
      p_target_type: "event_override",
      p_date_key: "2026-02-19",
    }));
  });

  it("throws on RPC error", async () => {
    const { upsertMediaEmbeds } = await import("@/lib/mediaEmbedsServer");

    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "constraint violation" },
    });
    const mockSupabase = {
      rpc: mockRpc,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await expect(
      upsertMediaEmbeds(
        mockSupabase,
        { type: "event", id: "event-1" },
        ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
        "user-1"
      )
    ).rejects.toThrow("Failed to upsert embeds: constraint violation");
  });
});

// ---------------------------------------------------------------------------
// 6. Migration wiring: provider CHECK includes 'bandcamp'
// ---------------------------------------------------------------------------
describe("migration: provider CHECK includes bandcamp", () => {
  it("migration file expands provider constraint to include bandcamp", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../..", "supabase/migrations/20260213000000_media_embeds_bandcamp_atomic_upsert.sql"),
      "utf-8"
    );
    expect(source).toContain("'bandcamp'");
    expect(source).toContain("media_embeds_provider_check");
    expect(source).toContain("upsert_media_embeds");
    expect(source).toContain("SECURITY INVOKER");
  });
});
