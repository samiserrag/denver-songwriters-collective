import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InvitationsList from "./InvitationsList";

export const metadata = {
  title: "Invitations | DSC"
};

export default async function InvitationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: invitations } = await supabase
    .from("event_hosts")
    .select(`
      *,
      event:events(id, title, event_type, venue_name, start_time),
      inviter:profiles!event_hosts_invited_by_fkey(id, full_name)
    `)
    .eq("user_id", session.user.id)
    .eq("invitation_status", "pending")
    .order("invited_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-warm-white)] mb-2">Invitations</h1>
        <p className="text-[var(--color-warm-gray)] mb-8">Co-host invitations from other hosts</p>

        <InvitationsList invitations={invitations || []} />
      </div>
    </main>
  );
}
