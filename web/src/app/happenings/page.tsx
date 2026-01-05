import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HappeningsCard, DateSection, StickyControls, BackToTop } from "@/components/happenings";
import { PageContainer } from "@/components/layout/page-container";
import { HeroSection } from "@/components/layout/hero-section";
import { BetaBanner } from "@/components/happenings/BetaBanner";
import {
  getTodayDenver,
  addDaysDenver,
  formatDateGroupHeader,
  expandAndGroupEvents,
  buildOverrideMap,
  type EventOccurrenceEntry,
} from "@/lib/events/nextOccurrence";

export const metadata: Metadata = {
  title: "Happenings | Denver Songwriters Collective",
  description: "Discover open mics, events, and shows in the Denver music community.",
};

export const dynamic = "force-dynamic";

/**
 * Phase 4.21 Search Params:
 * - q: search query (matches title, description, venue_name, venue_address, custom_location_*)
 * - time: upcoming|past|all
 * - type: event_type (open_mic, showcase, workshop, etc.)
 * - dsc: 1 = DSC events only
 * - verify: verified|needs_verification
 * - location: venue|online|hybrid
 * - cost: free|paid|unknown
 * - days: comma-separated day abbreviations (mon,tue,wed,etc.)
 * - showCancelled: 1 = show cancelled occurrences (default: hidden)
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
  showCancelled?: string;
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
  // Show cancelled occurrences (default: hidden)
  const showCancelled = params.showCancelled === "1";

  const today = getTodayDenver();
  // 90-day window for occurrence expansion
  const windowEnd = addDaysDenver(today, 90);

  // Build base query with venue join for search
  let query = supabase
    .from("events")
    .select(`
      *,
      venues!left(name, address, city, state)
    `)
    .eq("is_published", true)
    .in("status", ["active", "needs_verification"]);

  // Fetch occurrence overrides for the window
  // This runs in parallel with the events query
  const { data: overridesData } = await supabase
    .from("occurrence_overrides")
    .select("event_id, date_key, status, override_start_time, override_cover_image_url, override_notes")
    .gte("date_key", today)
    .lte("date_key", windowEnd);

  const overrideMap = buildOverrideMap(
    (overridesData || []).map(o => ({
      event_id: o.event_id,
      date_key: o.date_key,
      status: o.status as "normal" | "cancelled",
      override_start_time: o.override_start_time,
      override_cover_image_url: o.override_cover_image_url,
      override_notes: o.override_notes,
    }))
  );

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
  // For "upcoming" and "all", we filter client-side based on occurrence expansion
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

  // Phase 4.21: Expand occurrences within 90-day window with override support
  // This allows one event to appear on multiple dates (e.g., every Wednesday)
  // Cancelled occurrences are tracked separately for toggle control
  const {
    groupedEvents: expandedGroups,
    cancelledOccurrences,
    unknownEvents,
    metrics: expansionMetrics,
  } = expandAndGroupEvents(
    list as any[],
    {
      startKey: today,
      endKey: windowEnd,
      maxOccurrences: 40,
      overrideMap,
    }
  );

  // Filter to only upcoming occurrences for "upcoming" view
  let filteredGroups = expandedGroups;
  if (timeFilter === "upcoming") {
    filteredGroups = new Map(
      [...expandedGroups.entries()].filter(([dateKey]) => dateKey >= today)
    );
  }

  // Sort unknown schedule events alphabetically by title
  const sortedUnknownEvents = [...unknownEvents].sort((a: any, b: any) => {
    const titleA = a.title || "";
    const titleB = b.title || "";
    return titleA.localeCompare(titleB);
  });

  // Phase 4.23: Group cancelled occurrences by date for Today/Tomorrow disclosure
  const tomorrow = addDaysDenver(today, 1);
  const cancelledByDate = new Map<string, EventOccurrenceEntry<any>[]>();
  for (const entry of cancelledOccurrences) {
    const dateKey = entry.dateKey;
    // Only group Today and Tomorrow for disclosure; other dates go to the main cancelled section
    if (dateKey === today || dateKey === tomorrow) {
      if (!cancelledByDate.has(dateKey)) {
        cancelledByDate.set(dateKey, []);
      }
      cancelledByDate.get(dateKey)!.push(entry);
    }
  }
  // Cancelled occurrences that are NOT Today/Tomorrow (shown in main cancelled section)
  const otherCancelledOccurrences = cancelledOccurrences.filter(
    (entry) => entry.dateKey !== today && entry.dateKey !== tomorrow
  );

  // Count total occurrences for display
  let totalOccurrences = 0;
  for (const entries of filteredGroups.values()) {
    totalOccurrences += entries.length;
  }
  const totalDisplayableEvents = totalOccurrences + sortedUnknownEvents.length;
  const totalDates = filteredGroups.size + (sortedUnknownEvents.length > 0 ? 1 : 0);

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

  // Build filter summary for results display
  const getFilterSummary = (): string[] => {
    const parts: string[] = [];
    if (searchQuery) parts.push(`"${searchQuery}"`);
    if (typeFilter) {
      const labels: Record<string, string> = {
        open_mic: "Open Mics",
        shows: "Shows",
        showcase: "Showcases",
        workshop: "Workshops",
        song_circle: "Song Circles",
        gig: "Gigs",
        other: "Other",
      };
      parts.push(labels[typeFilter] || typeFilter);
    }
    if (dscFilter) parts.push("DSC Events");
    if (locationFilter) {
      const labels: Record<string, string> = { venue: "In-person", online: "Online", hybrid: "Hybrid" };
      parts.push(labels[locationFilter] || locationFilter);
    }
    if (costFilter) {
      const labels: Record<string, string> = { free: "Free", paid: "Paid", unknown: "Unknown cost" };
      parts.push(labels[costFilter] || costFilter);
    }
    if (daysFilter.length > 0) {
      const dayLabels = daysFilter.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(", ");
      parts.push(dayLabels);
    }
    if (timeFilter && timeFilter !== "upcoming") {
      parts.push(timeFilter === "past" ? "Past" : "All time");
    }
    return parts;
  };

  const filterSummary = getFilterSummary();

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
        {/* Beta warning banner - refined, dismissible per session */}
        <BetaBanner className="mb-4" />

        {/* Community CTA - condensed */}
        <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-center">
          <div className="flex flex-wrap gap-2 justify-center items-center">
            <span className="text-[var(--color-text-secondary)] text-sm">
              Help keep this directory accurate:
            </span>
            {typeFilter === "open_mic" ? (
              <Link
                href="/submit-open-mic"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-sm font-medium hover:opacity-90 transition"
              >
                + Add Open Mic
              </Link>
            ) : (
              <Link
                href="/dashboard/my-events/new"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-sm font-medium hover:opacity-90 transition"
              >
                + Add Event
              </Link>
            )}
            <Link
              href="/submit-open-mic"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-sm hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition"
            >
              Correction
            </Link>
          </div>
        </div>

        {/* Page header with title */}
        {!showHero && pageTitle && (
          <h1 className="text-2xl md:text-3xl font-[var(--font-family-display)] font-bold text-[var(--color-text-primary)] mb-3">
            {pageTitle}
          </h1>
        )}

        {/* Sticky Filter + Jump Controls */}
        <Suspense fallback={<div className="h-32 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse" />}>
          <StickyControls
            todayKey={today}
            windowEndKey={windowEnd}
            cancelledCount={expansionMetrics.cancelledCount}
          />
        </Suspense>

        {/* Results summary - under sticky controls */}
        <div className="py-3 text-sm text-[var(--color-text-secondary)]">
          <span className="font-medium text-[var(--color-text-primary)]">
            {totalDisplayableEvents} {totalDisplayableEvents === 1 ? "event" : "events"}
          </span>
          {" "}across{" "}
          <span className="font-medium text-[var(--color-text-primary)]">{totalDates}</span>
          {" "}{totalDates === 1 ? "date" : "dates"}
          {" "}(next 90 days)
          {filterSummary.length > 0 && (
            <span className="ml-2 text-[var(--color-text-tertiary)]">
              · Filtered by: {filterSummary.join(", ")}
            </span>
          )}
        </div>

        {/* Phase 4.19: Date-grouped list with collapsible sections */}
        {totalDisplayableEvents > 0 ? (
          <div className="space-y-0">
            {/* Dated occurrences grouped by date */}
            {[...filteredGroups].map(([dateStr, entriesForDate]) => {
              // Phase 4.23: For Today/Tomorrow, pass cancelled occurrences for disclosure
              const isTodayOrTomorrow = dateStr === today || dateStr === tomorrow;
              const cancelledForDate = showCancelled && isTodayOrTomorrow
                ? cancelledByDate.get(dateStr) || []
                : [];

              return (
                <DateSection
                  key={dateStr}
                  dateKey={dateStr}
                  headerText={formatDateGroupHeader(dateStr, today)}
                  eventCount={entriesForDate.length}
                  cancelledCount={cancelledForDate.length}
                  cancelledChildren={
                    cancelledForDate.length > 0
                      ? cancelledForDate.map((entry: EventOccurrenceEntry<any>) => (
                          <HappeningsCard
                            key={`${entry.event.id}-${entry.dateKey}-cancelled`}
                            event={entry.event}
                            searchQuery={searchQuery}
                            debugDates={debugDates}
                            occurrence={{
                              date: entry.dateKey,
                              isToday: entry.dateKey === today,
                              isTomorrow: entry.dateKey === tomorrow,
                              isConfident: entry.isConfident,
                            }}
                            todayKey={today}
                            override={entry.override}
                            isCancelled={true}
                          />
                        ))
                      : undefined
                  }
                >
                  {entriesForDate.map((entry: EventOccurrenceEntry<any>) => (
                    <HappeningsCard
                      key={`${entry.event.id}-${entry.dateKey}`}
                      event={entry.event}
                      searchQuery={searchQuery}
                      debugDates={debugDates}
                      occurrence={{
                        date: entry.dateKey,
                        isToday: entry.dateKey === today,
                        isTomorrow: entry.dateKey === tomorrow,
                        isConfident: entry.isConfident,
                      }}
                      todayKey={today}
                      override={entry.override}
                      isCancelled={entry.isCancelled}
                    />
                  ))}
                </DateSection>
              );
            })}

            {/* Schedule Unknown section - appears after all dated sections */}
            {sortedUnknownEvents.length > 0 && (
              <DateSection
                dateKey="unknown"
                headerText="Schedule unknown"
                eventCount={sortedUnknownEvents.length}
                isUnknown
                description="These events are missing schedule information. Please verify with the venue."
              >
                {sortedUnknownEvents.map((event: any) => (
                  <HappeningsCard
                    key={event.id}
                    event={event}
                    searchQuery={searchQuery}
                    debugDates={debugDates}
                    occurrence={{
                      date: today,
                      isToday: true,
                      isTomorrow: false,
                      isConfident: false,
                    }}
                    todayKey={today}
                  />
                ))}
              </DateSection>
            )}

            {/* Phase 4.21/4.23: Cancelled occurrences section - only for non-Today/Tomorrow */}
            {/* Today/Tomorrow cancelled are shown inline via disclosure rows */}
            {showCancelled && otherCancelledOccurrences.length > 0 && (
              <DateSection
                dateKey="cancelled"
                headerText="Cancelled"
                eventCount={otherCancelledOccurrences.length}
                isCancelled
                description="These occurrences have been cancelled. They may be rescheduled in the future."
              >
                {otherCancelledOccurrences.map((entry: EventOccurrenceEntry<any>) => (
                  <HappeningsCard
                    key={`${entry.event.id}-${entry.dateKey}-cancelled`}
                    event={entry.event}
                    searchQuery={searchQuery}
                    debugDates={debugDates}
                    occurrence={{
                      date: entry.dateKey,
                      isToday: entry.dateKey === today,
                      isTomorrow: entry.dateKey === tomorrow,
                      isConfident: entry.isConfident,
                    }}
                    todayKey={today}
                    override={entry.override}
                    isCancelled={true}
                  />
                ))}
              </DateSection>
            )}
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

        {/* Phase 4.38: Back to top button - appears when scrolling down */}
        <BackToTop />
      </PageContainer>
    </>
  );
}
