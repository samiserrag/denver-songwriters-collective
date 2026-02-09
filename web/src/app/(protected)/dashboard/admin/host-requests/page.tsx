import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HostRequestsTable } from "./HostRequestsTable";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export default async function AdminHostRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) redirect("/login");

  const isAdmin = await checkAdminRole(supabase, sessionUser.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: requests, error } = await supabase
    .from("host_requests")
    .select(
      `
      *,
      user:profiles(id, full_name, avatar_url)
    `
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Host requests query failed", error);
    return (
      <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-8">Host Requests</h1>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 font-medium">Host requests failed to load</p>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">
              Check server logs for details.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-8">Host Requests</h1>
        <HostRequestsTable requests={requests || []} />
      </div>
    </main>
  );
}
