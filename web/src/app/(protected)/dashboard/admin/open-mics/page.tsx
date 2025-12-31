import { createSupabaseServerClient } from "@/lib/supabase/server";
import OpenMicStatusTable from "@/components/admin/OpenMicStatusTable";

export const dynamic = "force-dynamic";

export default async function AdminOpenMicsPage() {
  const supabase = await createSupabaseServerClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="p-8 text-red-500">You must be logged in.</div>;
  }

  // Admin check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return <div className="p-8 text-red-500">Access denied - admin only.</div>;
  }

  // Fetch all open mic events with venue info
  const { data: rawEvents, error } = await supabase
    .from("events")
    .select(
      `id, title, slug, status, day_of_week, start_time, signup_time, last_verified_at, notes, venues(name, city)`
    )
    .eq("event_type", "open_mic")
    .eq("is_published", true)
    .not("venue_id", "is", null)
    .order("day_of_week", { ascending: true });

  if (error) {
    console.error("Failed to fetch open mics:", error);
    return (
      <div className="p-8 text-red-500">
        Failed to load open mics: {error.message}
      </div>
    );
  }

  // Normalize the events - ensure venues is object or null (not array)
  const events = (rawEvents || []).map((e) => ({
    id: e.id as string,
    title: e.title as string,
    slug: e.slug as string | null,
    status: e.status as string | null,
    day_of_week: e.day_of_week as string | null,
    start_time: e.start_time as string | null,
    signup_time: e.signup_time as string | null,
    last_verified_at: e.last_verified_at as string | null,
    notes: e.notes as string | null,
    // venues may be array or object depending on Supabase types, normalize to object
    venues: Array.isArray(e.venues)
      ? (e.venues[0] as { name: string | null; city: string | null } | null) || null
      : (e.venues as { name: string | null; city: string | null } | null),
  }));

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-4">
        Open Mic Review Queue
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Manage open mic status. Only <strong>Active</strong> events appear on the public Open Mics page.
      </p>

      <OpenMicStatusTable events={events} />
    </div>
  );
}
