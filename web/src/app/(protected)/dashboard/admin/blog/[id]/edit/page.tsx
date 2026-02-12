import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import BlogPostForm from "../../BlogPostForm";
import { readMediaEmbeds } from "@/lib/mediaEmbedsServer";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const user = sessionUser ?? null;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Admin privileges required.</p>
      </div>
    );
  }

  const [postRes, galleryRes, embeds] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, content, cover_image_url, is_published, tags, youtube_url, spotify_url")
      .eq("id", id)
      .single(),
    supabase
      .from("blog_gallery_images")
      .select("id, image_url, caption, sort_order")
      .eq("post_id", id)
      .order("sort_order", { ascending: true }),
    readMediaEmbeds(supabase, { type: "blog_post", id }),
  ]);

  const post = postRes.data;
  const gallery = galleryRes.data ?? [];
  const mediaEmbedUrls = embeds.map((e) => e.url);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-2">Edit Blog Post</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">Update &quot;{post.title}&quot;</p>

      <BlogPostForm
        authorId={user.id}
        post={post}
        initialGallery={gallery}
        isAdmin={true}
        mediaEmbedUrls={mediaEmbedUrls}
      />
    </div>
  );
}
