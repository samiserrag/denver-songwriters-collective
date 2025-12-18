import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BlogPostForm from "../BlogPostForm";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
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
      <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-2">New Blog Post</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">Create a new blog post for the community.</p>

      <BlogPostForm authorId={user.id} isAdmin={true} />
    </div>
  );
}
