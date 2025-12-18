import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BlogPostsTable from "./BlogPostsTable";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Admin privileges required.</p>
      </div>
    );
  }

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
      tags,
      author:profiles!blog_posts_author_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-2">Blog Management</h1>
          <p className="text-[var(--color-text-secondary)]">Create, edit, and manage blog posts.</p>
        </div>
        <Link
          href="/dashboard/admin/blog/new"
          className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] rounded-lg transition-colors"
        >
          + New Post
        </Link>
      </div>

      <BlogPostsTable posts={posts ?? []} />
    </div>
  );
}
