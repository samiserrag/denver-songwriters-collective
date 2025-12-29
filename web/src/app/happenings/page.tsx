import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HappeningsCard } from "@/components/happenings";
import { HappeningsFilters } from "@/components/happenings/HappeningsFilters";
import { PageContainer } from "@/components/layout/page-container";
import { HeroSection } from "@/components/layout/hero-section";

export const metadata: Metadata = {
  title: "Happenings | Denver Songwriters Collective",
  description: "Discover open mics, events, and shows in the Denver music community.",
};

export const dynamic = "force-dynamic";

// Grouping helpers
function groupByDate(events: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  for (const event of events) {
    const dateKey = event.event_date!;
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

export function groupByDayOfWeek(events: any[]): Map<string, any[]> {
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const groups = new Map<string, any[]>();

  for (const day of dayOrder) {
    groups.set(day, []);
  }

  for (const event of events) {
    const day = event.day_of_week?.trim();
    if (day && groups.has(day)) {
      groups.get(day)!.push(event);
    }
  }

  // Remove empty days
  for (const [day, items] of groups) {
    if (items.length === 0) groups.delete(day);
  }

  return groups;
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  // Use explicit timezone to prevent server/client hydration mismatch
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });
}

/**
 * Phase 4.2 Search Params:
 * - q: search query (matches title, description, venue_name, venue_address, custom_location_*)
 * - time: upcoming|past|all
 * - type: event_type (open_mic, showcase, workshop, etc.)
 * - dsc: 1 = DSC events only
 * - verify: verified|needs_verification
 * - location: venue|online|hybrid
 * - cost: free|paid|unknown
 */
interface HappeningsSearchParams {
  q?: string;
  time?: string;
  type?: string;
  dsc?: string;
  verify?: string;
  location?: string;
  cost?: string;
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

  const today = new Date().toISOString().split("T")[0];

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

  // Date filter logic
  if (timeFilter === "upcoming") {
    // Events today or future, OR recurring events (no specific date)
    query = query.or(`event_date.gte.${today},event_date.is.null`);
  } else if (timeFilter === "past") {
    query = query.lt("event_date", today);
  }
  // 'all' = no date filter

  query = query.order("day_of_week", { ascending: true });

  const { data: events, error } = await query;

  if (error) {
    console.error("Error fetching happenings:", error);
  }

  let list = events || [];

  // Client-side search filtering (case-insensitive across multiple fields)
  // This is done client-side because Supabase doesn't support OR across joins easily
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter((event: any) => {
      // Direct event fields
      const titleMatch = event.title?.toLowerCase().includes(q);
      const descMatch = event.description?.toLowerCase().includes(q);
      const venueNameMatch = event.venue_name?.toLowerCase().includes(q);
      const venueAddrMatch = event.venue_address?.toLowerCase().includes(q);
      const customLocMatch = event.custom_location_name?.toLowerCase().includes(q);
      const customCityMatch = event.custom_city?.toLowerCase().includes(q);
      const customStateMatch = event.custom_state?.toLowerCase().includes(q);

      // Joined venue fields
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

  const datedEvents = list.filter((e: any) => e.event_date);
  const recurringEvents = list.filter((e: any) => !e.event_date);

  // Hero only shows on unfiltered /happenings (no filters active)
  const hasFilters = searchQuery || typeFilter || dscFilter || verifyFilter || locationFilter || costFilter || timeFilter !== "upcoming";
  const showHero = !hasFilters;

  // Page title based on active type filter
  const getPageTitle = () => {
    if (typeFilter === "open_mic") return "Open Mics";
    if (typeFilter === "showcase") return "Shows";
    if (typeFilter === "workshop") return "Workshops";
    if (typeFilter === "song_circle") return "Song Circles";
    if (typeFilter === "gig") return "Gigs";
    if (dscFilter) return "DSC Happenings";
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
            {list.length} {list.length === 1 ? "result" : "results"} found
          </p>
        )}

        {/* Phase 4.3: Tight density - 10-12 rows visible on desktop, 6-8 on mobile */}
        {datedEvents.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-[var(--font-family-display)] font-semibold mb-3 text-stone-700 dark:text-stone-200">
              {timeFilter === "past" ? "Past Happenings" : "Upcoming Happenings"}
            </h2>
            <div className="flex flex-col gap-4">
              {[...groupByDate(datedEvents)].map(([date, eventsForDate]) => (
                <div key={date}>
                  <h3 className="text-base font-medium text-stone-500 dark:text-stone-400 mb-1 pb-0.5 border-b border-stone-200 dark:border-stone-700">
                    {formatDateHeader(date)}
                  </h3>
                  <div className="flex flex-col">
                    {eventsForDate.map((event: any) => (
                      <HappeningsCard key={event.id} event={event} searchQuery={searchQuery} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {recurringEvents.length > 0 && (
          <section>
            <h2 className="text-xl font-[var(--font-family-display)] font-semibold mb-3 text-stone-700 dark:text-stone-200">Weekly Open Mics</h2>
            <div className="flex flex-col gap-4">
              {[...groupByDayOfWeek(recurringEvents)].map(([day, eventsForDay]) => (
                <div key={day}>
                  <h3 className="text-lg font-[var(--font-family-display)] font-bold text-stone-600 dark:text-stone-300 mb-1 pb-0.5 border-b-2 border-amber-400 dark:border-amber-500">
                    {day}s
                  </h3>
                  <div className="flex flex-col">
                    {eventsForDay.map((event: any) => (
                      <HappeningsCard key={event.id} event={event} searchQuery={searchQuery} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {list.length === 0 && (
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
