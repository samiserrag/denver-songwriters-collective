import { beforeEach, describe, expect, it, vi } from "vitest";

let capturedBlogUpdate: Record<string, unknown> | null = null;
let capturedGalleryUpdate: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "admin-user-id" } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { role: "admin" }, error: null }),
            }),
          }),
        };
      }

      if (table === "blog_posts") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "post-1", slug: "post-1", is_published: true, published_at: null },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            capturedBlogUpdate = payload;
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "gallery_albums") {
        return {
          update: (payload: Record<string, unknown>) => {
            capturedGalleryUpdate = payload;
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "blog_gallery_images") {
        return {
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
          insert: async () => ({ error: null }),
        };
      }

      if (table === "media_embeds") {
        return {
          delete: () => ({
            eq: () => ({
              eq: () => ({
                is: async () => ({ error: null }),
              }),
              is: async () => ({ error: null }),
            }),
          }),
          insert: () => ({
            select: async () => ({ data: [], error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

// Mock upsertMediaEmbeds to prevent real DB calls
vi.mock("@/lib/mediaEmbedsServer", () => ({
  upsertMediaEmbeds: vi.fn().mockResolvedValue([]),
}));

import { PATCH as patchBlogPost } from "@/app/api/admin/blog-posts/[id]/route";
import { PATCH as patchGalleryAlbum } from "@/app/api/admin/gallery-albums/[id]/route";

describe("media embed clear semantics", () => {
  beforeEach(() => {
    capturedBlogUpdate = null;
    capturedGalleryUpdate = null;
  });

  it("stores null media fields when admin clears blog embed URLs", async () => {
    const response = await patchBlogPost(
      new Request("http://localhost/api/admin/blog-posts/post-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated title",
          slug: "updated-title",
          content: "Updated content",
          youtube_url: " ",
          spotify_url: "",
        }),
      }),
      { params: Promise.resolve({ id: "post-1" }) }
    );

    expect(response.status).toBe(200);
    expect(capturedBlogUpdate).toMatchObject({
      youtube_url: null,
      spotify_url: null,
    });
  });

  it("stores null media fields when admin clears gallery embed URLs", async () => {
    const response = await patchGalleryAlbum(
      new Request("http://localhost/api/admin/gallery-albums/album-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Album",
          slug: "album",
          description: "Album description",
          youtube_url: "",
          spotify_url: "   ",
        }),
      }),
      { params: Promise.resolve({ id: "album-1" }) }
    );

    expect(response.status).toBe(200);
    expect(capturedGalleryUpdate).toMatchObject({
      youtube_url: null,
      spotify_url: null,
    });
  });
});
