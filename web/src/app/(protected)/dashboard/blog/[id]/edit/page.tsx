import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import BlogPostForm from "../../../admin/blog/BlogPostForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditUserBlogPostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const [postRes, galleryRes] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, content, cover_image_url, is_published, is_approved, tags, author_id")
      .eq("id", id)
      .single(),
    supabase
      .from("blog_gallery_images")
      .select("id, image_url, caption, sort_order")
      .eq("post_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  const post = postRes.data;
  const gallery = galleryRes.data ?? [];

  if (!post) {
    notFound();
  }

  // Ensure user can only edit their own posts
  if (post.author_id !== user.id) {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
        <p className="text-neutral-400 mt-2">You can only edit your own posts.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-gold-400 mb-2">Edit Blog Post</h1>
      <p className="text-neutral-300 mb-8">Update &quot;{post.title}&quot;</p>

      <BlogPostForm
        authorId={user.id}
        post={post}
        initialGallery={gallery}
        isAdmin={false}
      />
    </div>
  );
}
