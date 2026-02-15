import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock state ──
let mockUser: { id: string; app_metadata?: { role?: string } } | null = null;
let mockCollabLink: { album_id: string } | null = null;
let mockUpdatedAlbum: Record<string, unknown> | null = null;
let mockUpdateError: { message: string } | null = null;

// Mock Supabase auth client
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
      }),
    },
    from: (table: string) => {
      if (table === "gallery_album_links") {
        return {
          select: () => ({
            eq: (_col: string, _val: string) => ({
              eq: (_col2: string, _val2: string) => ({
                eq: (_col3: string, _val3: string) => ({
                  eq: (_col4: string, _val4: string) => ({
                    maybeSingle: () => ({
                      data: mockCollabLink,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

// Mock service role client
vi.mock("@/lib/supabase/serviceRoleClient", () => ({
  getServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "gallery_albums") {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => ({
                  data: mockUpdatedAlbum,
                  error: mockUpdateError,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

const ALBUM_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

async function callRoute(body: unknown) {
  const { POST } = await import("./route");
  const request = new Request("http://localhost/api/gallery-albums/" + ALBUM_ID + "/collaborator-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id: ALBUM_ID }) });
}

beforeEach(() => {
  mockUser = null;
  mockCollabLink = null;
  mockUpdatedAlbum = { id: ALBUM_ID, name: "Test", slug: "test", description: "Updated", cover_image_url: null, youtube_url: null, spotify_url: null };
  mockUpdateError = null;
});

describe("POST /api/gallery-albums/[id]/collaborator-edit", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await callRoute({ description: "test" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid album ID", async () => {
    mockUser = { id: "user-1" };
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/gallery-albums/bad-id/collaborator-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "test" }),
    });
    const res = await POST(request, { params: Promise.resolve({ id: "bad-id" }) });
    expect(res.status).toBe(400);
  });

  it("returns 403 when sending disallowed fields", async () => {
    mockUser = { id: "user-1" };
    mockCollabLink = { album_id: ALBUM_ID };
    const res = await callRoute({ name: "hacked", is_published: true });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("name");
    expect(data.error).toContain("is_published");
  });

  it("rejects cover_image_url (owner/admin only)", async () => {
    mockUser = { id: "user-1" };
    mockCollabLink = { album_id: ALBUM_ID };
    const res = await callRoute({ cover_image_url: "https://example.com/img.jpg" });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("cover_image_url");
  });

  it("returns 400 when body is empty", async () => {
    mockUser = { id: "user-1" };
    const res = await callRoute({});
    // No allowed fields → 400
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not a collaborator", async () => {
    mockUser = { id: "user-1" };
    mockCollabLink = null;
    const res = await callRoute({ description: "test" });
    expect(res.status).toBe(403);
  });

  it("allows accepted collaborator to update description", async () => {
    mockUser = { id: "user-1" };
    mockCollabLink = { album_id: ALBUM_ID };
    const res = await callRoute({ description: "New description" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("allows admin to update without being collaborator", async () => {
    mockUser = { id: "admin-1", app_metadata: { role: "admin" } };
    mockCollabLink = null; // not a collaborator
    const res = await callRoute({ youtube_url: "https://youtube.com/test" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("allows multiple allowed fields in single request", async () => {
    mockUser = { id: "user-1" };
    mockCollabLink = { album_id: ALBUM_ID };
    const res = await callRoute({
      description: "Updated",
      youtube_url: "https://youtube.com/v",
      spotify_url: "https://spotify.com/s",
    });
    expect(res.status).toBe(200);
  });

  it("rejects mix of allowed and disallowed fields", async () => {
    mockUser = { id: "user-1" };
    mockCollabLink = { album_id: ALBUM_ID };
    const res = await callRoute({
      description: "ok",
      name: "not-ok",
    });
    expect(res.status).toBe(403);
  });
});
