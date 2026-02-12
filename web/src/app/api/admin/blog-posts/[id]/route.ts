import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MediaEmbedValidationError, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";
import { upsertMediaEmbeds } from "@/lib/mediaEmbedsServer";

interface GalleryImageInput {
  image_url: string;
  caption?: string | null;
  sort_order?: number;
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { supabase, user };
}

function parseMediaUrls(body: Record<string, unknown>) {
  try {
    const youtube_url = normalizeMediaEmbedUrl(
      typeof body.youtube_url === "string" ? body.youtube_url : null,
      { expectedProvider: "youtube", field: "youtube_url" }
    )?.normalized_url ?? null;
    const spotify_url = normalizeMediaEmbedUrl(
      typeof body.spotify_url === "string" ? body.spotify_url : null,
      { expectedProvider: "spotify", field: "spotify_url" }
    )?.normalized_url ?? null;
    return { youtube_url, spotify_url };
  } catch (error) {
    if (error instanceof MediaEmbedValidationError && error.field) {
      return {
        error: NextResponse.json(
          { error: "Validation failed", fieldErrors: { [error.field]: error.message } },
          { status: 400 }
        ),
      };
    }
    return { error: NextResponse.json({ error: "Invalid media URL" }, { status: 400 }) };
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";

    if (!title) {
      return NextResponse.json({ error: "Validation failed", fieldErrors: { title: "Title is required." } }, { status: 400 });
    }
    if (!content.trim()) {
      return NextResponse.json(
        { error: "Validation failed", fieldErrors: { content: "Content is required." } },
        { status: 400 }
      );
    }

    const parsedMedia = parseMediaUrls(body);
    if ("error" in parsedMedia) return parsedMedia.error;

    const { data: existingPost, error: existingPostError } = await auth.supabase
      .from("blog_posts")
      .select("id, slug, is_published, published_at")
      .eq("id", id)
      .single();

    if (existingPostError || !existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];
    const isPublished = Boolean(body.is_published);

    const updatePayload: Record<string, unknown> = {
      title,
      slug: typeof body.slug === "string" ? body.slug.trim() : existingPost.slug,
      excerpt: typeof body.excerpt === "string" ? body.excerpt || null : null,
      content,
      cover_image_url: typeof body.cover_image_url === "string" ? body.cover_image_url || null : null,
      tags: tags.length > 0 ? tags : null,
      is_published: isPublished,
      updated_at: now,
      youtube_url: parsedMedia.youtube_url,
      spotify_url: parsedMedia.spotify_url,
    };

    if (isPublished && !existingPost.is_published) {
      updatePayload.published_at = now;
    }

    const { error: updateError } = await auth.supabase
      .from("blog_posts")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Upsert ordered media embeds
    if (Array.isArray(body.media_embed_urls)) {
      try {
        await upsertMediaEmbeds(
          auth.supabase,
          { type: "blog_post", id },
          body.media_embed_urls as string[],
          auth.user.id
        );
      } catch (err) {
        console.error("[PATCH /api/admin/blog-posts/[id]] Media embed upsert error:", err);
      }
    }

    const galleryImages = Array.isArray(body.gallery_images) ? (body.gallery_images as GalleryImageInput[]) : null;
    if (galleryImages) {
      const { error: deleteError } = await auth.supabase
        .from("blog_gallery_images")
        .delete()
        .eq("post_id", id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      if (galleryImages.length > 0) {
        const rows = galleryImages.map((img, index) => ({
          post_id: id,
          image_url: img.image_url,
          caption: img.caption || null,
          sort_order: typeof img.sort_order === "number" ? img.sort_order : index,
        }));
        const { error: insertError } = await auth.supabase.from("blog_gallery_images").insert(rows);
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ id });
  } catch (error) {
    console.error("PATCH /api/admin/blog-posts/[id] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
