import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import EventEditForm from "./EventEditForm";
import { SeriesEditingNotice } from "@/components/events/SeriesEditingNotice";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  
  // Check admin role
  let user = null;
  if (typeof supabase.auth.getSession === "function") {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
  } else {
    const { data: { user: _user } } = await supabase.auth.getUser();
    user = _user ?? null;
  }

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");
  
  // Fetch event
  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
    
  if (error || !event) notFound();
  
  // Fetch venues for dropdown
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state")
    .order("name");
  
  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-[var(--color-text-accent)] mb-8">Edit Event</h1>

      {/* Series Editing Notice - Phase 4.22.1 */}
      <SeriesEditingNotice
        event={{
          id: event.id,
          recurrence_rule: event.recurrence_rule,
          day_of_week: event.day_of_week,
          event_date: event.event_date,
          is_recurring: event.is_recurring,
        }}
        showOverrideLink={true}
      />

      <EventEditForm event={event} venues={venues || []} />
    </div>
  );
}
