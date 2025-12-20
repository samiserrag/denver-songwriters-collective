import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { checkHostStatus } from "@/lib/auth/adminAuth";
import MyEventsFilteredList from "./_components/MyEventsFilteredList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Events | DSC"
};

export default async function MyEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Check if approved host or admin (admins are automatically hosts)
  const isApprovedHost = await checkHostStatus(supabase, session.user.id);

  // Fetch user's events via direct query
  const { data: hostEntries } = await supabase
    .from("event_hosts")
    .select("event_id, role, invitation_status")
    .eq("user_id", session.user.id)
    .eq("invitation_status", "accepted");

  let events: Array<{
    id: string;
    title: string;
    event_type: string;
    event_date: string | null;
    venue_name: string;
    day_of_week: string;
    start_time: string;
    status: string;
    is_published: boolean;
    capacity: number | null;
    rsvp_count: number;
    user_role: string;
    series_id: string | null;
  }> = [];

  if (hostEntries && hostEntries.length > 0) {
    const eventIds = hostEntries.map(h => h.event_id);

    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .in("id", eventIds)
      .eq("is_dsc_event", true)
      .order("event_date", { ascending: true, nullsFirst: false });

    if (eventsData) {
      events = await Promise.all(
        eventsData.map(async (event) => {
          const { count } = await supabase
            .from("event_rsvps")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id)
            .eq("status", "confirmed");

          const hostEntry = hostEntries.find(h => h.event_id === event.id);

          return {
            ...event,
            rsvp_count: count || 0,
            user_role: hostEntry?.role || "host"
          };
        })
      );
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)]">My Events</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">Events you host or co-host</p>
          </div>
          {isApprovedHost && (
            <Link
              href="/dashboard/my-events/new"
              className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] font-semibold rounded-lg transition-colors"
            >
              + Create Event
            </Link>
          )}
        </div>

        {!isApprovedHost && (
          <div className="p-6 bg-[var(--color-accent-primary)]/10 border border-[var(--color-border-accent)] rounded-lg mb-8">
            <h2 className="text-[var(--color-text-primary)] font-medium mb-2">Become a Host</h2>
            <p className="text-[var(--color-text-secondary)] text-sm mb-4">
              You need to be an approved host to create events. Request access from your dashboard.
            </p>
            <Link
              href="/dashboard"
              className="text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)] underline text-sm"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        <MyEventsFilteredList events={events} isApprovedHost={isApprovedHost} />
      </div>
    </main>
  );
}
