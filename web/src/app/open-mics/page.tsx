import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import type { Event as EventType } from "@/types";
import type { EventWithVenue } from "@/types/db";
import EventCard from "@/components/EventCard";
import OpenMicFilters from "@/components/OpenMicFilters";
import MapViewButton from "@/components/MapViewButton";
import CompactListItem from "@/components/CompactListItem";
import AccordionList from "@/components/AccordionList";
import DayJumpBar from "@/components/DayJumpBar";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import WorkInProgressBanner from "@/components/WorkInProgressBanner";

export const metadata: Metadata = {
  title: "Open Mics | Denver Songwriters Collective",
  description: "Find open mics in Denver every night of the week. Community-curated directory of songwriter-friendly stages across the Front Range.",
};

export const dynamic = "force-dynamic";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DBEvent = {
  id: string;
  title: string;
  description?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  signup_time?: string | null;
  category?: string | null;
  end_time?: string | null;
  recurrence_rule?: string | null;
  day_of_week?: string | null;
  venue_id?: string | null;
  // joined venue fields (required - all open mics must have venue_id)
  venues?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    website_url?: string | null;
    phone?: string | null;
    map_link?: string | null;
    google_maps_url?: string | null;
  } | null;
  slug?: string | null;
  status?: string | null;
};

function isValidMapUrl(url?: string | null): boolean {
  if (!url) return false;
  // goo.gl and maps.app.goo.gl shortened URLs are broken (Dynamic Link Not Found)
  if (url.includes("goo.gl")) return false;
  return true;
}

function getMapUrl(googleMapsUrl?: string | null, mapLink?: string | null, venueName?: string | null, addressParts?: string[]): string | undefined {
  // Prefer explicit google_maps_url if valid
  if (isValidMapUrl(googleMapsUrl)) return googleMapsUrl!;
  // Fall back to map_link if it's not a broken goo.gl URL
  if (isValidMapUrl(mapLink)) return mapLink!;
  // Otherwise construct from venue name + address
  const parts: string[] = [];
  if (venueName && venueName !== "TBA" && venueName !== "Venue") parts.push(venueName);
  if (addressParts && addressParts.length > 0) parts.push(...addressParts);
  if (parts.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
  }
  return undefined;
}

function formatTime(dbEvent: DBEvent) {
  if (dbEvent.recurrence_rule) {
    const rule = dbEvent.recurrence_rule;
    try {
      const bydayMatch = rule.match(/BYDAY=([^;\\n]+)/);
      const freqMatch = rule.match(/FREQ=([^;\\n]+)/);
      if (bydayMatch) {
        return `Weekly • ${bydayMatch[1].replace(/,/g, ", ")}`;
      }
      if (freqMatch) {
        return freqMatch[1].toLowerCase();
      }
    } catch {
      /* ignore */
    }
    return rule;
  }

  if (dbEvent.start_time) {
    try {
      const t = dbEvent.start_time;
      const timeOnly = t.includes("T") ? t.split("T")[1] : t;
      const [hh, mm] = timeOnly.split(":");
      const hour = parseInt(hh, 10);
      const minutes = mm ?? "00";
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = ((hour + 11) % 12) + 1;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return dbEvent.start_time;
    }
  }

  return "Time TBD";
}

function mapDBEventToEvent(e: DBEvent): EventType {
  // All open mics must have venue_id - no fallback to denormalized fields
  const venueName = e.venues?.name ?? "Venue TBD";
  const venueCity = e.venues?.city ?? null;
  const venueState = e.venues?.state ?? null;
  const venueAddress = e.venues?.address ?? null;
  const addressParts = [
    venueAddress,
    venueCity,
    venueState,
  ].filter((v): v is string => Boolean(v));
  const location = addressParts.join(", ");

  const mapUrl = getMapUrl(
    e.venues?.google_maps_url,
    e.venues?.map_link,
    venueName,
    addressParts.length > 0 ? addressParts : undefined
  );

  const _evt: any = {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    date: e.event_date ?? "",
    start_time: e.start_time ?? null,
    end_time: e.end_time ?? null,
    recurrence_rule: e.recurrence_rule ?? null,
    day_of_week: e.day_of_week ?? null,
    venue: venueName,
    venue_name: venueName,
    venue_city: venueCity,
    venue_state: venueState,
    venue_address: venueAddress,
    location: location || undefined,
    mapUrl,
    slug: e.slug ?? undefined,
    signup_time: e.signup_time ?? null,
    category: e.category ?? null,
    // preserve original status from DB for visual labeling (do not filter)
    status: e.status ?? null,
    eventType: "open_mic",
  };
  return _evt as EventType;
}

export default async function OpenMicsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; status?: string; search?: string; city?: string; page?: string; view?: string }>;
}) {
  const params = await searchParams;

  const view = params?.view ?? "list";

  // Status filter: "all", "active", "unverified", "inactive"
  const allowedStatuses = ["all", "active", "unverified", "inactive"];
  const selectedStatus = params?.status && allowedStatuses.includes(params.status) ? params.status : "all";

  const allowedDays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const selectedDay =
    params?.day && allowedDays.includes(params.day) ? params.day : null;


  const search =
    typeof params?.search === "string" && params.search.trim()
      ? String(params.search).trim().slice(0, 200)
      : null;

  const safeSearch = search ? search.replace(/[%_]/g, "") : null;

  const selectedCity =
    typeof params?.city === "string" && params.city.trim()
      ? String(params.city).trim()
      : "all";


  const supabase = await createSupabaseServerClient();

  // Run independent queries in parallel for better performance
  const [cityResult, activeCountResult, totalCountResult, suggestionsCountResult] = await Promise.all([
    // Fetch distinct cities for the city dropdown
    supabase.from("venues").select("city").not("city", "is", null),
    // Fetch active events count (verified/active only)
    supabase.from("events").select("*", { count: "exact", head: true }).eq("event_type", "open_mic").eq("status", "active"),
    // Fetch total events count (all statuses with venue_id)
    supabase.from("events").select("*", { count: "exact", head: true }).eq("event_type", "open_mic").not("venue_id", "is", null),
    // Fetch approved suggestions count
    supabase.from("event_update_suggestions").select("*", { count: "exact", head: true }).eq("status", "approved"),
  ]);

  const cityRows = cityResult.data;
  const totalActiveEvents = activeCountResult.count ?? 0;
  const totalEvents = totalCountResult.count ?? 0;
  const approvedSuggestions = suggestionsCountResult.count;

  const cities = Array.from(
    new Set((cityRows ?? []).map((r: any) => (r.city ?? "").trim()).filter(Boolean))
  ).sort((a: string, b: string) => a.localeCompare(b));

  // Build events query - venue_id required, join with venues table, published only
  let query = supabase
    .from("events")
    .select(
      `id,slug,title,description,event_date,start_time,signup_time,category,recurrence_rule,day_of_week,venue_id,venues(name,address,city,state,website_url,phone,map_link,google_maps_url),status,notes,last_verified_at`,
      { count: "exact" }
    )
    .eq("event_type", "open_mic")
    .eq("is_published", true)
    .not("venue_id", "is", null); // Only show events with proper venue records

  if (selectedDay) {
    query = query.eq("day_of_week", selectedDay);
  }

  // Status filtering
  if (selectedStatus && selectedStatus !== "all") {
    if (selectedStatus === "unverified") {
      // Include both "unverified" and "needs_verification"
      query = query.in("status", ["unverified", "needs_verification"]);
    } else {
      query = query.eq("status", selectedStatus);
    }
  }

  // City filtering: resolve venue IDs for the selected city, then filter by venue_id
  if (selectedCity && selectedCity !== "all") {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id")
      .eq("city", selectedCity);

    const venueIds: string[] = (venueRows ?? []).map((v: any) => v.id).filter(Boolean);

    if (venueIds.length === 0) {
      // No venues for the selected city — render empty state
      return (
        <PageContainer>
          <div className="mt-8">
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] p-10 text-center">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                No open mics found in {selectedCity}
              </h2>
            </div>
          </div>
        </PageContainer>
      );
    }

    query = query.in("venue_id", venueIds);
  }

  // Search logic: If searching, we need to match both event fields AND venue names
  // Since we can't search joined venue fields in .or(), we:
  // 1. Find venue IDs matching the search term
  // 2. Combine with event field search using OR logic
  let searchVenueIds: string[] = [];
  if (safeSearch) {
    const like = `%${safeSearch}%`;

    // Find venues matching the search term
    const { data: matchingVenues } = await supabase
      .from("venues")
      .select("id")
      .or(`name.ilike.${like},address.ilike.${like},city.ilike.${like}`);

    searchVenueIds = (matchingVenues ?? []).map((v: { id: string }) => v.id);

    // Search across event fields
    query = query.or(
      `title.ilike.${like},notes.ilike.${like},day_of_week.ilike.${like},recurrence_rule.ilike.${like},description.ilike.${like}`
    );
  }


  const { data: dbEvents, error, count } = await query;

  // If we have venue search matches, we need to include events at those venues too
  let allDbEvents = dbEvents ?? [];
  if (safeSearch && searchVenueIds.length > 0) {
    // Build a separate query for events at matching venues (published only)
    let venueQuery = supabase
      .from("events")
      .select(
        `id,slug,title,description,event_date,start_time,signup_time,category,recurrence_rule,day_of_week,venue_id,venues(name,address,city,state,website_url,phone,map_link,google_maps_url),status,notes,last_verified_at`
      )
      .eq("event_type", "open_mic")
      .eq("is_published", true)
      .in("venue_id", searchVenueIds);

    // Apply same filters as main query
    if (selectedDay) {
      venueQuery = venueQuery.eq("day_of_week", selectedDay);
    }
    if (selectedStatus && selectedStatus !== "all") {
      if (selectedStatus === "unverified") {
        venueQuery = venueQuery.in("status", ["unverified", "needs_verification"]);
      } else {
        venueQuery = venueQuery.eq("status", selectedStatus);
      }
    }
    if (selectedCity && selectedCity !== "all") {
      const { data: venueRows } = await supabase
        .from("venues")
        .select("id")
        .eq("city", selectedCity);
      const cityVenueIds: string[] = (venueRows ?? []).map((v: any) => v.id).filter(Boolean);
      if (cityVenueIds.length > 0) {
        venueQuery = venueQuery.in("venue_id", cityVenueIds);
      }
    }

    const { data: venueMatchEvents } = await venueQuery;

    // Merge and dedupe by ID
    const existingIds = new Set((allDbEvents as any[]).map((e: any) => e.id));
    const newEvents = (venueMatchEvents ?? []).filter((e: any) => !existingIds.has(e.id));
    allDbEvents = [...allDbEvents, ...newEvents] as typeof allDbEvents;
  }

  // Map and sort results client-side: day_of_week (Sun->Sat), start_time, then city
  const mapped = (allDbEvents as DBEvent[]).map(mapDBEventToEvent) as any[];

  // TEMP DEBUG: log mapped events count and a small sample
  try {
    console.log("RAW_EVENTS_COUNT:", (mapped ?? []).length);
    console.log("RAW_EVENTS_SAMPLE:", (mapped ?? []).slice(0, 3));
  } catch (err) {
    console.log("RAW_EVENTS_LOG_ERROR:", err);
  }

function parseTimeToMinutes(t?: string | null) {
    if (!t) return 24 * 60;
    try {
      const timeOnly = t.includes("T") ? t.split("T")[1] : t;
      const [hhStr, mmStr] = timeOnly.split(":");
      const hh = parseInt(hhStr ?? "24", 10);
      const mm = parseInt(mmStr ?? "0", 10);
      if (Number.isNaN(hh)) return 24 * 60;
      return hh * 60 + (Number.isNaN(mm) ? 0 : mm);
    } catch {
      return 24 * 60;
    }
  }

  // Helper to normalize day_of_week (case-insensitive)
  function getDayIndex(day: string | null | undefined): number {
    if (!day) return 7;
    const normalized = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    const idx = DAYS.indexOf(normalized);
    return idx === -1 ? 7 : idx;
  }

  const events = mapped.sort((a, b) => {
    // Sort by day_of_week (Sunday -> Saturday), case-insensitive
    const dayIdxA = getDayIndex(a.day_of_week);
    const dayIdxB = getDayIndex(b.day_of_week);
    if (dayIdxA !== dayIdxB) return dayIdxA - dayIdxB;

    // Then by start_time (earliest first)
    const tA = parseTimeToMinutes(a.start_time ?? null);
    const tB = parseTimeToMinutes(b.start_time ?? null);
    if (tA !== tB) return tA - tB;

    // Then by venue name alphabetically
    const venueA = (a.venue_name ?? a.venue ?? "").toLowerCase();
    const venueB = (b.venue_name ?? b.venue ?? "").toLowerCase();
    return venueA.localeCompare(venueB);
  });



  return (
    <>
      {/* Hero Header with Background Image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img
          src="/images/open-mic-placeholder.jpg"
          alt="Open Mic Night"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] drop-shadow-lg">
              Denver Open Mic Directory
            </h1>
            <p className="text-lg text-[var(--color-text-accent)] mt-2 drop-shadow">
              {totalActiveEvents} verified open mics across the Front Range
            </p>
            {totalEvents > totalActiveEvents && (
              <p className="text-sm text-[var(--color-text-secondary)] mt-1 drop-shadow">
                {totalEvents - totalActiveEvents} more pending verification
              </p>
            )}
          </div>
        </div>
      </div>

      <PageContainer>
        {/* Subheader info */}
        <div className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-border-default)] mb-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {(approvedSuggestions || 0) > 0 ? `${approvedSuggestions} community updates applied` : "Community-curated directory"}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] max-w-md">
            Contact venues to confirm details.{" "}
            <a href="/submit-open-mic" className="text-[var(--color-text-accent)] hover:underline">Help keep this list updated</a>.
          </p>
        </div>

        <WorkInProgressBanner />

        <div className="mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <OpenMicFilters
              cities={cities}
              selectedCity={selectedCity === "all" ? undefined : selectedCity}
              selectedStatus={selectedStatus === "all" ? undefined : selectedStatus}
              search={search ?? undefined}
            />
            <div className="w-full sm:w-auto mt-3 sm:mt-0 flex items-center gap-2">
              {/* A2: List / Grid toggle. Preserve existing query params. */}
              <div className="flex items-center gap-2 mr-2">
                <Link
                  href={(() => {
                    const p = new URLSearchParams();
                    if (search) p.set("search", search);
                    if (selectedDay) p.set("day", selectedDay);
                    if (selectedCity && selectedCity !== "all") p.set("city", selectedCity);
                    if (selectedStatus && selectedStatus !== "all") p.set("status", selectedStatus);
                    p.set("view", "list");
                    return `/open-mics?${p.toString()}`;
                  })()}
                  className={view === "list" ? "px-3 py-2 rounded bg-[var(--color-accent-primary)] text-[var(--color-background)] text-sm font-semibold" : "px-3 py-2 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-sm font-semibold"}
                >
                  List View
                </Link>

                <Link
                  href={(() => {
                    const p = new URLSearchParams();
                    if (search) p.set("search", search);
                    if (selectedDay) p.set("day", selectedDay);
                    if (selectedCity && selectedCity !== "all") p.set("city", selectedCity);
                    if (selectedStatus && selectedStatus !== "all") p.set("status", selectedStatus);
                    p.set("view", "grid");
                    return `/open-mics?${p.toString()}`;
                  })()}
                  className={view === "grid" ? "px-3 py-2 rounded bg-[var(--color-accent-primary)] text-[var(--color-background)] text-sm font-semibold" : "px-3 py-2 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-sm font-semibold"}
                >
                  Grid View
                </Link>
              </div>

              <MapViewButton />
            </div>
            
            <div className="mb-6 flex justify-end">
              <Link
                href="/submit-open-mic"
                className="inline-block rounded-xl bg-gradient-to-r from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-text-accent)] ring-1 ring-[var(--color-border-accent)] hover:shadow-[var(--shadow-glow-gold-sm)] transition"
              >
                Submit, claim, or update an Open Mic
              </Link>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] p-10 text-center">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                No open mics listed yet. Check back soon!
              </h2>
            </div>
          ) : (
            <>
              {view === "grid" ? (
                <>
                  <DayJumpBar />
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day) => {
                    const dayEvents = events.filter((e: any) => (e.day_of_week ?? "").toLowerCase() === day.toLowerCase());
                    return (
                      <section key={day} aria-labelledby={`day-${day}`} className="mt-6">
                        <h2 id={`day-${day}`} className="text-xl font-semibold text-[var(--color-text-accent)] mt-8 mb-3">
                          {day}
                        </h2>

                        {dayEvents.length === 0 ? (
                          <p className="text-[var(--color-text-tertiary)] text-sm">No open mics listed for this day.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {dayEvents.map((ev: any) => (
                              <EventCard key={ev.id} event={ev} searchQuery={search ?? undefined} />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </>
              ) : (
                <div className="mt-4">
                  <AccordionList events={events as any} searchQuery={search ?? undefined} />
                </div>
              )}

            </>
          )}

        {/* Contribution Section */}
        <div className="py-10">
          <section className="rounded-3xl border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)] p-8 md:p-12 space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
                Help Keep This Directory Accurate
              </h2>
              <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] max-w-3xl mx-auto">
                We are building the most accurate, up-to-date, and easy-to-use open mic directory in the region — but we cannot do it alone. Denver&apos;s music scene moves quickly, and venues update their schedules often.
              </p>
              <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
                Your input makes the directory stronger, more reliable, and more helpful for everyone in the community.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
              <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]/50 p-5 space-y-2">
                <h3 className="text-[length:var(--font-size-body)] font-semibold text-[var(--color-text-accent)]">
                  Submit New Open Mics
                </h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                  Tell us about new open mics we haven&apos;t listed yet.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]/50 p-5 space-y-2">
                <h3 className="text-[length:var(--font-size-body)] font-semibold text-[var(--color-text-accent)]">
                  Report Changes
                </h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                  Report changes to day, time, venue, or signup rules.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]/50 p-5 space-y-2">
                <h3 className="text-[length:var(--font-size-body)] font-semibold text-[var(--color-text-accent)]">
                  Confirm Active Events
                </h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                  Confirm events that are active or discontinued.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]/50 p-5 space-y-2">
                <h3 className="text-[length:var(--font-size-body)] font-semibold text-[var(--color-text-accent)]">
                  Add Venue Details
                </h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                  Provide venue details that help performers plan.
                </p>
              </div>
            </div>

            <div className="text-center pt-4">
              <Link
                href="/submit-open-mic"
                className="inline-block rounded-xl bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-hover)] px-8 py-4 text-lg font-semibold text-[var(--color-background)] hover:shadow-[0_0_20px_rgba(255,216,106,0.35)] transition"
              >
                Submit, Claim, or Update an Open Mic
              </Link>
            </div>
          </section>
        </div>
        </div>
      </PageContainer>
    </>
  );
}
