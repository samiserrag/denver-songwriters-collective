import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import VerificationQueueTable from "@/components/admin/VerificationQueueTable";

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

  // Use service role to fetch events with RSVP/claim counts for delete guardrails
  const serviceClient = createServiceRoleClient();

  // Fetch all open mic events with venue info
  const { data: rawEvents, error } = await serviceClient
    .from("events")
    .select(
      `id, title, slug, status, event_type, event_date, day_of_week, recurrence_rule, start_time, signup_time, last_verified_at, verified_by, notes, is_published, venues(name, city)`
    )
    .contains("event_type", ["open_mic"])
    .neq("status", "draft")
    .order("title", { ascending: true });

  if (error) {
    console.error("Failed to fetch open mics:", error);
    return (
      <div className="p-8 text-red-500">
        Failed to load open mics: {error.message}
      </div>
    );
  }

  // For each event, get RSVP and timeslot claim counts (for delete guardrails)
  const eventIds = (rawEvents || []).map((e) => e.id);

  // Fetch RSVP counts
  const { data: rsvpCounts } = await serviceClient
    .from("event_rsvps")
    .select("event_id")
    .in("event_id", eventIds);

  // Fetch timeslot claim counts - join through event_timeslots to get event_id
  const { data: claimCounts } = await serviceClient
    .from("timeslot_claims")
    .select("id, event_timeslots!inner(event_id)")
    .in("event_timeslots.event_id", eventIds);

  // Build count maps
  const rsvpCountMap: Record<string, number> = {};
  const claimCountMap: Record<string, number> = {};

  (rsvpCounts || []).forEach((r) => {
    rsvpCountMap[r.event_id] = (rsvpCountMap[r.event_id] || 0) + 1;
  });

  (claimCounts || []).forEach((c) => {
    // Handle both single object and array cases from Supabase
    const timeslot = Array.isArray(c.event_timeslots) ? c.event_timeslots[0] : c.event_timeslots;
    const eventId = timeslot?.event_id;
    if (eventId) {
      claimCountMap[eventId] = (claimCountMap[eventId] || 0) + 1;
    }
  });

  // Normalize the events - ensure venues is object or null (not array)
  const events = (rawEvents || []).map((e) => ({
    id: e.id as string,
    title: e.title as string,
    slug: e.slug as string | null,
    status: e.status as string | null,
    event_type: e.event_type as string[] | null,
    event_date: e.event_date as string | null,
    day_of_week: e.day_of_week as string | null,
    recurrence_rule: e.recurrence_rule as string | null,
    start_time: e.start_time as string | null,
    signup_time: e.signup_time as string | null,
    last_verified_at: e.last_verified_at as string | null,
    verified_by: e.verified_by as string | null,
    notes: e.notes as string | null,
    is_published: e.is_published as boolean | null,
    // venues may be array or object depending on Supabase types, normalize to object
    venues: Array.isArray(e.venues)
      ? (e.venues[0] as { name: string | null; city: string | null } | null) || null
      : (e.venues as { name: string | null; city: string | null } | null),
    // Add counts for delete guardrails
    rsvp_count: rsvpCountMap[e.id] || 0,
    claim_count: claimCountMap[e.id] || 0,
  }));

  // Get unique venues for filter dropdown
  const uniqueVenues = [...new Set(events.map((e) => e.venues?.name).filter(Boolean))] as string[];

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-4">
        Event Verification Queue
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Review and verify events. <strong>Unconfirmed</strong> events need admin verification before showing as confirmed on the public site.
      </p>

      <VerificationQueueTable events={events} venues={uniqueVenues} />
    </div>
  );
}
