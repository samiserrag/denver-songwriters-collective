import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserDirectoryTable } from "@/components/admin";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
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

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-gold-400 mb-3">
        User Directory
      </h1>
      <p className="text-neutral-300 mb-6">
        Browse all users across roles. Use search and filters to find performers, studios, hosts, and admins.
      </p>

      <UserDirectoryTable users={(users ?? []) as Profile[]} />
    </div>
  );
}
