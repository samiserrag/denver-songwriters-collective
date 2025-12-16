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

  // Fetch event with venue
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      venues(id, name, address, city, state),
      event_hosts(
        id, user_id, role, invitation_status,
        user:profiles(id, full_name, avatar_url)
      )
    `)
    .eq("id", eventId)
    .eq("is_dsc_event", true)
    .single();

  if (error) {
    console.error("Event fetch error:", error);
    notFound();
  }

  if (!event) {
    console.error("Event not found for ID:", eventId);
    notFound();
  }

  // Check authorization
  const userHost = (event.event_hosts as EventHost[])?.find(
    (h) => h.user_id === session.user.id && h.invitation_status === "accepted"
  );

  if (!isAdmin && !userHost) {
    redirect("/dashboard");
  }

  // Fetch venues for the selector
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state")
    .order("name", { ascending: true });

  const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
    || EVENT_TYPE_CONFIG.other;

  const isPrimaryHost = userHost?.role === "host" || isAdmin;

  // Get venue name from the joined relation
  const venueName = (event.venues as { name: string } | null)?.name ?? "TBA";

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Link
              href="/dashboard/my-events"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
            >
              ← Back to My Events
            </Link>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-3xl">{config.icon}</span>
              <div>
                <h1 className="font-[var(--font-family-serif)] text-2xl text-[var(--color-text-primary)]">{event.title}</h1>
                <p className="text-[var(--color-text-secondary)] text-sm">{config.label} • {venueName}</p>
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
              className="px-3 py-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm rounded"
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
            <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Event Details</h2>
              <EventForm mode="edit" venues={venues ?? []} event={event} />
            </section>

            {/* Co-hosts (only for primary host) */}
            {isPrimaryHost && (
              <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Co-hosts</h2>
                <CoHostManager eventId={eventId} hosts={(event.event_hosts as EventHost[]) || []} />
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* RSVP Summary */}
            <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Attendees</h2>
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
