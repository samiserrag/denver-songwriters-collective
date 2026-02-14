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
  applyReschedulesToTimeline,
  buildOverrideMap,
  type EventOccurrenceEntry,
} from "@/lib/events/nextOccurrence";
import { getOccurrenceWindowNotice } from "@/lib/events/occurrenceWindow";
import { occurrencesToMapPins, type MapPinConfig } from "@/lib/map";
import { MapView } from "@/components/happenings/MapView";
import { getLocationFilteredVenues, type LocationFilterResult, DISCOVERY_STATUS_FILTER, DISCOVERY_VENUE_SELECT_WITH_COORDS } from "@/lib/happenings";
import { INVITE_CTA_LABEL } from "@/lib/referrals";

export const metadata: Metadata = {
  title: "Happenings | The Colorado Songwriters Collective",
  description: "Discover open mics, events, and shows in the Denver music community.",
};

export const dynamic = "force-dynamic";

/**
 * Phase 4.21 Search Params:
 * - q: search query (matches title, description, venue_name, venue_address, custom_location_*)
 * - time: upcoming|past|all
 * - type: event_type (open_mic, showcase, workshop, etc.)
 * - csc: 1 = CSC events only
 * - verify: verified|needs_verification
 * - location: venue|online|hybrid
 * - cost: free|paid|unknown
 * - days: comma-separated day abbreviations (mon,tue,wed,etc.)
 * - showCancelled: 1 = show cancelled occurrences (default: hidden)
 * - pastOffset: number of 90-day chunks to go back for progressive loading (default: 0)
 * - view: timeline|series|map (Phase 4.54/1.0, default: timeline)
 * - city: city name for location filter (Phase 1.4)
 * - zip: ZIP code for location filter (Phase 1.4, wins over city if both present)
 * - radius: radius in miles for nearby venues (Phase 1.4, default: 10, valid: 5|10|25|50)
 */
interface HappeningsSearchParams {
  q?: string;
  time?: string;
  type?: string;
  csc?: string;
  verify?: string;
  location?: string;
  cost?: string;
  days?: string;
  debugDates?: string;
  showCancelled?: string;
  pastOffset?: string;
  view?: string;
  city?: string;
  zip?: string;
  radius?: string;
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
  const cscFilter = params.csc === "1";
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
  // Phase 4.54/1.0: View mode (timeline = grouped by date, series = grouped by event, map = geographic)
  const viewMode: HappeningsViewMode =
    params.view === "series" ? "series" :
    params.view === "map" ? "map" :
    "timeline";

  // Phase 1.4: City/ZIP location filter params
  const cityParam = params.city;
  const zipParam = params.zip;
  const radiusParam = params.radius;

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
      .in("status", [...DISCOVERY_STATUS_FILTER])
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
  // Phase 6: Uses shared DISCOVERY_VENUE_SELECT_WITH_COORDS and DISCOVERY_STATUS_FILTER
  // for cross-surface consistency (includes coords for map view)
  let query = supabase
    .from("events")
    .select(`
      *,
      ${DISCOVERY_VENUE_SELECT_WITH_COORDS}
    `)
    .eq("is_published", true)
    .in("status", [...DISCOVERY_STATUS_FILTER]);

  // Fetch occurrence overrides for the window
  // This runs in parallel with the events query
  const { data: overridesData } = await supabase
    .from("occurrence_overrides")
    .select("event_id, date_key, status, override_start_time, override_cover_image_url, override_notes, override_patch")
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
      override_patch: o.override_patch as Record<string, unknown> | null,
    }))
  );

  // Pre-fetch venue names for overridden venue_ids so HappeningCard can display them
  const overrideVenueIds = new Set<string>();
  for (const o of overridesData || []) {
    const patch = o.override_patch as Record<string, unknown> | null;
    const vid = patch?.venue_id as string | undefined;
    if (vid) overrideVenueIds.add(vid);
  }
  // Phase 5.04/1.0: Include city/state and lat/lng in override venue map for HappeningCard and MapView
  const overrideVenueMap = new Map<string, { name: string; slug?: string | null; city?: string | null; state?: string | null; google_maps_url?: string | null; website_url?: string | null; latitude?: number | null; longitude?: number | null }>();
  if (overrideVenueIds.size > 0) {
    const { data: overrideVenues } = await supabase
      .from("venues")
      .select("id, name, slug, city, state, google_maps_url, website_url, latitude, longitude")
      .in("id", [...overrideVenueIds]);
    if (overrideVenues) {
      for (const v of overrideVenues) {
        overrideVenueMap.set(v.id, { name: v.name, slug: v.slug, city: v.city, state: v.state, google_maps_url: v.google_maps_url, website_url: v.website_url, latitude: v.latitude, longitude: v.longitude });
      }
    }
  }

  // Phase 1.4: Location filter (city/ZIP with radius-based nearby expansion)
  // Call BEFORE other filters so we get the venue IDs to filter by
  let locationFilterResult: LocationFilterResult | null = null;
  const hasLocationFilter = Boolean(cityParam || zipParam);

  if (hasLocationFilter) {
    locationFilterResult = await getLocationFilteredVenues(supabase, {
      zip: zipParam,
      city: cityParam,
      radiusMiles: radiusParam ? parseInt(radiusParam, 10) : undefined,
    });
  }

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
  } else if (typeFilter === "kindred_group") {
    query = query.eq("event_type", "kindred_group");
  } else if (typeFilter === "jam_session") {
    query = query.eq("event_type", "jam_session");
  } else if (typeFilter === "other") {
    query = query.eq("event_type", "other");
  }

  // CSC filter
  if (cscFilter) {
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
  //
  // P0 Fix: Recurring events with recurrence_rule may have past anchor dates but future
  // occurrences. Include them so they can be expanded. The occurrence expansion will
  // filter to the appropriate window.
  if (timeFilter === "past") {
    // Past: event_date must be in the past window (or null for recurring) or has recurrence_rule
    query = query.or(`event_date.gte.${windowStart},event_date.lte.${windowEnd},event_date.is.null,recurrence_rule.not.is.null`);
  } else if (timeFilter === "upcoming") {
    // Upcoming: event_date from today onwards OR recurring (null event_date or has recurrence_rule)
    query = query.or(`event_date.gte.${today},event_date.is.null,recurrence_rule.not.is.null`);
  }
  // For "all", no additional date filter needed

  const { data: events, error } = await query;

  if (error) {
    console.error("Error fetching happenings:", error);
  }

  // Cast to any[] because Supabase query result type doesn't include the joined 'venue' relation.
  // Removing this would require cascading type definitions for the joined result shape.
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
        const date = new Date(event.event_date + "T12:00:00Z");
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
    // Same any[] cast as above — Supabase types don't include joined relations
    list as any[],
    {
      startKey: windowStart,
      endKey: windowEnd,
      maxOccurrences: 40,
      overrideMap,
    }
  );

  // Apply rescheduling post-processing: moves rescheduled occurrences to their new display date
  const rescheduledGroups = applyReschedulesToTimeline(expandedGroups);

  // Phase 4.50b: Sort date groups based on timeFilter
  // - upcoming/all: chronological (ASC) - earliest first
  // - past: reverse chronological (DESC) - most recent first
  let filteredGroups = rescheduledGroups;

  if (timeFilter === "upcoming") {
    // Filter to only upcoming occurrences (default behavior: rolling ~3 month window)
    filteredGroups = new Map(
      [...rescheduledGroups.entries()]
        .filter(([dateKey]) => dateKey >= today)
        .sort(([a], [b]) => a.localeCompare(b)) // ASC
    );
  } else if (timeFilter === "past") {
    // Sort in reverse chronological order (newest first)
    filteredGroups = new Map(
      [...rescheduledGroups.entries()]
        .filter(([dateKey]) => dateKey < today)
        .sort(([a], [b]) => b.localeCompare(a)) // DESC
    );
  } else {
    // "all" - sort chronologically
    filteredGroups = new Map(
      [...rescheduledGroups.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
  }

  // Phase 1.4: Apply location filter to occurrences (filter by effective venue_id)
  // This happens AFTER time filtering but BEFORE count calculations
  if (locationFilterResult && locationFilterResult.includedVenueIds.length > 0) {
    const includedVenueIds = new Set(locationFilterResult.includedVenueIds);

    // Helper to get effective venue_id for an occurrence (override takes precedence)
    const getEffectiveVenueId = (entry: EventOccurrenceEntry<any>): string | null => {
      const patch = entry.override?.override_patch as Record<string, unknown> | null | undefined;
      const overrideVid = patch?.venue_id as string | undefined;
      if (overrideVid) return overrideVid;
      return entry.event.venue_id || null;
    };

    // Filter each date group's entries
    const locationFilteredGroups = new Map<string, EventOccurrenceEntry<any>[]>();
    for (const [dateKey, entries] of filteredGroups.entries()) {
      const filtered = entries.filter((entry) => {
        const effectiveVenueId = getEffectiveVenueId(entry);
        return effectiveVenueId && includedVenueIds.has(effectiveVenueId);
      });
      if (filtered.length > 0) {
        locationFilteredGroups.set(dateKey, filtered);
      }
    }
    filteredGroups = locationFilteredGroups;
  } else if (hasLocationFilter && locationFilterResult?.emptyReason) {
    // Location filter active but no venues found - empty all groups
    filteredGroups = new Map();
  }

  // Sort unknown schedule events alphabetically by title
  // Phase 1.4: Also filter by location if active
  let filteredUnknownEvents = [...unknownEvents];
  if (locationFilterResult && locationFilterResult.includedVenueIds.length > 0) {
    const includedVenueIds = new Set(locationFilterResult.includedVenueIds);
    filteredUnknownEvents = filteredUnknownEvents.filter((event: any) => {
      return event.venue_id && includedVenueIds.has(event.venue_id);
    });
  } else if (hasLocationFilter && locationFilterResult?.emptyReason) {
    // Location filter active but no venues found - empty unknown events too
    filteredUnknownEvents = [];
  }
  const sortedUnknownEvents = filteredUnknownEvents.sort((a: any, b: any) => {
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

  // Phase 4.55: Count happenings by time period for humanized summary
  const thisWeekEnd = addDaysDenver(today, 7);
  let tonightCount = 0;
  let thisWeekendCount = 0;
  let thisWeekCount = 0;

  for (const [dateKey, entries] of filteredGroups.entries()) {
    if (dateKey === today) {
      tonightCount += entries.length;
    }
    // Weekend check: Saturday (6) or Sunday (0)
    const date = new Date(dateKey + "T12:00:00Z");
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (dateKey >= today && dateKey <= thisWeekEnd) {
        thisWeekendCount += entries.length;
      }
    }
    if (dateKey >= today && dateKey < thisWeekEnd) {
      thisWeekCount += entries.length;
    }
  }

  // Hero only shows on unfiltered /happenings (no filters active)
  const hasFilters = searchQuery || typeFilter || cscFilter || verifyFilter || locationFilter || costFilter || daysFilter.length > 0 || (timeFilter && timeFilter !== "upcoming") || hasLocationFilter;
  const showHero = !hasFilters;

  // Page title based on active type filter
  const getPageTitle = () => {
    if (typeFilter === "open_mic") return "Open Mics";
    if (typeFilter === "shows") return "Shows";
    if (typeFilter === "showcase") return "Showcases";
    if (typeFilter === "workshop") return "Workshops";
    if (typeFilter === "song_circle") return "Song Circles";
    if (typeFilter === "gig") return "Gigs";
    if (typeFilter === "kindred_group") return "Kindred Songwriter Groups";
    if (typeFilter === "jam_session") return "Jam Sessions";
    if (cscFilter) return "CSC Events";
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
        kindred_group: "Kindred Songwriter Groups",
        jam_session: "Jam Sessions",
        other: "Other",
      };
      parts.push(labels[typeFilter] || typeFilter);
    }
    if (cscFilter) parts.push("CSC Events");
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
    // Phase 1.4: Location filter summary
    if (locationFilterResult) {
      const { mode, normalized, exactMatchCount, nearbyCount } = locationFilterResult;
      if (mode === "zip") {
        const nearbyText = nearbyCount > 0 ? ` + ${nearbyCount} nearby` : "";
        parts.push(`ZIP ${normalized.zip} (${exactMatchCount}${nearbyText}, ${normalized.radiusMiles}mi)`);
      } else if (mode === "city") {
        const nearbyText = nearbyCount > 0 ? ` + ${nearbyCount} nearby` : "";
        parts.push(`${normalized.city} (${exactMatchCount}${nearbyText}, ${normalized.radiusMiles}mi)`);
      }
    }
    return parts;
  };

  const filterSummary = getFilterSummary();

  // Phase 1.42: Location-aware empty state message
  const getEmptyStateMessage = (): { headline: string; detail?: string } => {
    // Location filter active but no venues found
    if (hasLocationFilter && locationFilterResult?.emptyReason) {
      if (zipParam) {
        return {
          headline: `No venues found for ZIP ${zipParam}`,
          detail: "Try a nearby ZIP or a larger radius."
        };
      }
      if (cityParam) {
        return {
          headline: `No venues found in ${cityParam}`,
          detail: "Try increasing the radius or clearing the location filter."
        };
      }
    }
    // Other filters active
    if (searchQuery || hasFilters) {
      return {
        headline: "No happenings match your filters.",
        detail: "Try adjusting your search."
      };
    }
    // Default
    return {
      headline: "No happenings found.",
      detail: "Check back soon!"
    };
  };

  // Helper: resolve override venue data for a given entry
  const getOverrideVenueForEntry = (entry: EventOccurrenceEntry<any>) => {
    const patch = entry.override?.override_patch as Record<string, unknown> | null | undefined;
    const vid = patch?.venue_id as string | undefined;
    if (vid && vid !== entry.event.venue_id) {
      return overrideVenueMap.get(vid) || null;
    }
    return null;
  };

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
                href="/dashboard/my-events/new"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-sm font-medium hover:opacity-90 transition"
              >
                + Add Open Mic
              </Link>
            ) : (
              <Link
                href="/dashboard/my-events/new"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-sm font-medium hover:opacity-90 transition"
              >
                + Add Happening
              </Link>
            )}
            <Link
              href="/submit-open-mic"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-sm hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition"
            >
              Correction
            </Link>
            <Link
              href="/invite"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] text-sm hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition"
            >
              {INVITE_CTA_LABEL}
            </Link>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
            Do you host one of these happenings?{" "}
            <span className="text-[var(--color-text-secondary)]">
              Click on it to claim it as host and manage it on our platform.
            </span>
          </p>
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

        {/* Results summary - humanized, Phase 4.55 */}
        <div className="py-3">
          {timeFilter === "upcoming" && !hasFilters ? (
            /* Humanized summary for default view (rolling ~3 month upcoming window) */
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {tonightCount > 0 && (
                <span>
                  <span className="font-bold text-[var(--color-text-primary)]">{tonightCount}</span>
                  <span className="text-[var(--color-text-secondary)]"> tonight</span>
                </span>
              )}
              {thisWeekendCount > 0 && (
                <span>
                  <span className="font-bold text-[var(--color-text-primary)]">{thisWeekendCount}</span>
                  <span className="text-[var(--color-text-secondary)]"> this weekend</span>
                </span>
              )}
              <span>
                <span className="font-bold text-[var(--color-text-primary)]">{thisWeekCount}</span>
                <span className="text-[var(--color-text-secondary)]"> this week</span>
              </span>
              <span className="text-[var(--color-text-tertiary)]">•</span>
              <span>
                <span className="font-bold text-[var(--color-text-primary)]">{totalDisplayableEvents}</span>
                <span className="text-[var(--color-text-secondary)]"> in the next 3 months</span>
              </span>
            </div>
          ) : (
            /* Detailed summary for filtered views */
            <div className="text-sm text-[var(--color-text-secondary)]">
              <span className="font-medium text-[var(--color-text-primary)]">
                {totalDisplayableEvents} {totalDisplayableEvents === 1 ? "happening" : "happenings"}
              </span>
              {" "}across{" "}
              <span className="font-medium text-[var(--color-text-primary)]">{totalDates}</span>
              {" "}{totalDates === 1 ? "date" : "dates"}
              {/* Phase 4.50b: Dynamic window label based on timeFilter */}
              {" "}
              {timeFilter === "past" ? (
                <span>(past{pastOffset > 0 ? ", showing older" : ""})</span>
              ) : timeFilter === "all" ? (
                <span>(all time)</span>
              ) : null}
              {filterSummary.length > 0 && (
                <span className="ml-2 text-[var(--color-text-tertiary)]">
                  · {filterSummary.join(", ")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Phase 4.54/1.0: Conditional rendering based on view mode */}
        {viewMode === "map" ? (
          /* Map View - geographic pins (Phase 1.0) */
          (() => {
            // Flatten all occurrences from filteredGroups for map rendering
            const allOccurrences: EventOccurrenceEntry<any>[] = [];
            for (const entries of filteredGroups.values()) {
              allOccurrences.push(...entries);
            }

            // Build override venue map for MapPinConfig (includes lat/lng for venue resolution)
            const mapOverrideVenueMap = new Map<string, {
              name: string;
              slug?: string | null;
              latitude?: number | null;
              longitude?: number | null;
              city?: string | null;
              state?: string | null;
            }>();
            for (const [vid, data] of overrideVenueMap.entries()) {
              mapOverrideVenueMap.set(vid, {
                name: data.name,
                slug: data.slug,
                latitude: data.latitude,
                longitude: data.longitude,
                city: data.city,
                state: data.state,
              });
            }

            const mapConfig: MapPinConfig = {
              maxPins: 500,
              overrideVenueMap: mapOverrideVenueMap,
            };

            const pinResult = occurrencesToMapPins(allOccurrences, mapConfig);

            return <MapView pinResult={pinResult} className="mt-4" />;
          })()
        ) : viewMode === "series" ? (
          /* Series View - one row per event/series */
          (() => {
            // Phase 1.4: Filter series list by location if active
            let seriesList = list;
            if (locationFilterResult && locationFilterResult.includedVenueIds.length > 0) {
              const includedVenueIds = new Set(locationFilterResult.includedVenueIds);
              seriesList = list.filter((event: any) => {
                return event.venue_id && includedVenueIds.has(event.venue_id);
              });
            } else if (hasLocationFilter && locationFilterResult?.emptyReason) {
              seriesList = [];
            }

            return (
              <>
                {/* Phase 4.84: Rolling window notice for series view */}
                {(() => {
                  const windowNotice = getOccurrenceWindowNotice();
                  return (
                    <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
                      <p>{windowNotice.headline}</p>
                      <p className="text-[var(--color-text-tertiary)]">{windowNotice.detail}</p>
                    </div>
                  );
                })()}
                {seriesList.length > 0 ? (
                  <SeriesView
                    events={seriesList as SeriesEvent[]}
                    overrideMap={overrideMap}
                    startKey={windowStart}
                    endKey={windowEnd}
                  />
                ) : (
                  <div className="text-center py-12">
                    {(() => {
                      const msg = getEmptyStateMessage();
                      return (
                        <>
                          <p className="text-[var(--color-text-secondary)]">{msg.headline}</p>
                          {msg.detail && (
                            <p className="text-[var(--color-text-tertiary)] text-sm mt-1">{msg.detail}</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            );
          })()
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
                        ? cancelledForDate.map((entry: EventOccurrenceEntry<any>) => {
                            const cardDate = entry.displayDate || entry.dateKey;
                            return (
                              <HappeningsCard
                                key={`${entry.event.id}-${entry.dateKey}-cancelled`}
                                event={entry.event}
                                searchQuery={searchQuery}
                                debugDates={debugDates}
                                occurrence={{
                                  date: cardDate,
                                  isToday: cardDate === today,
                                  isTomorrow: cardDate === tomorrow,
                                  isConfident: entry.isConfident,
                                }}
                                todayKey={today}
                                override={entry.override}
                                isCancelled={true}
                                overrideVenueData={getOverrideVenueForEntry(entry)}
                              />
                            );
                          })
                        : undefined
                    }
                  >
                    {entriesForDate.map((entry: EventOccurrenceEntry<any>) => {
                      // Use displayDate for rescheduled occurrences (shows new date on card)
                      const cardDate = entry.displayDate || entry.dateKey;
                      return (
                        <HappeningsCard
                          key={`${entry.event.id}-${entry.dateKey}`}
                          event={entry.event}
                          searchQuery={searchQuery}
                          debugDates={debugDates}
                          occurrence={{
                            date: cardDate,
                            isToday: cardDate === today,
                            isTomorrow: cardDate === tomorrow,
                            isConfident: entry.isConfident,
                          }}
                          todayKey={today}
                          override={entry.override}
                          isCancelled={entry.isCancelled}
                          overrideVenueData={getOverrideVenueForEntry(entry)}
                        />
                      );
                    })}
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
                  {otherCancelledOccurrences.map((entry: EventOccurrenceEntry<any>) => {
                    const cardDate = entry.displayDate || entry.dateKey;
                    return (
                      <HappeningsCard
                        key={`${entry.event.id}-${entry.dateKey}-cancelled`}
                        event={entry.event}
                        searchQuery={searchQuery}
                        debugDates={debugDates}
                        occurrence={{
                          date: cardDate,
                          isToday: cardDate === today,
                          isTomorrow: cardDate === tomorrow,
                          isConfident: entry.isConfident,
                        }}
                        todayKey={today}
                        override={entry.override}
                        isCancelled={true}
                        overrideVenueData={getOverrideVenueForEntry(entry)}
                      />
                    );
                  })}
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
              {(() => {
                const msg = getEmptyStateMessage();
                return (
                  <>
                    <p className="text-[var(--color-text-secondary)]">{msg.headline}</p>
                    {msg.detail && (
                      <p className="text-[var(--color-text-tertiary)] text-sm mt-1">{msg.detail}</p>
                    )}
                  </>
                );
              })()}
            </div>
          )
        )}

        {/* Host CTA */}
        <div className="mt-8 pt-6 border-t border-[var(--color-border-subtle)] text-center">
          <p className="text-[var(--color-text-secondary)]">
            Want to host your own event or open mic?{" "}
            <Link href="/host" className="text-[var(--color-text-accent)] hover:underline font-medium">
              Learn how →
            </Link>
          </p>
        </div>

        {/* Phase 4.38: Back to top button - appears when scrolling down */}
        <BackToTop />
      </PageContainer>
    </>
  );
}
