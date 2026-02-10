import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

let embedsEnabled = true;
let mockPost: {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
} | null = null;

vi.mock("@/lib/featureFlags", () => ({
  isExternalEmbedsEnabled: () => embedsEnabled,
}));

vi.mock("@/lib/siteUrl", () => ({
  getSiteUrl: () => "https://coloradosongwriterscollective.org",
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      if (table !== "blog_posts") throw new Error(`Unexpected table: ${table}`);
      const filters: Record<string, string | boolean> = {};
      const chain = {
        eq: (column: string, value: string | boolean) => {
          filters[column] = value;
          return chain;
        },
        single: async () => {
          if (!mockPost) return { data: null, error: new Error("not found") };
          const publishedOk = filters.is_published === true && filters.is_approved === true;
          if (!publishedOk) return { data: null, error: new Error("forbidden") };
          if (filters.slug === mockPost.slug) return { data: mockPost, error: null };
          return { data: null, error: new Error("not found") };
        },
      };
      return { select: () => chain };
    },
  }),
}));

describe("GET /embed/blog/[slug]", () => {
  beforeEach(() => {
    embedsEnabled = true;
    mockPost = {
      id: "post-1",
      slug: "welcome-to-csc",
      title: "Welcome to CSC",
      excerpt: "A quick update from the collective.",
      cover_image_url: null,
      published_at: "2026-02-10T00:00:00.000Z",
    };
  });

  it("returns 503 when kill switch is OFF", async () => {
    embedsEnabled = false;
    const res = await GET(new Request("http://localhost/embed/blog/welcome-to-csc"), {
      params: Promise.resolve({ slug: "welcome-to-csc" }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 for a valid published+approved post", async () => {
    const res = await GET(new Request("http://localhost/embed/blog/welcome-to-csc"), {
      params: Promise.resolve({ slug: "welcome-to-csc" }),
    });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Welcome to CSC");
    expect(html).toContain("Read on The Colorado Songwriters Collective");
  });

  it("returns 404 when publication gate fails", async () => {
    mockPost = null;
    const res = await GET(new Request("http://localhost/embed/blog/private-draft"), {
      params: Promise.resolve({ slug: "private-draft" }),
    });
    expect(res.status).toBe(404);
  });

  it("falls back to default query parsing on invalid values", async () => {
    const res = await GET(
      new Request("http://localhost/embed/blog/welcome-to-csc?theme=unknown&view=wide&show=invalid"),
      { params: Promise.resolve({ slug: "welcome-to-csc" }) }
    );
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('data-theme="auto"');
    expect(html).toContain('<div class="chips">');
    expect(html).toContain("Read on The Colorado Songwriters Collective");
  });
});
