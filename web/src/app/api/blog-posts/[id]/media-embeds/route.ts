import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { upsertMediaEmbeds } from "@/lib/mediaEmbedsServer";

/**
 * POST /api/blog-posts/[id]/media-embeds
 *
 * Upserts ordered media embeds for a blog post.
 * Requires authenticated user who is either the post author or an admin.
 * Empty array clears all embeds for the post (atomic via RPC).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Load blog post and verify ownership or admin
  const { data: post, error: postError } = await supabase
    .from("blog_posts")
    .select("id, author_id")
    .eq("id", postId)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
  }

  const isOwner = post.author_id === user.id;
  const isAdmin = await checkAdminRole(supabase, user.id);

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const mediaEmbedUrls = Array.isArray(body.media_embed_urls)
      ? (body.media_embed_urls as string[])
      : [];

    const result = await upsertMediaEmbeds(
      supabase,
      { type: "blog_post", id: post.id },
      mediaEmbedUrls,
      user.id
    );

    return NextResponse.json({
      data: result.data,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[POST /api/blog-posts/[id]/media-embeds] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
