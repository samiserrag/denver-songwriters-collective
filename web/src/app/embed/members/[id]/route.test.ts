import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

let embedsEnabled = true;
let mockMember: {
  id: string;
  slug: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  is_songwriter: boolean | null;
  is_host: boolean | null;
  is_studio: boolean | null;
  is_fan: boolean | null;
  is_public: boolean;
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
      if (table !== "profiles") throw new Error(`Unexpected table: ${table}`);
      const filters: Record<string, string | boolean> = {};
      const chain = {
        eq: (column: string, value: string | boolean) => {
          filters[column] = value;
          return chain;
        },
        single: async () => {
          if (!mockMember) return { data: null, error: new Error("not found") };
          if (filters.is_public !== true) return { data: null, error: new Error("forbidden") };
          if (filters.id && filters.id === mockMember.id) return { data: mockMember, error: null };
          if (filters.slug && filters.slug === mockMember.slug) return { data: mockMember, error: null };
          return { data: null, error: new Error("not found") };
        },
      };
      return { select: () => chain };
    },
  }),
}));

describe("GET /embed/members/[id]", () => {
  beforeEach(() => {
    embedsEnabled = true;
    mockMember = {
      id: "member-1",
      slug: "pony-lee",
      full_name: "Pony Lee",
      bio: "Denver songwriter and host.",
      avatar_url: null,
      city: "Denver",
      instruments: ["Guitar"],
      genres: ["Folk"],
      is_songwriter: true,
      is_host: true,
      is_studio: false,
      is_fan: false,
      is_public: true,
    };
  });

  it("returns 503 when kill switch is OFF", async () => {
    embedsEnabled = false;
    const res = await GET(new Request("http://localhost/embed/members/pony-lee"), {
      params: Promise.resolve({ id: "pony-lee" }),
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 for a valid public member", async () => {
    const res = await GET(new Request("http://localhost/embed/members/pony-lee"), {
      params: Promise.resolve({ id: "pony-lee" }),
    });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Pony Lee");
    expect(html).toContain("View on The Colorado Songwriters Collective");
  });

  it("returns 404 when member fails visibility gate", async () => {
    mockMember = null;
    const res = await GET(new Request("http://localhost/embed/members/private-user"), {
      params: Promise.resolve({ id: "private-user" }),
    });
    expect(res.status).toBe(404);
  });

  it("falls back to default query parsing on invalid values", async () => {
    const res = await GET(
      new Request("http://localhost/embed/members/pony-lee?theme=bad&view=tiny&show=none"),
      { params: Promise.resolve({ id: "pony-lee" }) }
    );
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('data-theme="auto"');
    expect(html).toContain('<div class="chips">');
    expect(html).toContain("View on The Colorado Songwriters Collective");
  });
});
