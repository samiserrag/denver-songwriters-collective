import { createSupabaseServerClient } from "@/lib/supabase/server";
import EventUpdateSuggestionsTable from "@/components/admin/EventUpdateSuggestionsTable";
import type { EventUpdateSuggestion } from "@/types/eventUpdateSuggestion";

export const dynamic = "force-dynamic";

export default async function AdminEventUpdateSuggestionsPage() {
  const supabase = await createSupabaseServerClient();

  // Support test environments where auth.getSession may not be available on the mocked client.
  let user = null;
  if (typeof supabase.auth.getSession === "function") {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
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
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold text-gold-400 mb-8">Review Event Update Suggestions</h1>
      <p className="text-neutral-300 mb-6">Review and moderate user-submitted corrections for events.</p>

      <EventUpdateSuggestionsTable suggestions={(suggestions as EventUpdateSuggestion[]) ?? null} />
    </div>
  );
}
