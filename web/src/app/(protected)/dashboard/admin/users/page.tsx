import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
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
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const user = sessionUser ?? null;
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

  // Fetch user emails from auth.users using service role client
  const serviceClient = createServiceRoleClient();
  const { data: authUsers } = await serviceClient.auth.admin.listUsers();

  // Create a map of user ID to email
  const emailMap: Record<string, string> = {};
  if (authUsers?.users) {
    for (const authUser of authUsers.users) {
      if (authUser.email) {
        emailMap[authUser.id] = authUser.email;
      }
    }
  }

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
        emailMap={emailMap}
        isSuperAdmin={currentUserIsSuperAdmin}
        currentUserId={user.id}
      />
    </div>
  );
}
