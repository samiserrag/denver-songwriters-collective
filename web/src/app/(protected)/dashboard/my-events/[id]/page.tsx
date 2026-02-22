import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import EventForm from "../_components/EventForm";
import { EVENT_TYPE_CONFIG } from "@/types/events";
import { checkAdminRole, checkHostStatus } from "@/lib/auth/adminAuth";
import { readMediaEmbeds } from "@/lib/mediaEmbedsServer";
import CreatedSuccessBanner from "./_components/CreatedSuccessBanner";
import { SeriesEditingNotice } from "@/components/events/SeriesEditingNotice";
import { computeNextOccurrence, expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";
import EventInviteSection from "./_components/EventInviteSection";
import LineupControlSection from "./_components/LineupControlSection";
import PublishButton from "./_components/PublishButton";
import EventManagementClient from "./_components/EventManagementClient";
import CancelEventButton from "./_components/CancelEventButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Happening | CSC"
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
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) redirect("/login");

  // Check if user can manage this event (admins have full access)
  const isAdmin = await checkAdminRole(supabase, sessionUser.id);

  // Check if user can create CSC-branded events
  const isApprovedHost = await checkHostStatus(supabase, sessionUser.id);
  const canCreateCSC = isApprovedHost || isAdmin;

  // Fetch event with venue
  // Note: event_hosts.user_id references auth.users, not profiles
  // So we fetch hosts separately and join with profiles manually
  // Phase 4.42e: Removed is_dsc_event filter to allow editing all events (CSC and community)
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
    (h) => h.user_id === sessionUser.id && h.invitation_status === "accepted"
  );
  const isEventOwner = event.host_id === sessionUser.id;

  if (!isAdmin && !userHost && !isEventOwner) {
    redirect("/dashboard");
  }

  // Fetch venues for the selector
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state, google_maps_url, map_link, website_url")
    .order("name", { ascending: true });

  // Load multi-embed URLs for this event
  let mediaEmbedUrls: string[] = [];
  try {
    const embeds = await readMediaEmbeds(supabase, { type: "event", id: eventId });
    mediaEmbedUrls = embeds.map((e: { url: string }) => e.url);
  } catch { /* non-fatal */ }

  const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
    || EVENT_TYPE_CONFIG.other;

  // Phase 4.42e: Event owner (host_id) is also a primary host
  const isPrimaryHost = userHost?.role === "host" || isAdmin || isEventOwner;

  // Get venue info from the joined relation
  // Phase 0.6: Include venue_id for Edit Venue link
  const venueData = event.venues as { id: string; name: string } | null;
  const venueName = venueData?.name ?? "TBA";
  const venueId = venueData?.id ?? null;

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

  // Phase 4.86: Compute next occurrence date for "View Public Page" link anchoring
  const nextOccurrence = computeNextOccurrence({
    event_date: event.event_date,
    recurrence_rule: event.recurrence_rule,
    day_of_week: event.day_of_week,
    custom_dates: event.custom_dates,
    max_occurrences: event.max_occurrences,
  });
  const nextOccurrenceDate = nextOccurrence.isConfident ? nextOccurrence.date : null;

  // Phase 4.99: Compute available dates for recurring events (for lineup control)
  const availableDates: string[] = [];
  if (event.is_recurring) {
    const occurrences = expandOccurrencesForEvent({
      event_date: event.event_date,
      day_of_week: event.day_of_week,
      recurrence_rule: event.recurrence_rule,
      custom_dates: event.custom_dates,
      max_occurrences: event.max_occurrences,
    });
    occurrences.forEach(occ => availableDates.push(occ.dateKey));
  } else if (event.event_date) {
    availableDates.push(event.event_date);
  }

  // Phase 4.99: Check if event has timeslots configured
  const { count: timeslotCount } = await supabase
    .from("event_timeslots")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);
  const hasTimeslots = (timeslotCount ?? 0) > 0 || event.has_timeslots;

  // Phase 5.12: Check if there are any active claims (even if timeslots are now off)
  // This ensures hosts can manage signups even when slot config was reverted
  const { count: activeClaimCount } = await supabase
    .from("timeslot_claims")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["confirmed", "performed", "waitlist"]);
  const hasActiveClaims = (activeClaimCount ?? 0) > 0;

  const { count: activeRsvpCount } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["confirmed", "waitlist", "offered"]);
  const hasActiveRsvps = (activeRsvpCount ?? 0) > 0;
  const hasSignupActivity = hasActiveClaims || hasActiveRsvps;

  // Determine user's role for the client component
  const currentUserRole: "host" | "cohost" = userHost?.role === "host" ? "host" : "cohost";

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Success Banner for newly created events */}
        {/* Events start as drafts; banner tells user to publish when ready */}
        {created === "true" && (
          <CreatedSuccessBanner
            eventId={eventId}
            eventSlug={event.slug}
            nextOccurrenceDate={nextOccurrenceDate}
            isDraft={!event.is_published}
          />
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
                <p className="text-[var(--color-text-secondary)] text-sm">
                  {config.label} •{" "}
                  {venueId ? (
                    <>
                      {venueName}
                      {/* Phase 0.6: Edit Venue link for hosts/cohosts */}
                      <Link
                        href={`/dashboard/my-venues/${venueId}`}
                        className="ml-2 text-[var(--color-text-accent)] hover:underline"
                        title="Edit venue details"
                      >
                        (Edit Venue)
                      </Link>
                    </>
                  ) : (
                    venueName
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Publish/Unpublish Button - the primary action for controlling visibility */}
            <PublishButton
              eventId={eventId}
              isPublished={event.is_published}
              status={event.status}
              hasSignupActivity={hasSignupActivity}
            />
            {isPrimaryHost && (
              <CancelEventButton
                eventId={eventId}
                status={event.status}
                compact
              />
            )}

            {/* Status badge */}
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

            {/* View public page link - only visible when published */}
            {event.status === "active" && event.is_published && (
              <Link
                href={`/events/${event.slug || eventId}${nextOccurrenceDate ? `?date=${nextOccurrenceDate}` : ""}`}
                className="px-3 py-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm rounded"
                target="_blank"
              >
                View Public Page →
              </Link>
            )}
          </div>
        </div>

        {isPrimaryHost && event.status === "active" && (
          <p className="text-xs text-[var(--color-text-secondary)] mb-6">
            Cancel marks this event as cancelled, notifies attending people, and keeps it visible.
          </p>
        )}

        {/* Phase 5.14: Tabbed Layout */}
        <EventManagementClient
          eventId={eventId}
          eventSlug={event.slug}
          eventTitle={event.title}
          eventStatus={event.status}
          eventVisibility={event.visibility ?? "public"}
          capacity={event.capacity}
          isRecurring={event.is_recurring ?? false}
          availableDates={availableDates}
          initialDateKey={nextOccurrenceDate ?? undefined}
          hasTimeslots={hasTimeslots}
          hasActiveClaims={hasActiveClaims}
          hosts={hostsWithProfiles}
          currentUserId={sessionUser.id}
          currentUserRole={currentUserRole}
          isPrimaryHost={isPrimaryHost}
          isAdmin={isAdmin}
          isEventOwner={isEventOwner}
          DetailsContent={
            <EventForm
              mode="edit"
              venues={venues ?? []}
              event={event}
              canCreateCSC={canCreateCSC}
              canCreateVenue={isAdmin}
              mediaEmbedUrls={mediaEmbedUrls}
              hasActiveClaims={hasActiveClaims}
            />
          }
          EventInviteSection={
            <EventInviteSection eventId={eventId} eventTitle={event.title} />
          }
          LineupControlSection={
            <LineupControlSection
              eventId={eventId}
              eventSlug={event.slug}
              isRecurring={event.is_recurring ?? false}
              availableDates={availableDates}
              nextOccurrenceDate={nextOccurrenceDate}
            />
          }
          SeriesEditingNotice={
            <SeriesEditingNotice
              event={{
                id: event.id,
                recurrence_rule: event.recurrence_rule,
                day_of_week: event.day_of_week,
                event_date: event.event_date,
                is_recurring: event.is_recurring,
                series_id: event.series_id,
              }}
              showOverrideLink={isPrimaryHost || isAdmin}
              seriesSiblings={seriesSiblings}
            />
          }
        />
      </div>
    </main>
  );
}
