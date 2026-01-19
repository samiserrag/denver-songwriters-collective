import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import EventEditForm from "./EventEditForm";
import { SeriesEditingNotice } from "@/components/events/SeriesEditingNotice";
import { EventPhotosSection } from "@/components/events/EventPhotosSection";

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

  // Fetch event images for photo gallery
  const { data: eventImages } = await supabase
    .from("event_images")
    .select("id, event_id, image_url, storage_path, uploaded_by, created_at, deleted_at")
    .eq("event_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-[var(--color-text-accent)] mb-8">Edit Happening</h1>

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

      {/* Happening Photos Section */}
      <div className="mt-10 pt-10 border-t border-[var(--color-border-default)]">
        <EventPhotosSection
          eventId={id}
          eventTitle={event.title}
          currentCoverUrl={event.cover_image_url}
          initialImages={(eventImages || []) as Array<{
            id: string;
            event_id: string;
            image_url: string;
            storage_path: string;
            uploaded_by: string | null;
            created_at: string;
            deleted_at: string | null;
          }>}
          userId={user.id}
        />
      </div>
    </div>
  );
}
