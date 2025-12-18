import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import UserBlogPostsTable from "./UserBlogPostsTable";

export const dynamic = "force-dynamic";

export default async function UserBlogDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { data: posts } = await supabase
    .from("blog_posts")
    .select(`
      id,
      slug,
      title,
      excerpt,
      is_published,
      is_approved,
      published_at,
      created_at,
      tags
    `)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-2">My Blog Posts</h1>
          <p className="text-[var(--color-text-secondary)]">Create and manage your blog posts.</p>
        </div>
        <Link
          href="/dashboard/blog/new"
          className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] rounded-lg transition-colors"
        >
          + New Post
        </Link>
      </div>

      <UserBlogPostsTable posts={posts ?? []} />
    </div>
  );
}
