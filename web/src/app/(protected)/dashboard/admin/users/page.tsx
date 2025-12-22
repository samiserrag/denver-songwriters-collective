import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserDirectoryTable } from "@/components/admin";
import type { Database } from "@/lib/supabase/database.types";
import { isSuperAdmin } from "@/lib/auth/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) {
    return <div className="p-8 text-red-500">You must be logged in.</div>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return <div className="p-8 text-red-500">Access denied — admin only.</div>;
  }

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const currentUserIsSuperAdmin = isSuperAdmin(user.email);

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-3">
        User Directory
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Browse all users across roles. Use search and filters to find performers, studios, hosts, and admins.
      </p>

      <UserDirectoryTable
        users={(users ?? []) as Profile[]}
        isSuperAdmin={currentUserIsSuperAdmin}
        currentUserId={user.id}
      />
    </div>
  );
}
