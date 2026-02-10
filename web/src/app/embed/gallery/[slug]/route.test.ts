import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

let embedsEnabled = true;
let mockAlbum: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
} | null = null;
let mockImageCount = 0;
let mockStripImages: Array<{ image_url: string }> = [];

vi.mock("@/lib/featureFlags", () => ({
  isExternalEmbedsEnabled: () => embedsEnabled,
}));

vi.mock("@/lib/siteUrl", () => ({
  getSiteUrl: () => "https://coloradosongwriterscollective.org",
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      if (table === "gallery_albums") {
        const filters: Record<string, string | boolean> = {};
        const chain = {
          eq: (column: string, value: string | boolean) => {
            filters[column] = value;
            return chain;
          },
          single: async () => {
            if (!mockAlbum) return { data: null, error: new Error("not found") };
            const gateOk = filters.is_published === true && filters.is_hidden === false;
            if (!gateOk) return { data: null, error: new Error("forbidden") };
            if (filters.slug === mockAlbum.slug) return { data: mockAlbum, error: null };
            return { data: null, error: new Error("not found") };
          },
        };
        return { select: () => chain };
      }

      if (table === "gallery_images") {
        return {
          select: (_columns: string, options?: { count?: "exact"; head?: boolean }) => {
            const isCountMode = options?.count === "exact" && options?.head === true;
            const chain: any = {
              eq: () => chain,
              order: () => chain,
              limit: () => chain,
              then: (resolve: (value: unknown) => unknown) => {
                if (isCountMode) {
                  return Promise.resolve(resolve({ count: mockImageCount, error: null }));
                }
                return Promise.resolve(resolve({ data: mockStripImages, error: null }));
              },
            };
            return chain;
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

describe("GET /embed/gallery/[slug]", () => {
  beforeEach(() => {
    embedsEnabled = true;
    mockAlbum = {
      id: "album-1",
      slug: "open-mic-jan",
      name: "Open Mic January",
      description: "Photos from our January open mic.",
      cover_image_url: null,
      created_at: "2026-02-10T00:00:00.000Z",
    };
    mockImageCount = 5;
    mockStripImages = [{ image_url: "https://example.com/photo-1.jpg" }];
  });

  it("returns 503 when kill switch is OFF", async () => {
    embedsEnabled = false;
    const res = await GET(new Request("http://localhost/embed/gallery/open-mic-jan"), {
      params: Promise.resolve({ slug: "open-mic-jan" }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 for a valid published album", async () => {
    const res = await GET(new Request("http://localhost/embed/gallery/open-mic-jan"), {
      params: Promise.resolve({ slug: "open-mic-jan" }),
    });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Open Mic January");
    expect(html).toContain("View on The Colorado Songwriters Collective");
  });

  it("returns 404 when visibility gate fails", async () => {
    mockAlbum = null;
    const res = await GET(new Request("http://localhost/embed/gallery/hidden"), {
      params: Promise.resolve({ slug: "hidden" }),
    });
    expect(res.status).toBe(404);
  });

  it("falls back to default query parsing on invalid values", async () => {
    const res = await GET(
      new Request("http://localhost/embed/gallery/open-mic-jan?theme=nope&view=unknown&show=wrong"),
      { params: Promise.resolve({ slug: "open-mic-jan" }) }
    );
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('data-theme="auto"');
    expect(html).toContain('<div class="chips">');
    expect(html).toContain("View on The Colorado Songwriters Collective");
  });
});
