import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import EventEditForm from "./EventEditForm";
import { SeriesEditingNotice } from "@/components/events/SeriesEditingNotice";
import { EventPhotosSection } from "@/components/events/EventPhotosSection";
import { AdminHostManager } from "@/components/admin/AdminHostManager";

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

  // Fetch event hosts
  const { data: eventHosts } = await supabase
    .from("event_hosts")
    .select("id, user_id, role, invitation_status")
    .eq("event_id", id);

  // Fetch profiles for hosts
  const hostUserIds = (eventHosts || []).map(h => h.user_id);
  let hostsWithProfiles: Array<{
    id: string;
    user_id: string;
    role: string;
    invitation_status: string;
    user?: { id: string; full_name: string | null; avatar_url: string | null };
  }> = [];

  if (hostUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", hostUserIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    hostsWithProfiles = (eventHosts || []).map(h => ({
      ...h,
      user: profileMap.get(h.user_id) || undefined
    }));
  }

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

      {/* Host Management Section */}
      <div className="mt-10 pt-10 border-t border-[var(--color-border-default)]">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Host Management</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Manage hosts and co-hosts for this happening. You can remove any host from this event.
        </p>
        <AdminHostManager
          eventId={id}
          eventTitle={event.title}
          hosts={hostsWithProfiles}
        />
      </div>

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
