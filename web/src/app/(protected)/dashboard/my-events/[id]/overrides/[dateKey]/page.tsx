import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { readEventEmbedsWithFallback } from "@/lib/mediaEmbedsServer";
import { formatDateGroupHeader, getTodayDenver, addDaysDenver, expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";
import EventForm from "../../../_components/EventForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Occurrence | My Happenings",
};

interface PageProps {
  params: Promise<{ id: string; dateKey: string }>;
}

export default async function EditOccurrencePage({ params }: PageProps) {
  const { id: eventId, dateKey } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();
  if (sessionUserError || !sessionUser) redirect("/login");

  // Validate dateKey format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    notFound();
  }

  const isAdmin = await checkAdminRole(supabase, sessionUser.id);

  // Fetch event with venue
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      venues(id, name, address, city, state, google_maps_url, map_link, website_url),
      event_hosts(user_id, invitation_status)
    `)
    .eq("id", eventId)
    .single();

  if (error || !event) {
    console.error("[EditOccurrencePage] Event fetch error:", error);
    notFound();
  }

  // Authorization check
  const isEventOwner = event.host_id === sessionUser.id;
  const hosts = event.event_hosts as Array<{ user_id: string; invitation_status: string }> | null;
  const isAcceptedHost = hosts?.some(
    (h) => h.user_id === sessionUser.id && h.invitation_status === "accepted"
  );

  if (!isAdmin && !isEventOwner && !isAcceptedHost) {
    redirect("/dashboard");
  }

  // Fetch existing override for this date_key
  const { data: existingOverride } = await supabase
    .from("occurrence_overrides")
    .select("*")
    .eq("event_id", eventId)
    .eq("date_key", dateKey)
    .maybeSingle();

  // Fetch venues for the selector
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, address, city, state, google_maps_url, map_link, website_url")
    .order("name", { ascending: true });

  // Build the effective event state by merging base event with override_patch
  const overridePatch = (existingOverride as Record<string, unknown> | null)?.override_patch as Record<string, unknown> | null;
  const effectiveEvent = {
    ...event,
    // Apply legacy override columns
    ...(existingOverride?.override_start_time && { start_time: existingOverride.override_start_time }),
    ...(existingOverride?.override_cover_image_url && { cover_image_url: existingOverride.override_cover_image_url }),
    ...(existingOverride?.override_notes && { host_notes: existingOverride.override_notes }),
    // Apply override_patch keys on top
    ...(overridePatch || {}),
  };

  // Load override-scoped media embeds (falls back to base event embeds)
  let overrideMediaEmbedUrls: string[] = [];
  try {
    const embeds = await readEventEmbedsWithFallback(supabase, eventId, dateKey);
    overrideMediaEmbedUrls = embeds.map((e: { url: string }) => e.url);
  } catch { /* non-fatal */ }

  const todayKey = getTodayDenver();
  const dateLabel = formatDateGroupHeader(dateKey, todayKey);

  // Expand occurrences for conflict detection when rescheduling
  const windowEnd = addDaysDenver(todayKey, 90);
  const existingOccurrences = expandOccurrencesForEvent(
    {
      event_date: event.event_date,
      day_of_week: event.day_of_week,
      recurrence_rule: (event as { recurrence_rule?: string | null }).recurrence_rule,
      start_time: event.start_time,
      max_occurrences: (event as { max_occurrences?: number | null }).max_occurrences,
      custom_dates: (event as { custom_dates?: string[] | null }).custom_dates,
    },
    { startKey: todayKey, endKey: windowEnd }
  );
  // Also fetch other overrides that have reschedule targets (event_date in patch)
  const { data: otherOverrides } = await supabase
    .from("occurrence_overrides")
    .select("date_key, override_patch")
    .eq("event_id", eventId)
    .neq("date_key", dateKey);
  const rescheduleTargets = (otherOverrides || [])
    .map((o) => (o.override_patch as Record<string, unknown> | null)?.event_date as string | undefined)
    .filter((d): d is string => !!d);
  // Combine series dates + other reschedule targets, exclude current dateKey
  const existingOccurrenceDates = [
    ...existingOccurrences.map((o) => o.dateKey),
    ...rescheduleTargets,
  ].filter((d) => d !== dateKey);

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/my-events/${eventId}/overrides`}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-2 inline-block"
          >
            ← Back to Occurrences
          </Link>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Edit: {dateLabel}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {event.title} — {dateKey}
          </p>
        </div>

        {/* Occurrence Mode Banner */}
        <div className="p-4 bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-lg mb-6">
          <p className="text-sm text-amber-800 dark:text-amber-400">
            You are editing a single occurrence. Changes here only affect{" "}
            <strong>{dateLabel}</strong> — the series schedule remains unchanged.
          </p>
        </div>

        {/* Event Form in Occurrence Mode */}
        <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <EventForm
            mode="edit"
            venues={venues ?? []}
            event={effectiveEvent}
            canCreateCSC={false}
            canCreateVenue={isAdmin}
            mediaEmbedUrls={overrideMediaEmbedUrls}
            occurrenceMode={true}
            occurrenceDateKey={dateKey}
            occurrenceEventId={eventId}
            existingOccurrenceDates={existingOccurrenceDates}
          />
        </section>
      </div>
    </main>
  );
}
