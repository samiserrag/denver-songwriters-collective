import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import type { Event as EventType } from "@/types";
import type { EventWithVenue } from "@/types/db";
import EventCard from "@/components/EventCard";
import OpenMicFilters from "@/components/OpenMicFilters";
import MapViewButton from "@/components/MapViewButton";
import CompactListItem from "@/components/CompactListItem";
import AccordionList from "@/components/AccordionList";
import DayJumpBar from "@/components/DayJumpBar";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
export const dynamic = "force-dynamic";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DBEvent = {
  id: string;
  title: string;
  description?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  recurrence_rule?: string | null;
  day_of_week?: string | null;
  venue_id?: string | null;
  // joined venue fields (may be null if not present)
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
  // fallback denormalized fields (if present)
  venue_name?: string | null;
  venue_address?: string | null;
  slug?: string | null;
  status?: string | null;
};

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
  const venueName = e.venues?.name ?? e.venue_name ?? (e.venue_id ? "Venue" : "TBA");
  const venueCity = e.venues?.city ?? null;
  const venueState = e.venues?.state ?? null;
  const addressParts = [
    e.venues?.address ?? e.venue_address,
    venueCity,
    venueState,
  ].filter(Boolean);
  const location = addressParts.join(", ");

  const mapUrl =
    e.venues?.google_maps_url ??
    e.venues?.map_link ??
    e.venues?.website_url ??
    (addressParts.length ? `https://maps.google.com/?q=${encodeURIComponent(addressParts.join(", "))}` : undefined);

  const _evt: any = {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    date: e.event_date ?? "",
    start_time: e.start_time ?? null,
    end_time: e.end_time ?? null,
    recurrence_rule: e.recurrence_rule ?? null,
    day_of_week: e.day_of_week ?? null,
    venue: venueName ?? "TBA",
    venue_name: venueName ?? null,
    venue_city: venueCity,
    venue_state: venueState,
    venue_address: e.venue_address ?? null,
    location: location || undefined,
    mapUrl,
    slug: e.slug ?? undefined,
    // preserve original status from DB for visual labeling (do not filter)
    status: e.status ?? null,
    eventType: "open_mic",
  };
  return _evt as EventType;
}

export default async function OpenMicsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; active?: string; search?: string; city?: string; page?: string; view?: string }>;
}) {
  const params = await searchParams;

  const view = params?.view ?? "list";

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

  // Fetch distinct cities for the city dropdown
  const { data: cityRows } = await supabase
    .from("venues")
    .select("city")
    .not("city", "is", null);

  const cities = Array.from(
    new Set((cityRows ?? []).map((r: any) => (r.city ?? "").trim()).filter(Boolean))
  ).sort((a: string, b: string) => a.localeCompare(b));

  // Build events query
  let query = supabase
    .from("events")
    .select(
      `id,slug,title,description,event_date,start_time,recurrence_rule,day_of_week,venue_id,venue_name,venue_address,venues(name,address,city,state,website_url,phone,map_link,google_maps_url),status,notes`,
      { count: "exact" }
    )
    .eq("event_type", "open_mic");

  if (selectedDay) {
    query = query.eq("day_of_week", selectedDay);
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
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#05060b] to-[#000000] p-10 text-center">
              <h2 className="text-xl font-semibold text-[var(--color-warm-white)]">
                No open mics found in {selectedCity}
              </h2>
            </div>
          </div>
        </PageContainer>
      );
    }

    query = query.in("venue_id", venueIds);
  }

  if (safeSearch) {
    const like = `%${safeSearch}%`;
    // Fallback to ilike across several fields (excluding joined relation fields which aren't supported in .or())
    query = query.or(
      `title.ilike.${like},venue_name.ilike.${like},notes.ilike.${like},day_of_week.ilike.${like},recurrence_rule.ilike.${like}`
    );
  }


  const { data: dbEvents, error, count } = await query;

  // Map and sort results client-side: day_of_week (Sun->Sat), start_time, then city
  const mapped = ((dbEvents ?? []) as DBEvent[]).map(mapDBEventToEvent) as any[];

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

  const events = mapped.sort((a, b) => {
    const dayA = DAYS.indexOf(a.day_of_week ?? "");
    const dayB = DAYS.indexOf(b.day_of_week ?? "");
    const dayIdxA = dayA === -1 ? 7 : dayA;
    const dayIdxB = dayB === -1 ? 7 : dayB;
    if (dayIdxA !== dayIdxB) return dayIdxA - dayIdxB;

    const tA = parseTimeToMinutes(a.start_time ?? null);
    const tB = parseTimeToMinutes(b.start_time ?? null);
    if (tA !== tB) return tA - tB;

    const cityA = (a.venue_city ?? "").toLowerCase();
    const cityB = (b.venue_city ?? "").toLowerCase();
    if (cityA < cityB) return -1;
    if (cityA > cityB) return 1;
    return 0;
  });



  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-2">
            Denver Open Mic Directory
          </h1>
          <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] max-w-3xl">
            A living list of weekly open mics submitted by the community.
          </p>

        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="mt-6 rounded-2xl border border-white/5 bg-gradient-to-r from-[#050814] to-[#02040a] px-4 py-3 text-sm text-slate-200">
          <p className="font-semibold text-teal-300">Community-curated open mics</p>
          <p className="mt-1 text-slate-300">
            These listings are gathered from public sources and may be incomplete or out of date.
            Please contact the venue to confirm details, and{" "}
            <a
              href="/submit-open-mic"
              className="underline decoration-teal-400/70 underline-offset-2 hover:text-teal-300"
            >
              help us keep this list updated
            </a>
            .
          </p>
        </div>
      </PageContainer>

      <PageContainer>
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <OpenMicFilters
              cities={cities}
              selectedCity={selectedCity === "all" ? undefined : selectedCity}
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
                    p.set("view", "list");
                    return `/open-mics?${p.toString()}`;
                  })()}
                  className={view === "list" ? "px-3 py-2 rounded bg-teal-600 text-white text-sm font-semibold" : "px-3 py-2 rounded bg-gray-800 text-gray-300 text-sm font-semibold"}
                >
                  List View
                </Link>

                <Link
                  href={(() => {
                    const p = new URLSearchParams();
                    if (search) p.set("search", search);
                    if (selectedDay) p.set("day", selectedDay);
                    if (selectedCity && selectedCity !== "all") p.set("city", selectedCity);
                    p.set("view", "grid");
                    return `/open-mics?${p.toString()}`;
                  })()}
                  className={view === "grid" ? "px-3 py-2 rounded bg-teal-600 text-white text-sm font-semibold" : "px-3 py-2 rounded bg-gray-800 text-gray-300 text-sm font-semibold"}
                >
                  Grid View
                </Link>
              </div>

              <MapViewButton />
            </div>
            
            <div className="mb-6 flex justify-end">
              <Link
                href="/submit-open-mic"
                className="inline-block rounded-xl bg-gradient-to-r from-[#00202b] to-[#000] px-5 py-2 text-sm font-semibold text-[#00FFCC] ring-1 ring-[#00FFCC]/10 hover:shadow-[0_0_14px_rgba(0,255,204,0.15)] transition"
              >
                Submit, claim, or update an Open Mic
              </Link>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#05060b] to-[#000000] p-10 text-center">
              <h2 className="text-xl font-semibold text-[var(--color-warm-white)]">
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
                        <h2 id={`day-${day}`} className="text-xl font-semibold text-teal-300 mt-8 mb-3">
                          {day}
                        </h2>

                        {dayEvents.length === 0 ? (
                          <p className="text-gray-400 text-sm">No open mics listed for this day.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div className="mt-6">
                  <AccordionList events={events as any} searchQuery={search ?? undefined} />
                </div>
              )}

            </>
          )}
        </div>
      </PageContainer>
    </>
  );
}
