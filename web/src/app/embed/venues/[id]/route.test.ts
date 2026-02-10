import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

let embedsEnabled = true;
let mockVenue: {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  neighborhood: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  google_maps_url: string | null;
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
      if (table !== "venues") throw new Error(`Unexpected table: ${table}`);
      const filters: Record<string, string> = {};
      const chain = {
        eq: (column: string, value: string) => {
          filters[column] = value;
          return chain;
        },
        single: async () => {
          if (!mockVenue) return { data: null, error: new Error("not found") };
          if (filters.id && filters.id === mockVenue.id) return { data: mockVenue, error: null };
          if (filters.slug && filters.slug === mockVenue.slug) return { data: mockVenue, error: null };
          return { data: null, error: new Error("not found") };
        },
      };
      return { select: () => chain };
    },
  }),
}));

describe("GET /embed/venues/[id]", () => {
  beforeEach(() => {
    embedsEnabled = true;
    mockVenue = {
      id: "venue-1",
      slug: "mercury-cafe",
      name: "Mercury Cafe",
      city: "Denver",
      state: "CO",
      neighborhood: "Five Points",
      cover_image_url: null,
      website_url: "https://mercurycafe.com",
      google_maps_url: "https://maps.google.com/venue-1",
    };
  });

  it("returns 503 when kill switch is OFF", async () => {
    embedsEnabled = false;
    const res = await GET(new Request("http://localhost/embed/venues/venue-1"), {
      params: Promise.resolve({ id: "venue-1" }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 for a valid venue", async () => {
    const res = await GET(new Request("http://localhost/embed/venues/mercury-cafe"), {
      params: Promise.resolve({ id: "mercury-cafe" }),
    });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Mercury Cafe");
    expect(html).toContain("View on The Colorado Songwriters Collective");
  });

  it("returns 404 when venue is missing", async () => {
    mockVenue = null;
    const res = await GET(new Request("http://localhost/embed/venues/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("falls back to default query parsing on invalid values", async () => {
    const res = await GET(
      new Request("http://localhost/embed/venues/mercury-cafe?theme=weird&view=wide&show=wat"),
      { params: Promise.resolve({ id: "mercury-cafe" }) }
    );
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('data-theme="auto"');
    expect(html).toContain("View on The Colorado Songwriters Collective");
    expect(html).toContain('<div class="chips">');
  });
});
