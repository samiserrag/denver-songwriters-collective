import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EVENT_TYPE_CONFIG } from "@/types/events";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export const metadata = {
  title: "DSC Events Admin | DSC"
};

interface EventHost {
  user: { full_name: string | null } | null;
}

interface DSCEvent {
  id: string;
  title: string;
  event_type: string;
  venue_name: string | null;
  status: string;
  created_at: string;
  event_hosts: EventHost[];
}

export default async function AdminDSCEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const isAdmin = await checkAdminRole(supabase, session.user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: events } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(
        user:profiles(full_name)
      )
    `)
    .eq("is_dsc_event", true)
    .order("created_at", { ascending: false });

  const eventsByStatus = {
    active: (events as DSCEvent[] | null)?.filter(e => e.status === "active") || [],
    cancelled: (events as DSCEvent[] | null)?.filter(e => e.status === "cancelled") || [],
    draft: (events as DSCEvent[] | null)?.filter(e => e.status === "draft") || []
  };

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/dashboard/admin"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
            >
              ← Back to Admin
            </Link>
            <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)]">DSC Events</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">All community-created events</p>
          </div>
          <div className="text-right text-sm text-[var(--color-text-secondary)]">
            {events?.length || 0} total events
          </div>
        </div>

        {/* Active Events */}
        <section className="mb-8">
          <h2 className="text-xl text-green-400 mb-4">Active ({eventsByStatus.active.length})</h2>
          {eventsByStatus.active.length === 0 ? (
            <p className="text-[var(--color-text-secondary)]">No active events</p>
          ) : (
            <div className="space-y-2">
              {eventsByStatus.active.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {/* Cancelled Events */}
        {eventsByStatus.cancelled.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl text-red-400 mb-4">Cancelled ({eventsByStatus.cancelled.length})</h2>
            <div className="space-y-2">
              {eventsByStatus.cancelled.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function EventRow({ event }: { event: DSCEvent }) {
  const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
    || EVENT_TYPE_CONFIG.other;

  const hostName = event.event_hosts?.[0]?.user?.full_name || "No host";

  return (
    <Link
      href={`/dashboard/my-events/${event.id}`}
      className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{config.icon}</span>
        <div>
          <h3 className="text-[var(--color-text-primary)] font-medium">{event.title}</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">
            {event.venue_name} • Host: {hostName}
          </p>
        </div>
      </div>
      <span className={`text-xs px-2 py-1 rounded ${
        event.status === "active"
          ? "bg-green-900/50 text-green-400"
          : "bg-red-900/50 text-red-400"
      }`}>
        {event.status}
      </span>
    </Link>
  );
}
