import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InvitationsList from "./InvitationsList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invitations | CSC"
};

export default async function InvitationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) redirect("/login");

  // First get the pending invitations
  // Note: invited_by FK points to auth.users, not profiles, so we can't use FK join
  const { data: hostEntries } = await supabase
    .from("event_hosts")
    .select(`
      *,
      event:events(id, title, event_type, venue_name, start_time)
    `)
    .eq("user_id", sessionUser.id)
    .eq("invitation_status", "pending")
    .order("invited_at", { ascending: false });

  // Fetch inviter profiles separately
  const inviterIds = [...new Set((hostEntries || []).map(h => h.invited_by).filter(Boolean))];
  const { data: inviterProfiles } = inviterIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", inviterIds as string[])
    : { data: [] };

  // Combine the data
  const inviterMap = new Map((inviterProfiles || []).map(p => [p.id, p]));
  const invitations = (hostEntries || []).map(entry => ({
    ...entry,
    inviter: entry.invited_by ? inviterMap.get(entry.invited_by) || null : null
  }));

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-2">Invitations</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">Co-host invitations from other hosts</p>

        <InvitationsList invitations={invitations || []} />
      </div>
    </main>
  );
}
