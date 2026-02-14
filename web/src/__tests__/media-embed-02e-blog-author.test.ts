import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Wiring tests — source-level checks
// ---------------------------------------------------------------------------
describe("MEDIA-EMBED-02E: wiring", () => {
  it("non-admin blog media-embeds API route calls upsertMediaEmbeds with blog_post scope", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/api/blog-posts/[id]/media-embeds/route.ts"),
      "utf-8"
    );
    expect(source).toContain("upsertMediaEmbeds");
    expect(source).toContain("blog_post");
    expect(source).toContain("media_embed_urls");
  });

  it("non-admin blog form calls /api/blog-posts/{id}/media-embeds on save", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/admin/blog/BlogPostForm.tsx"),
      "utf-8"
    );
    expect(source).toContain("/api/blog-posts/");
    expect(source).toContain("/media-embeds");
    expect(source).toContain("media_embed_urls");
  });

  it("non-admin edit page loads existing embeds via readMediaEmbeds", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/blog/[id]/edit/page.tsx"),
      "utf-8"
    );
    expect(source).toContain("readMediaEmbeds");
    expect(source).toContain("blog_post");
    expect(source).toContain("mediaEmbedUrls");
  });
});

// ---------------------------------------------------------------------------
// 2. Migration assertion — RLS policy file
// ---------------------------------------------------------------------------
describe("MEDIA-EMBED-02E: migration", () => {
  it("migration file creates media_embeds_author_manage_blog policy", () => {
    const migrationsDir = path.resolve(__dirname, "../../../supabase/migrations");
    const files = fs.readdirSync(migrationsDir);
    const migrationFile = files.find((f) => f.includes("media_embeds_blog_author_manage"));
    expect(migrationFile).toBeDefined();

    const sql = fs.readFileSync(path.join(migrationsDir, migrationFile!), "utf-8");
    expect(sql).toContain("CREATE POLICY media_embeds_author_manage_blog");
    expect(sql).toContain("target_type = 'blog_post'");
    expect(sql).toContain("bp.author_id = auth.uid()");
    expect(sql).toContain("FOR ALL TO authenticated");
    // Must NOT broaden public read or change anon grants
    expect(sql).not.toContain("TO anon");
    expect(sql).not.toContain("GRANT");
  });
});

// ---------------------------------------------------------------------------
// 3. Behavioral tests — API route handler
// ---------------------------------------------------------------------------

// Track calls to upsertMediaEmbeds
const mockUpsertMediaEmbeds = vi.fn().mockResolvedValue({ data: [], errors: [] });

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => mockSupabase,
}));

vi.mock("@/lib/auth/adminAuth", () => ({
  checkAdminRole: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/mediaEmbedsServer", () => ({
  upsertMediaEmbeds: (...args: unknown[]) => mockUpsertMediaEmbeds(...args),
}));

let mockUser: { id: string } | null = null;
let mockPost: { id: string; author_id: string } | null = null;

const mockSupabase = {
  auth: {
    getUser: async () => ({
      data: { user: mockUser },
      error: mockUser ? null : { message: "Not authenticated" },
    }),
  },
  from: (table: string) => {
    if (table === "blog_posts") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: mockPost,
              error: mockPost ? null : { message: "Not found" },
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  },
};

import { POST } from "@/app/api/blog-posts/[id]/media-embeds/route";

describe("MEDIA-EMBED-02E: API route behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockPost = null;
  });

  it("returns 401 when not authenticated", async () => {
    mockUser = null;
    const res = await POST(
      new Request("http://localhost/api/blog-posts/post-1/media-embeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_embed_urls: [] }),
      }),
      { params: Promise.resolve({ id: "post-1" }) }
    );
    expect(res.status).toBe(401);
    expect(mockUpsertMediaEmbeds).not.toHaveBeenCalled();
  });

  it("returns 404 when blog post does not exist", async () => {
    mockUser = { id: "user-1" };
    mockPost = null;
    const res = await POST(
      new Request("http://localhost/api/blog-posts/nonexistent/media-embeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_embed_urls: [] }),
      }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
    expect(mockUpsertMediaEmbeds).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not post author and not admin", async () => {
    mockUser = { id: "other-user" };
    mockPost = { id: "post-1", author_id: "author-user" };
    const res = await POST(
      new Request("http://localhost/api/blog-posts/post-1/media-embeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_embed_urls: ["https://youtube.com/watch?v=abc"] }),
      }),
      { params: Promise.resolve({ id: "post-1" }) }
    );
    expect(res.status).toBe(403);
    expect(mockUpsertMediaEmbeds).not.toHaveBeenCalled();
  });

  it("author can upsert embeds on their own blog post", async () => {
    mockUser = { id: "author-user" };
    mockPost = { id: "post-1", author_id: "author-user" };
    const urls = ["https://youtube.com/watch?v=abc", "https://open.spotify.com/track/xyz"];
    const res = await POST(
      new Request("http://localhost/api/blog-posts/post-1/media-embeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_embed_urls: urls }),
      }),
      { params: Promise.resolve({ id: "post-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockUpsertMediaEmbeds).toHaveBeenCalledOnce();
    expect(mockUpsertMediaEmbeds).toHaveBeenCalledWith(
      expect.anything(),
      { type: "blog_post", id: "post-1" },
      urls,
      "author-user"
    );
  });

  it("empty array clears all embeds (atomic via RPC)", async () => {
    mockUser = { id: "author-user" };
    mockPost = { id: "post-1", author_id: "author-user" };
    const res = await POST(
      new Request("http://localhost/api/blog-posts/post-1/media-embeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_embed_urls: [] }),
      }),
      { params: Promise.resolve({ id: "post-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockUpsertMediaEmbeds).toHaveBeenCalledWith(
      expect.anything(),
      { type: "blog_post", id: "post-1" },
      [],
      "author-user"
    );
  });

  it("treats missing media_embed_urls as empty array", async () => {
    mockUser = { id: "author-user" };
    mockPost = { id: "post-1", author_id: "author-user" };
    const res = await POST(
      new Request("http://localhost/api/blog-posts/post-1/media-embeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "post-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockUpsertMediaEmbeds).toHaveBeenCalledWith(
      expect.anything(),
      { type: "blog_post", id: "post-1" },
      [],
      "author-user"
    );
  });
});
