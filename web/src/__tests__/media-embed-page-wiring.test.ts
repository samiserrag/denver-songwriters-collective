import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

describe("media embed canonical page wiring", () => {
  it("wires events detail page to query and render media embed URLs", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/events/[id]/page.tsx"), "utf-8");
    expect(source).toContain("youtube_url");
    expect(source).toContain("spotify_url");
    // Phase 02B: ordered embeds with override-first fallback
    expect(source).toContain("OrderedMediaEmbeds");
    expect(source).toContain("readEventEmbedsWithFallback");
    // Scalar fallback still present for legacy data
    expect(source).toContain("MediaEmbedsSection");
  });

  it("wires blog detail page to query and render media embed URLs", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/blog/[slug]/page.tsx"), "utf-8");
    expect(source).toContain("youtube_url");
    expect(source).toContain("spotify_url");
    // Phase 02B: ordered embeds
    expect(source).toContain("OrderedMediaEmbeds");
    expect(source).toContain("readMediaEmbeds");
    // Scalar fallback still present for legacy data
    expect(source).toContain("MediaEmbedsSection");
  });

  it("wires gallery detail page to query and render media embed URLs", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/gallery/[slug]/page.tsx"), "utf-8");
    expect(source).toContain("youtube_url");
    expect(source).toContain("spotify_url");
    // Phase 02B: ordered embeds
    expect(source).toContain("OrderedMediaEmbeds");
    expect(source).toContain("readMediaEmbeds");
    // Scalar fallback still present for legacy data
    expect(source).toContain("MediaEmbedsSection");
  });
});

describe("media embed editor wiring", () => {
  it("wires EventForm to use MediaEmbedsEditor and send media_embed_urls", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/my-events/_components/EventForm.tsx"),
      "utf-8"
    );
    expect(source).toContain("MediaEmbedsEditor");
    expect(source).toContain("media_embed_urls");
    expect(source).toContain("mediaEmbedUrls");
  });

  it("wires BlogPostForm to use MediaEmbedsEditor and send media_embed_urls", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/admin/blog/BlogPostForm.tsx"),
      "utf-8"
    );
    expect(source).toContain("MediaEmbedsEditor");
    expect(source).toContain("media_embed_urls");
    expect(source).toContain("mediaEmbedUrls");
  });

  it("wires AlbumManager to use MediaEmbedsEditor and send media_embed_urls", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"),
      "utf-8"
    );
    expect(source).toContain("MediaEmbedsEditor");
    expect(source).toContain("media_embed_urls");
    expect(source).toContain("mediaEmbedUrls");
  });
});

describe("media embed API route wiring", () => {
  it("wires my-events POST to call upsertMediaEmbeds", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/my-events/route.ts"), "utf-8");
    expect(source).toContain("upsertMediaEmbeds");
    expect(source).toContain("media_embed_urls");
  });

  it("wires my-events PATCH to call upsertMediaEmbeds", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/my-events/[id]/route.ts"), "utf-8");
    expect(source).toContain("upsertMediaEmbeds");
    expect(source).toContain("media_embed_urls");
  });

  it("wires overrides POST to call upsertMediaEmbeds with event_override scope", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/api/my-events/[id]/overrides/route.ts"),
      "utf-8"
    );
    expect(source).toContain("upsertMediaEmbeds");
    expect(source).toContain("event_override");
    expect(source).toContain("media_embed_urls");
  });

  it("wires blog-posts POST to call upsertMediaEmbeds", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/blog-posts/route.ts"), "utf-8");
    expect(source).toContain("upsertMediaEmbeds");
    expect(source).toContain("blog_post");
    expect(source).toContain("media_embed_urls");
  });

  it("wires blog-posts PATCH to call upsertMediaEmbeds", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/api/admin/blog-posts/[id]/route.ts"), "utf-8");
    expect(source).toContain("upsertMediaEmbeds");
    expect(source).toContain("blog_post");
    expect(source).toContain("media_embed_urls");
  });

  it("wires gallery-albums PATCH to call upsertMediaEmbeds", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/api/admin/gallery-albums/[id]/route.ts"),
      "utf-8"
    );
    expect(source).toContain("upsertMediaEmbeds");
    expect(source).toContain("gallery_album");
    expect(source).toContain("media_embed_urls");
  });
});
