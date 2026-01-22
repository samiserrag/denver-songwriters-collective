import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderOgCard } from "../../_shared/ogCard";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  // Query blog post by slug
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, cover_image_url, author:profiles!blog_posts_author_id_fkey(full_name, avatar_url)")
    .eq("slug", slug)
    .single();

  const title = post?.title ?? "Blog Post";
  const excerpt = post?.excerpt ?? "";
  const coverImage = post?.cover_image_url;
  const author = post?.author as { full_name?: string; avatar_url?: string } | null;
  const authorName = author?.full_name ?? "Denver Songwriters Collective";
  const authorAvatar = author?.avatar_url;

  return new ImageResponse(
    renderOgCard({
      title,
      subtitle: excerpt || undefined,
      chips: [],
      imageUrl: coverImage,
      fallbackEmoji: "📝",
      kindLabel: "Blog",
      kindVariant: "gold",
      author: {
        name: authorName,
        avatarUrl: authorAvatar,
      },
    }),
    {
      width: 1200,
      height: 630,
    }
  );
}
