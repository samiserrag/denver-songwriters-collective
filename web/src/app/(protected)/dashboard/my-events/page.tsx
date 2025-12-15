import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EVENT_TYPE_CONFIG } from "@/types/events";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Events | DSC"
};

export default async function MyEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Check if approved host or admin
  const { data: user } = await supabase.auth.getUser();
  const isAdmin = user?.user?.app_metadata?.role === "admin";

  let isApprovedHost = isAdmin;
  if (!isAdmin) {
    const { data: hostStatus } = await supabase
      .from("approved_hosts")
      .select("status")
      .eq("user_id", session.user.id)
      .eq("status", "active")
      .maybeSingle();
    isApprovedHost = !!hostStatus;
  }

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
    venue_name: string;
    day_of_week: string;
    start_time: string;
    status: string;
    capacity: number | null;
    rsvp_count: number;
    user_role: string;
  }> = [];

  if (hostEntries && hostEntries.length > 0) {
    const eventIds = hostEntries.map(h => h.event_id);

    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .in("id", eventIds)
      .eq("is_dsc_event", true)
      .order("created_at", { ascending: false });

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
              className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold rounded-lg transition-colors"
            >
              + Create Event
            </Link>
          )}
        </div>

        {!isApprovedHost && (
          <div className="p-6 bg-amber-900/30 border border-amber-700 rounded-lg mb-8">
            <h2 className="text-amber-300 font-medium mb-2">Become a Host</h2>
            <p className="text-amber-400/70 text-sm mb-4">
              You need to be an approved host to create events. Request access from your dashboard.
            </p>
            <Link
              href="/dashboard"
              className="text-amber-300 hover:text-amber-200 underline text-sm"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-xl text-[var(--color-text-primary)] mb-2">No events yet</h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              {isApprovedHost
                ? "Create your first event to get started!"
                : "Once you're an approved host, you can create events here."
              }
            </p>
            {isApprovedHost && (
              <Link
                href="/dashboard/my-events/new"
                className="inline-block px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold rounded-lg"
              >
                Create Your First Event
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
                || EVENT_TYPE_CONFIG.other;

              return (
                <Link
                  key={event.id}
                  href={`/dashboard/my-events/${event.id}`}
                  className="block p-6 bg-[var(--color-indigo-950)]/50 hover:bg-[var(--color-indigo-950)]/70 border border-white/10 hover:border-white/20 rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{config.icon}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          event.status === "active"
                            ? "bg-green-900/50 text-green-400"
                            : "bg-neutral-800 text-neutral-400"
                        }`}>
                          {event.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                          {config.label}
                        </span>
                        {event.user_role === "cohost" && (
                          <span className="text-xs px-2 py-0.5 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] rounded">
                            Co-host
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg text-[var(--color-text-primary)] font-medium">{event.title}</h2>
                      <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                        {event.venue_name} {event.day_of_week && `• ${event.day_of_week}`} {event.start_time && event.start_time}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--color-text-primary)]">{event.rsvp_count}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {event.capacity ? `of ${event.capacity}` : "RSVPs"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
