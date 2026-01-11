import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HappeningsCard, DateSection, StickyControls, BackToTop } from "@/components/happenings";
import { SeriesView, type SeriesEvent } from "@/components/happenings/SeriesView";
import { type HappeningsViewMode } from "@/components/happenings/StickyControls";
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
 * - pastOffset: number of 90-day chunks to go back for progressive loading (default: 0)
 * - view: timeline|series (Phase 4.54, default: timeline)
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
  pastOffset?: string;
  view?: string;
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
  // Progressive loading offset for past events (each offset = 90 days further back)
  const pastOffset = parseInt(params.pastOffset || "0", 10) || 0;
  // Phase 4.54: View mode (timeline = grouped by date, series = grouped by event)
  const viewMode: HappeningsViewMode = params.view === "series" ? "series" : "timeline";

  const today = getTodayDenver();
  const yesterday = addDaysDenver(today, -1);

  // Phase 4.50b: Compute window bounds based on timeFilter
  // - upcoming: today → today+90
  // - past: minEventDate → yesterday (with progressive loading via pastOffset)
  // - all: minEventDate → today+90
  let windowStart = today;
  let windowEnd = addDaysDenver(today, 90);
  let hasMorePastEvents = false;

  if (timeFilter === "past" || timeFilter === "all") {
    // Query MIN(event_date) to find the oldest event
    const { data: minDateResult } = await supabase
      .from("events")
      .select("event_date")
      .eq("is_published", true)
      .in("status", ["active", "needs_verification"])
      .not("event_date", "is", null)
      .order("event_date", { ascending: true })
      .limit(1)
      .single();

    const minDate = minDateResult?.event_date || addDaysDenver(today, -365); // Fallback to 1 year ago

    if (timeFilter === "past") {
      // Past: from minEventDate to yesterday
      // Progressive loading: show 90 days at a time, starting from yesterday going backward
      windowEnd = yesterday;

      // Calculate window start based on pastOffset
      // pastOffset=0 means yesterday-90 to yesterday
      // pastOffset=1 means yesterday-180 to yesterday-90
      const chunkStart = addDaysDenver(yesterday, -(pastOffset + 1) * 90);
      const chunkEnd = pastOffset === 0 ? yesterday : addDaysDenver(yesterday, -pastOffset * 90);

      windowStart = chunkStart < minDate ? minDate : chunkStart;
      windowEnd = chunkEnd;

      // Check if there are more past events beyond this window
      hasMorePastEvents = windowStart > minDate;
    } else {
      // All: from minEventDate to today+90
      windowStart = minDate;
      windowEnd = addDaysDenver(today, 90);
    }
  }

  // Build base query with venue join for search
  // Phase 4.52: Include google_maps_url and website_url for venue links
  let query = supabase
    .from("events")
    .select(`
      *,
      venues!left(name, address, city, state, google_maps_url, website_url)
    `)
    .eq("is_published", true)
    .in("status", ["active", "needs_verification"]);

  // Fetch occurrence overrides for the window
  // This runs in parallel with the events query
  const { data: overridesData } = await supabase
    .from("occurrence_overrides")
    .select("event_id, date_key, status, override_start_time, override_cover_image_url, override_notes")
    .gte("date_key", windowStart)
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

  // Phase 4.50b: Time-based filtering
  // For "past", get events with event_date in the past window
  // For "upcoming", get events with event_date from today onwards OR recurring events
  // For "all", get all events (no date filter)
  if (timeFilter === "past") {
    // Past: event_date must be in the past window (or null for recurring)
    query = query.or(`event_date.gte.${windowStart},event_date.lte.${windowEnd},event_date.is.null`);
  } else if (timeFilter === "upcoming") {
    // Upcoming: event_date from today onwards OR recurring (null event_date with day_of_week)
    query = query.or(`event_date.gte.${today},event_date.is.null`);
  }
  // For "all", no additional date filter needed

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

  // Phase 4.21/4.50b: Expand occurrences within window with override support
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
      startKey: windowStart,
      endKey: windowEnd,
      maxOccurrences: 40,
      overrideMap,
    }
  );

  // Phase 4.50b: Sort date groups based on timeFilter
  // - upcoming/all: chronological (ASC) - earliest first
  // - past: reverse chronological (DESC) - most recent first
  let filteredGroups = expandedGroups;
  if (timeFilter === "upcoming") {
    // Filter to only upcoming occurrences
    filteredGroups = new Map(
      [...expandedGroups.entries()]
        .filter(([dateKey]) => dateKey >= today)
        .sort(([a], [b]) => a.localeCompare(b)) // ASC
    );
  } else if (timeFilter === "past") {
    // Sort in reverse chronological order (newest first)
    filteredGroups = new Map(
      [...expandedGroups.entries()]
        .filter(([dateKey]) => dateKey < today)
        .sort(([a], [b]) => b.localeCompare(a)) // DESC
    );
  } else {
    // "all" - sort chronologically
    filteredGroups = new Map(
      [...expandedGroups.entries()].sort(([a], [b]) => a.localeCompare(b))
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
            windowStartKey={windowStart}
            windowEndKey={windowEnd}
            timeFilter={timeFilter}
            cancelledCount={expansionMetrics.cancelledCount}
            viewMode={viewMode}
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
          {/* Phase 4.50b: Dynamic window label based on timeFilter */}
          {" "}
          {timeFilter === "past" ? (
            <span>(past events{pastOffset > 0 ? `, showing older` : ""})</span>
          ) : timeFilter === "all" ? (
            <span>(all time)</span>
          ) : (
            <span>(next 90 days)</span>
          )}
          {filterSummary.length > 0 && (
            <span className="ml-2 text-[var(--color-text-tertiary)]">
              · Filtered by: {filterSummary.join(", ")}
            </span>
          )}
        </div>

        {/* Phase 4.54: Conditional rendering based on view mode */}
        {viewMode === "series" ? (
          /* Series View - one row per event/series */
          list.length > 0 ? (
            <SeriesView
              events={list as SeriesEvent[]}
              overrideMap={overrideMap}
              startKey={windowStart}
              endKey={windowEnd}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-[var(--color-text-secondary)]">
                {searchQuery || hasFilters
                  ? "No happenings match your filters. Try adjusting your search."
                  : "No happenings found. Check back soon!"}
              </p>
            </div>
          )
        ) : (
          /* Timeline View - grouped by date (default) */
          totalDisplayableEvents > 0 ? (
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

              {/* Phase 4.50b: "Load older" button for progressive past loading */}
              {timeFilter === "past" && hasMorePastEvents && (
                <div className="py-6 text-center">
                  <Link
                    href={`/happenings?${new URLSearchParams({
                      ...Object.fromEntries(
                        Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
                      ),
                      pastOffset: String(pastOffset + 1),
                    }).toString()}`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium hover:border-[var(--color-border-accent)] hover:bg-[var(--color-bg-tertiary)] transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Load older events
                  </Link>
                </div>
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
          )
        )}

        {/* Phase 4.38: Back to top button - appears when scrolling down */}
        <BackToTop />
      </PageContainer>
    </>
  );
}
