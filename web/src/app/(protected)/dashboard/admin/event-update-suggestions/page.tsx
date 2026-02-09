import { createSupabaseServerClient } from "@/lib/supabase/server";
import EventUpdateSuggestionsTable from "@/components/admin/EventUpdateSuggestionsTable";
import type { EventUpdateSuggestion } from "@/types/eventUpdateSuggestion";

export const dynamic = "force-dynamic";

export default async function AdminEventUpdateSuggestionsPage() {
  const supabase = await createSupabaseServerClient();

  // Support test environments where auth.getSession may not be available on the mocked client.
  let user = null;
  if (typeof supabase.auth.getSession === "function") {
    const { data: { user: sessionUser } } = await supabase.auth.getUser();
    user = sessionUser ?? null;
  } else {
    const { data: { user: _user } } = await supabase.auth.getUser();
    user = _user ?? null;
  }

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

  const { data: suggestions } = await supabase
    .from("event_update_suggestions")
    .select("*, events(id, title, slug, venue_name, day_of_week, start_time)")
    .order("created_at", { ascending: false });

  // Look up profile names for submitters by email
  const emails = [...new Set((suggestions || []).map(s => s.submitter_email).filter(Boolean))];
  const { data: profiles } = emails.length > 0
    ? await supabase
        .from("profiles")
        .select("email, full_name")
        .in("email", emails)
    : { data: [] };

  // Create email -> name lookup
  const emailToName: Record<string, string> = {};
  (profiles || []).forEach(p => {
    if (p.email && p.full_name) {
      emailToName[p.email] = p.full_name;
    }
  });

  // Enrich suggestions with profile names
  const enrichedSuggestions = (suggestions || []).map(s => ({
    ...s,
    submitter_name: s.submitter_name || (s.submitter_email ? emailToName[s.submitter_email] : null),
  }));

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-8">Review Event Update Suggestions</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">Review and moderate user-submitted corrections for events.</p>

      <EventUpdateSuggestionsTable suggestions={(enrichedSuggestions as EventUpdateSuggestion[]) ?? null} />
    </div>
  );
}
