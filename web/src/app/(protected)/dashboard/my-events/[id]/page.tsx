import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import EventForm from "../_components/EventForm";
import RSVPList from "../_components/RSVPList";
import CoHostManager from "../_components/CoHostManager";
import { EVENT_TYPE_CONFIG } from "@/types/events";
import CancelEventButton from "./_components/CancelEventButton";

export const metadata = {
  title: "Edit Event | DSC"
};

interface EventHost {
  id: string;
  user_id: string;
  role: string;
  invitation_status: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export default async function EditEventPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Check if user can manage this event
  const { data: user } = await supabase.auth.getUser();
  const isAdmin = user?.user?.app_metadata?.role === "admin";

  // Fetch event
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(
        id, user_id, role, invitation_status,
        user:profiles(id, full_name, avatar_url)
      )
    `)
    .eq("id", eventId)
    .eq("is_dsc_event", true)
    .single();

  if (error || !event) {
    notFound();
  }

  // Check authorization
  const userHost = (event.event_hosts as EventHost[])?.find(
    (h) => h.user_id === session.user.id && h.invitation_status === "accepted"
  );

  if (!isAdmin && !userHost) {
    redirect("/dashboard");
  }

  const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
    || EVENT_TYPE_CONFIG.other;

  const isPrimaryHost = userHost?.role === "host" || isAdmin;

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Link
              href="/dashboard/my-events"
              className="text-[var(--color-warm-gray)] hover:text-[var(--color-warm-white)] text-sm mb-2 inline-block"
            >
              ← Back to My Events
            </Link>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-3xl">{config.icon}</span>
              <div>
                <h1 className="font-[var(--font-family-serif)] text-2xl text-[var(--color-warm-white)]">{event.title}</h1>
                <p className="text-[var(--color-warm-gray)] text-sm">{config.label} • {event.venue_name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded text-sm ${
              event.status === "active"
                ? "bg-green-900/50 text-green-400"
                : "bg-red-900/50 text-red-400"
            }`}>
              {event.status}
            </span>
            <Link
              href={`/events/${eventId}`}
              className="px-3 py-1 bg-[var(--color-indigo-950)]/50 hover:bg-[var(--color-indigo-950)]/70 text-[var(--color-warm-white)] text-sm rounded"
              target="_blank"
            >
              View Public Page →
            </Link>
          </div>
        </div>

        {/* Tabs / Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Event Details */}
            <section className="p-6 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg">
              <h2 className="text-lg font-semibold text-[var(--color-warm-white)] mb-4">Event Details</h2>
              <EventForm mode="edit" event={event} />
            </section>

            {/* Co-hosts (only for primary host) */}
            {isPrimaryHost && (
              <section className="p-6 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg">
                <h2 className="text-lg font-semibold text-[var(--color-warm-white)] mb-4">Co-hosts</h2>
                <CoHostManager eventId={eventId} hosts={(event.event_hosts as EventHost[]) || []} />
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* RSVP Summary */}
            <section className="p-6 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg">
              <h2 className="text-lg font-semibold text-[var(--color-warm-white)] mb-4">Attendees</h2>
              <RSVPList eventId={eventId} capacity={event.capacity} />
            </section>

            {/* Danger Zone */}
            {isPrimaryHost && event.status === "active" && (
              <section className="p-6 bg-red-950/30 border border-red-900/50 rounded-lg">
                <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
                <CancelEventButton eventId={eventId} />
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
