import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HappeningsCard } from "@/components/happenings";
import { HappeningsFilters } from "@/components/happenings/HappeningsFilters";
import { PageContainer } from "@/components/layout/page-container";
import { HeroSection } from "@/components/layout/hero-section";
import {
  getTodayDenver,
  formatDateGroupHeader,
  computeNextOccurrence,
  type NextOccurrenceResult,
} from "@/lib/events/nextOccurrence";

export const metadata: Metadata = {
  title: "Happenings | Denver Songwriters Collective",
  description: "Discover open mics, events, and shows in the Denver music community.",
};

export const dynamic = "force-dynamic";

/**
 * Phase 4.17 Search Params:
 * - q: search query (matches title, description, venue_name, venue_address, custom_location_*)
 * - time: upcoming|past|all
 * - type: event_type (open_mic, showcase, workshop, etc.)
 * - dsc: 1 = DSC events only
 * - verify: verified|needs_verification
 * - location: venue|online|hybrid
 * - cost: free|paid|unknown
 * - days: comma-separated day abbreviations (mon,tue,wed,etc.)
 */
interface HappeningsSearchParams {
  q?: string;
  time?: string;
  type?: string;
  dsc?: string;
  verify?: string;
  location?: string;
  cost?: string;
  days?: string;
  debugDates?: string;
}

export default async function HappeningsPage({
  searchParams,
}: {
  searchParams: Promise<HappeningsSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  // Extract all filter params
  const searchQuery = params.q || "";
  const timeFilter = params.time || "upcoming";
  const typeFilter = params.type || "";
  const dscFilter = params.dsc === "1";
  const verifyFilter = params.verify || "";
  const locationFilter = params.location || "";
  const costFilter = params.cost || "";
  // Day-of-week filter (comma-separated abbreviations: mon,tue,wed,etc.)
  const daysFilter = params.days ? params.days.split(",").map(d => d.trim().toLowerCase()) : [];
  // Debug mode for date computation visualization
  const debugDates = params.debugDates === "1";

  const today = getTodayDenver();

  // Build base query with venue join for search
  let query = supabase
    .from("events")
    .select(`
      *,
      venues!left(name, address, city, state)
    `)
    .eq("is_published", true)
    .in("status", ["active", "needs_verification"]);

  // Type filter (event_type)
  if (typeFilter === "open_mic") {
    query = query.eq("event_type", "open_mic");
  } else if (typeFilter === "shows") {
    // "Shows" covers showcases, gigs, and other performances (not open mics, workshops, or song circles)
    query = query.in("event_type", ["showcase", "gig", "other"]);
  } else if (typeFilter === "showcase") {
    query = query.eq("event_type", "showcase");
  } else if (typeFilter === "workshop") {
    query = query.eq("event_type", "workshop");
  } else if (typeFilter === "song_circle") {
    query = query.eq("event_type", "song_circle");
  } else if (typeFilter === "gig") {
    query = query.eq("event_type", "gig");
  } else if (typeFilter === "other") {
    query = query.eq("event_type", "other");
  }

  // DSC filter
  if (dscFilter) {
    query = query.eq("is_dsc_event", true);
  }

  // Verification status filter
  if (verifyFilter === "verified") {
    query = query.eq("status", "active");
  } else if (verifyFilter === "needs_verification") {
    query = query.eq("status", "needs_verification");
  }

  // Location mode filter
  if (locationFilter === "venue") {
    query = query.eq("location_mode", "venue");
  } else if (locationFilter === "online") {
    query = query.eq("location_mode", "online");
  } else if (locationFilter === "hybrid") {
    query = query.eq("location_mode", "hybrid");
  }

  // Cost filter
  if (costFilter === "free") {
    query = query.eq("is_free", true);
  } else if (costFilter === "paid") {
    query = query.eq("is_free", false);
  } else if (costFilter === "unknown") {
    query = query.is("is_free", null);
  }

  // For "past" filter, only get events with event_date < today
  // For "upcoming" and "all", we filter client-side based on next occurrence
  if (timeFilter === "past") {
    query = query.lt("event_date", today);
  }

  const { data: events, error } = await query;

  if (error) {
    console.error("Error fetching happenings:", error);
  }

  let list = (events || []) as any[];

  // Client-side search filtering (case-insensitive across multiple fields)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter((event: any) => {
      const titleMatch = event.title?.toLowerCase().includes(q);
      const descMatch = event.description?.toLowerCase().includes(q);
      const venueNameMatch = event.venue_name?.toLowerCase().includes(q);
      const venueAddrMatch = event.venue_address?.toLowerCase().includes(q);
      const customLocMatch = event.custom_location_name?.toLowerCase().includes(q);
      const customCityMatch = event.custom_city?.toLowerCase().includes(q);
      const customStateMatch = event.custom_state?.toLowerCase().includes(q);
      const joinedVenueName = event.venues?.name?.toLowerCase().includes(q);
      const joinedVenueAddr = event.venues?.address?.toLowerCase().includes(q);
      const joinedVenueCity = event.venues?.city?.toLowerCase().includes(q);
      const joinedVenueState = event.venues?.state?.toLowerCase().includes(q);

      return (
        titleMatch ||
        descMatch ||
        venueNameMatch ||
        venueAddrMatch ||
        customLocMatch ||
        customCityMatch ||
        customStateMatch ||
        joinedVenueName ||
        joinedVenueAddr ||
        joinedVenueCity ||
        joinedVenueState
      );
    });
  }

  // Day-of-week filtering
  const dayAbbrevMap: Record<string, { full: string; index: number }> = {
    sun: { full: "Sunday", index: 0 },
    mon: { full: "Monday", index: 1 },
    tue: { full: "Tuesday", index: 2 },
    wed: { full: "Wednesday", index: 3 },
    thu: { full: "Thursday", index: 4 },
    fri: { full: "Friday", index: 5 },
    sat: { full: "Saturday", index: 6 },
  };

  if (daysFilter.length > 0) {
    const targetDays = daysFilter
      .map(abbr => dayAbbrevMap[abbr])
      .filter(Boolean);
    const targetFullDays = targetDays.map(d => d.full.toLowerCase());
    const targetDayIndices = targetDays.map(d => d.index);

    list = list.filter((event: any) => {
      // For recurring events: check day_of_week field
      if (event.day_of_week) {
        const eventDay = event.day_of_week.trim().toLowerCase();
        return targetFullDays.includes(eventDay);
      }
      // For dated events: derive day from event_date
      if (event.event_date) {
        const date = new Date(event.event_date + "T00:00:00");
        const dayIndex = date.getDay();
        return targetDayIndices.includes(dayIndex);
      }
      return false;
    });
  }

  // Phase 4.17.5: Compute occurrences ONCE with canonical todayKey
  // This ensures all events use the same date context for grouping and display
  type EventWithOccurrence = {
    event: (typeof list)[0];
    occurrence: NextOccurrenceResult;
  };

  let eventsWithOccurrences: EventWithOccurrence[] = list.map((event: any) => ({
    event,
    occurrence: computeNextOccurrence(event, { todayKey: today }),
  }));

  // Phase 4.17: Filter by next occurrence for "upcoming" view
  if (timeFilter === "upcoming") {
    eventsWithOccurrences = eventsWithOccurrences.filter(
      ({ occurrence }) => occurrence.date >= today
    );
  }

  // Sort all events by their next occurrence date, then by start_time
  eventsWithOccurrences.sort((a, b) => {
    // First sort by date
    const dateCompare = a.occurrence.date.localeCompare(b.occurrence.date);
    if (dateCompare !== 0) return dateCompare;

    // Then by start_time (null times go last)
    const timeA = a.event.start_time || "99:99";
    const timeB = b.event.start_time || "99:99";
    return timeA.localeCompare(timeB);
  });

  // Group events by next occurrence date (using pre-computed occurrence)
  const groupedEvents = new Map<string, EventWithOccurrence[]>();
  for (const item of eventsWithOccurrences) {
    const dateKey = item.occurrence.date;
    if (!groupedEvents.has(dateKey)) {
      groupedEvents.set(dateKey, []);
    }
    groupedEvents.get(dateKey)!.push(item);
  }

  // Sort groups by date (chronological order)
  const sortedGroupedEvents = new Map(
    [...groupedEvents.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );

  // DEV INVARIANT: Verify every event's occurrence.date matches its group key
  // This catches any mismatch that would cause "Friday card in Tomorrow group"
  if (process.env.NODE_ENV === "development") {
    for (const [groupDateKey, items] of sortedGroupedEvents) {
      for (const item of items) {
        if (item.occurrence.date !== groupDateKey) {
          console.error(
            `[INVARIANT VIOLATION] Event "${item.event.title}" (${item.event.id}) ` +
            `has occurrence.date="${item.occurrence.date}" but is grouped under "${groupDateKey}". ` +
            `This should never happen - check computeNextOccurrence logic.`
          );
        }
      }
    }
  }

  // Hero only shows on unfiltered /happenings (no filters active)
  const hasFilters = searchQuery || typeFilter || dscFilter || verifyFilter || locationFilter || costFilter || daysFilter.length > 0 || timeFilter !== "upcoming";
  const showHero = !hasFilters;

  // Page title based on active type filter
  const getPageTitle = () => {
    if (typeFilter === "open_mic") return "Open Mics";
    if (typeFilter === "shows") return "Shows";
    if (typeFilter === "showcase") return "Showcases";
    if (typeFilter === "workshop") return "Workshops";
    if (typeFilter === "song_circle") return "Song Circles";
    if (typeFilter === "gig") return "Gigs";
    if (dscFilter) return "DSC Events";
    return null;
  };

  const pageTitle = getPageTitle();

  return (
    <>
      {showHero && (
        <HeroSection minHeight="sm" showVignette showBottomFade>
          <div className="text-center px-4 py-6">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-display)] font-bold text-white tracking-tight drop-shadow-lg">
              Happenings
            </h1>
            <p className="text-lg text-white/80 mt-2 drop-shadow">
              Open mics, events, and shows in the Denver music community
            </p>
          </div>
        </HeroSection>
      )}

      <PageContainer className={showHero ? "" : "pt-8"}>
        {/* Community CTA - shows on all views */}
        <div className="mb-6 p-5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-center">
          <p className="text-[var(--color-text-secondary)] text-sm mb-3">
            This directory is maintained by our community. Help us keep it accurate!
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            {typeFilter === "open_mic" ? (
              <Link
                href="/submit-open-mic"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-sm font-medium hover:opacity-90 transition"
              >
                + Add an Open Mic
              </Link>
            ) : (
              <Link
                href="/dashboard/my-events/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-sm font-medium hover:opacity-90 transition"
              >
                + Create a Happening
              </Link>
            )}
            <Link
              href="/submit-open-mic"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-sm hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition"
            >
              Submit a Correction
            </Link>
          </div>
          <p className="text-[var(--color-text-tertiary)] text-xs">
            Are you a host? <Link href="/dashboard/my-events" className="text-[var(--color-link)] hover:underline">Claim your listing</Link> to manage it directly.
          </p>
        </div>

        {/* Page header with title */}
        {!showHero && pageTitle && (
          <h1 className="text-3xl md:text-4xl font-[var(--font-family-display)] font-bold text-[var(--color-text-primary)] mb-4">
            {pageTitle}
          </h1>
        )}

        {/* Filter bar - wrapped in Suspense for useSearchParams */}
        <Suspense fallback={<div className="h-32 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse" />}>
          <HappeningsFilters className="mb-6" />
        </Suspense>

        {/* Results count */}
        {(searchQuery || hasFilters) && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            {eventsWithOccurrences.length} {eventsWithOccurrences.length === 1 ? "result" : "results"} found
          </p>
        )}

        {/* Phase 4.17: Date-grouped list with sticky headers */}
        {eventsWithOccurrences.length > 0 ? (
          <div className="space-y-1">
            {[...sortedGroupedEvents].map(([dateStr, itemsForDate]) => (
              <section key={dateStr} className="relative">
                {/* Sticky date header
                    - top-16 accounts for 64px site header (h-16)
                    - z-30 keeps it above cards but below nav (z-50)
                    - Background matches page with blur for elegance
                */}
                <div
                  className="sticky top-16 z-30 py-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border-default)]"
                >
                  <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                    <span className="w-1 h-6 bg-[var(--color-accent-primary)] rounded-full" aria-hidden="true" />
                    {formatDateGroupHeader(dateStr, today)}
                    <span className="text-base font-normal text-[var(--color-text-secondary)]">
                      ({itemsForDate.length})
                    </span>
                  </h2>
                </div>

                {/* Event cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 pt-4 pb-6">
                  {itemsForDate.map(({ event, occurrence }) => (
                    <HappeningsCard
                      key={event.id}
                      event={event}
                      searchQuery={searchQuery}
                      debugDates={debugDates}
                      occurrence={occurrence}
                      todayKey={today}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[var(--color-text-secondary)]">
              {searchQuery || hasFilters
                ? "No happenings match your filters. Try adjusting your search."
                : "No happenings found. Check back soon!"}
            </p>
          </div>
        )}
      </PageContainer>
    </>
  );
}
