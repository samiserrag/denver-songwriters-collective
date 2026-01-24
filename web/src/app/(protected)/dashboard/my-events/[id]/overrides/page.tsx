import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import {
  getTodayDenver,
  addDaysDenver,
  expandOccurrencesForEvent,
  buildOverrideMap,
  type OccurrenceOverride,
} from "@/lib/events/nextOccurrence";
import { getRecurrenceSummary } from "@/lib/recurrenceHumanizer";
import OccurrenceEditor from "./_components/OccurrenceEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manage Occurrences | My Happenings",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function HostOverridesPage({ params }: PageProps) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Check authorization: admin, host, or event owner
  const isAdmin = await checkAdminRole(supabase, session.user.id);

  // Fetch event with hosts
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      id,
      slug,
      title,
      day_of_week,
      recurrence_rule,
      event_date,
      is_recurring,
      start_time,
      end_time,
      cover_image_url,
      custom_dates,
      max_occurrences,
      host_id,
      venue_id,
      venues(id, name),
      event_hosts(user_id, invitation_status)
    `)
    .eq("id", eventId)
    .single();

  if (error || !event) {
    console.error("[HostOverridesPage] Event fetch error:", error);
    notFound();
  }

  // Authorization check
  const isEventOwner = event.host_id === session.user.id;
  const hosts = event.event_hosts as Array<{ user_id: string; invitation_status: string }> | null;
  const isAcceptedHost = hosts?.some(
    (h) => h.user_id === session.user.id && h.invitation_status === "accepted"
  );

  if (!isAdmin && !isEventOwner && !isAcceptedHost) {
    redirect("/dashboard");
  }

  // Build date window for occurrence expansion
  const todayKey = getTodayDenver();
  const isCustomSchedule =
    event.recurrence_rule === "custom" &&
    Array.isArray(event.custom_dates) &&
    event.custom_dates.length > 0;

  let windowStartKey: string;
  let windowEndKey: string;

  if (isCustomSchedule) {
    const sortedDates = [...event.custom_dates].sort();
    windowStartKey = sortedDates[0];
    windowEndKey = sortedDates[sortedDates.length - 1];
  } else {
    windowStartKey = todayKey;
    windowEndKey = addDaysDenver(todayKey, 90);
  }

  // Expand occurrences
  const occurrences = expandOccurrencesForEvent(
    {
      event_date: event.event_date,
      day_of_week: event.day_of_week,
      recurrence_rule: event.recurrence_rule,
      start_time: event.start_time,
      custom_dates: event.custom_dates,
      max_occurrences: event.max_occurrences,
    },
    { startKey: windowStartKey, endKey: windowEndKey, maxOccurrences: 60 }
  );

  // Fetch existing overrides
  const { data: overridesData } = await supabase
    .from("occurrence_overrides")
    .select("*")
    .eq("event_id", eventId)
    .gte("date_key", windowStartKey)
    .lte("date_key", windowEndKey);

  const overrides = (overridesData || []) as OccurrenceOverride[];
  const overrideMap = buildOverrideMap(overrides);

  // Merge occurrences with overrides
  const mergedOccurrences = occurrences.map((occ) => {
    const key = `${eventId}:${occ.dateKey}`;
    const override = overrideMap.get(key);
    return {
      dateKey: occ.dateKey,
      isConfident: occ.isConfident,
      override: override || null,
      isCancelled: override?.status === "cancelled",
    };
  });

  const recurrenceSummary = getRecurrenceSummary(
    event.recurrence_rule,
    event.day_of_week,
    event.event_date
  );

  const venueName = (event.venues as unknown as { name: string } | null)?.name ?? "TBA";

  // Serialize the base event fields needed for the occurrence editor form
  const baseEvent = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    start_time: event.start_time,
    end_time: event.end_time,
    cover_image_url: event.cover_image_url,
    venue_id: event.venue_id,
  };

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/my-events/${eventId}`}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-2 inline-block"
        >
          ← Back to Edit Happening
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Manage Occurrences: {event.title}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {recurrenceSummary} at {venueName}
        </p>
      </div>

      {/* Explainer */}
      <div className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg mb-6">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Edit a specific date without changing the series. Changes here only
          affect the selected occurrence — the recurring schedule stays the same.
        </p>
      </div>

      {/* Window info */}
      <div className="flex items-center justify-end mb-6">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {isCustomSchedule
            ? `Showing all dates in this custom schedule (${mergedOccurrences.length} occurrences)`
            : `Showing next 90 days (${mergedOccurrences.length} occurrences)`}
        </p>
      </div>

      {/* Occurrence List */}
      <OccurrenceEditor
        eventId={eventId}
        baseEvent={baseEvent}
        occurrences={mergedOccurrences}
      />
    </div>
  );
}
