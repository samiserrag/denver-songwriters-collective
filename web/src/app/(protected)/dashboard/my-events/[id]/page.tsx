import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import EventForm from "../_components/EventForm";
import RSVPList from "../_components/RSVPList";
import CoHostManager from "../_components/CoHostManager";
import { EVENT_TYPE_CONFIG } from "@/types/events";
import CancelEventButton from "./_components/CancelEventButton";
import PublishButton from "./_components/PublishButton";
import { checkAdminRole, checkHostStatus } from "@/lib/auth/adminAuth";
import CreatedSuccessBanner from "./_components/CreatedSuccessBanner";
import { SeriesEditingNotice } from "@/components/events/SeriesEditingNotice";
import { LeaveEventButton } from "@/components/events/LeaveEventButton";

export const metadata = {
  title: "Edit Happening | DSC"
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
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id: eventId } = await params;
  const { created } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Check if user can manage this event (admins have full access)
  const isAdmin = await checkAdminRole(supabase, session.user.id);

  // Check if user can create DSC-branded events
  const isApprovedHost = await checkHostStatus(supabase, session.user.id);
  const canCreateDSC = isApprovedHost || isAdmin;

  // Fetch event with venue
  // Note: event_hosts.user_id references auth.users, not profiles
  // So we fetch hosts separately and join with profiles manually
  // Phase 4.42e: Removed is_dsc_event filter to allow editing all events (DSC and community)
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      venues(id, name, address, city, state, google_maps_url, map_link, website_url),
      event_hosts(id, user_id, role, invitation_status)
    `)
    .eq("id", eventId)
    .single();

  if (error) {
    console.error("[EditEventPage] Event fetch error for ID:", eventId, "| Error:", error.message, "| Code:", error.code, "| Details:", error.details);
    notFound();
  }

  if (!event) {
    console.error("[EditEventPage] Event not found for ID:", eventId, "- query returned null");
    notFound();
  }

  // Fetch profiles for all host user_ids
  const hostUserIds = (event.event_hosts as { user_id: string }[])?.map(h => h.user_id) || [];

  let hostsWithProfiles: EventHost[] = [];
  if (hostUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", hostUserIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    hostsWithProfiles = (event.event_hosts as { id: string; user_id: string; role: string; invitation_status: string }[])?.map(h => ({
      ...h,
      user: profileMap.get(h.user_id) || undefined
    })) || [];
  }

  // Check authorization
  // Phase 4.42e: Also allow event owner (host_id) to edit, not just event_hosts entries
  const userHost = hostsWithProfiles.find(
    (h) => h.user_id === session.user.id && h.invitation_status === "accepted"
  );
  const isEventOwner = event.host_id === session.user.id;

  if (!isAdmin && !userHost && !isEventOwner) {
    redirect("/dashboard");
  }

  // Fetch venues for the selector
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state, google_maps_url, map_link, website_url")
    .order("name", { ascending: true });

  const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
    || EVENT_TYPE_CONFIG.other;

  // Phase 4.42e: Event owner (host_id) is also a primary host
  const isPrimaryHost = userHost?.role === "host" || isAdmin || isEventOwner;

  // Get venue name from the joined relation
  const venueName = (event.venues as { name: string } | null)?.name ?? "TBA";

  // Phase 4.42k C3: Fetch series siblings if this event is part of a series
  let seriesSiblings: Array<{ id: string; event_date: string | null; title: string }> = [];
  if (event.series_id) {
    const { data: siblings } = await supabase
      .from("events")
      .select("id, event_date, title")
      .eq("series_id", event.series_id)
      .neq("id", eventId)
      .order("event_date", { ascending: true });
    seriesSiblings = siblings ?? [];
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Success Banner for newly created events */}
        {/* Phase 4.73: Use event.is_published for current state, not stale URL params */}
        {created === "true" && (
          <CreatedSuccessBanner isDraft={!event.is_published} eventId={eventId} eventSlug={event.slug} />
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Link
              href="/dashboard/my-events"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
            >
              ← Back to My Happenings
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
            {/* Status badge - single badge showing overall state */}
            {event.status === "cancelled" ? (
              <span className="px-3 py-1 rounded text-sm bg-red-100 text-red-700">
                Cancelled
              </span>
            ) : !event.is_published ? (
              <span className="px-3 py-1 rounded text-sm bg-amber-100 text-amber-700">
                Draft
              </span>
            ) : (
              <span className="px-3 py-1 rounded text-sm bg-emerald-100 text-emerald-700">
                Live
              </span>
            )}

            {/* Publish/Unpublish button */}
            <PublishButton
              eventId={eventId}
              isPublished={event.is_published}
              status={event.status}
            />

            {/* Phase 4.44c: Preview/View links based on event state */}
            {event.status === "active" && (
              event.is_published ? (
                <Link
                  href={`/events/${event.slug || eventId}`}
                  className="px-3 py-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm rounded"
                  target="_blank"
                >
                  View Public Page →
                </Link>
              ) : (
                <Link
                  href={`/events/${event.slug || eventId}`}
                  className="px-3 py-1 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-sm rounded border border-[var(--color-border-default)]"
                  target="_blank"
                  title="Preview how this event will appear when published (only visible to you)"
                >
                  Preview as visitor →
                </Link>
              )
            )}
          </div>
        </div>

        {/* Tabs / Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Series Editing Notice - Phase 4.22.1, updated 4.42k C3 */}
            <SeriesEditingNotice
              event={{
                id: event.id,
                recurrence_rule: event.recurrence_rule,
                day_of_week: event.day_of_week,
                event_date: event.event_date,
                is_recurring: event.is_recurring,
                series_id: event.series_id,
              }}
              showOverrideLink={isAdmin}
              seriesSiblings={seriesSiblings}
            />

            {/* Event Details */}
            <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Happening Details</h2>
              <EventForm mode="edit" venues={venues ?? []} event={event} canCreateDSC={canCreateDSC} canCreateVenue={isAdmin} isAdmin={isAdmin} />
            </section>

            {/* Co-hosts section - visible to all hosts */}
            {userHost && (
              <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Co-hosts</h2>
                {isPrimaryHost ? (
                  // Primary hosts can manage co-hosts
                  <CoHostManager
                    eventId={eventId}
                    eventTitle={event.title}
                    hosts={hostsWithProfiles}
                    currentUserId={session.user.id}
                    currentUserRole={userHost.role as "host" | "cohost"}
                    isSoleHost={hostsWithProfiles.filter(h => h.invitation_status === "accepted").length === 1}
                  />
                ) : (
                  // Co-hosts see read-only list + their own leave button
                  <div className="space-y-4">
                    {/* Read-only host list */}
                    <ul className="space-y-2">
                      {hostsWithProfiles.filter(h => h.invitation_status === "accepted").map((host) => (
                        <li key={host.id} className="flex items-center gap-3 p-2 bg-[var(--color-bg-tertiary)] rounded-lg">
                          <div className="w-8 h-8 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] rounded-full flex items-center justify-center text-sm">
                            {host.user?.full_name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-[var(--color-text-primary)] text-sm">{host.user?.full_name || "Unknown"}</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {host.role === "host" ? "Primary Host" : "Co-host"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {/* Leave button for co-host */}
                    <LeaveEventButton
                      eventId={eventId}
                      eventTitle={event.title}
                      userRole="cohost"
                      userId={session.user.id}
                    />
                  </div>
                )}
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
              <section className="p-6 bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-900/50 rounded-lg">
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-4">Danger Zone</h2>
                <CancelEventButton eventId={eventId} />
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
