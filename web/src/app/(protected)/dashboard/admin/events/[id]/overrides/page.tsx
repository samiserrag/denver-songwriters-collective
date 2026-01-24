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
import OccurrenceOverrideList from "./_components/OccurrenceOverrideList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Occurrence Overrides | Admin",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ showCancelled?: string }>;
}

export default async function OverridesPage({ params, searchParams }: PageProps) {
  const { id: eventId } = await params;
  const { showCancelled } = await searchParams;
  const showCancelledFlag = showCancelled === "1";

  const supabase = await createSupabaseServerClient();

  // Check admin role
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const isAdmin = await checkAdminRole(supabase, session.user.id);
  if (!isAdmin) redirect("/dashboard");

  // Fetch event
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
      cover_image_url,
      custom_dates,
      max_occurrences,
      venues(id, name)
    `)
    .eq("id", eventId)
    .single();

  if (error || !event) {
    console.error("[OverridesPage] Event fetch error:", error);
    notFound();
  }

  // Build date window for occurrence expansion
  const todayKey = getTodayDenver();
  const isCustomSchedule = event.recurrence_rule === "custom" && Array.isArray(event.custom_dates) && event.custom_dates.length > 0;

  // For custom schedules: span the full date range (past + future)
  // For weekly/monthly: use next 90 days (standard)
  let windowStartKey: string;
  let windowEndKey: string;

  if (isCustomSchedule) {
    const sortedDates = [...event.custom_dates].sort();
    windowStartKey = sortedDates[0]; // earliest date in array
    windowEndKey = sortedDates[sortedDates.length - 1]; // latest date in array
  } else {
    windowStartKey = todayKey;
    windowEndKey = addDaysDenver(todayKey, 90);
  }

  // Expand occurrences for this event
  const occurrences = expandOccurrencesForEvent(
    {
      event_date: event.event_date,
      day_of_week: event.day_of_week,
      recurrence_rule: event.recurrence_rule,
      start_time: event.start_time,
      custom_dates: event.custom_dates,
      max_occurrences: event.max_occurrences,
    },
    { startKey: windowStartKey, endKey: windowEndKey, maxOccurrences: 40 }
  );

  // Fetch existing overrides for this event in the window
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

  // Split into normal and cancelled
  const normalOccurrences = mergedOccurrences.filter((o) => !o.isCancelled);
  const cancelledOccurrences = mergedOccurrences.filter((o) => o.isCancelled);

  const recurrenceSummary = getRecurrenceSummary(
    event.recurrence_rule,
    event.day_of_week,
    event.event_date
  );

  const venueName = (event.venues as unknown as { name: string } | null)?.name ?? "TBA";

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/admin/events/${eventId}/edit`}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-2 inline-block"
        >
          ← Back to Edit Event
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Overrides for: {event.title}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {recurrenceSummary} at {venueName}
        </p>
      </div>

      {/* Explainer */}
      <div className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg mb-6">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Use this page to cancel or adjust a single date without changing the
          series. Changes here only affect the specific occurrence, not the
          recurring schedule.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Show Cancelled Toggle */}
          <Link
            href={
              showCancelledFlag
                ? `/dashboard/admin/events/${eventId}/overrides`
                : `/dashboard/admin/events/${eventId}/overrides?showCancelled=1`
            }
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              showCancelledFlag
                ? "bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-400"
                : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {cancelledOccurrences.length} cancelled
          </Link>
        </div>

        <p className="text-sm text-[var(--color-text-tertiary)]">
          {isCustomSchedule
            ? `Showing all dates in this custom schedule (${mergedOccurrences.length} occurrences)`
            : `Showing next 90 days (${mergedOccurrences.length} occurrences)`}
        </p>
      </div>

      {/* Occurrence List */}
      <OccurrenceOverrideList
        eventId={eventId}
        eventSlug={event.slug}
        eventTitle={event.title}
        baseStartTime={event.start_time}
        baseCoverImageUrl={event.cover_image_url}
        occurrences={showCancelledFlag ? mergedOccurrences : normalOccurrences}
      />

      {/* Cancelled Section (when toggle is on) */}
      {showCancelledFlag && cancelledOccurrences.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-red-500 rounded-full" />
            Cancelled Occurrences ({cancelledOccurrences.length})
          </h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            These dates are cancelled and hidden from public view.
          </p>
        </div>
      )}
    </div>
  );
}
