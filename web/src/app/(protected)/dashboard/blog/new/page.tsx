import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BlogPostForm from "../../admin/blog/BlogPostForm";

export const dynamic = "force-dynamic";

export default async function NewUserBlogPostPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const user = sessionUser ?? null;
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-2">New Blog Post</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">Share your story with the community.</p>

      <BlogPostForm authorId={user.id} isAdmin={false} />
    </div>
  );
}
