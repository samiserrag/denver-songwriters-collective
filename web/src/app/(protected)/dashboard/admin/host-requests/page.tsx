import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HostRequestsTable } from "./HostRequestsTable";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export default async function AdminHostRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const isAdmin = await checkAdminRole(supabase, session.user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: requests } = await supabase
    .from("host_requests")
    .select(
      `
      *,
      user:profiles(id, full_name, avatar_url)
    `
    )
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen bg-black py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-3xl text-white mb-8">Host Requests</h1>
        <HostRequestsTable requests={requests || []} />
      </div>
    </main>
  );
}
