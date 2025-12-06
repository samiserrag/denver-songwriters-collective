import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import EventCard from "@/components/EventCard";
import type { Event as EventType } from "@/types";
export const dynamic = "force-dynamic";

type DBEvent = {
  id: string;
  title: string;
  description?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  signup_time?: string | null;
  category?: string | null;
  recurrence_rule?: string | null;
  venue_id?: string | null;
  venues?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    website?: string | null;
    phone?: string | null;
    map_link?: string | null;
  } | null;
  venue_name?: string | null;
  venue_address?: string | null;
  slug?: string | null;
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
  const venueName =
    e.venues?.name ?? e.venue_name ?? (e.venue_id ? "Venue" : "TBA");
  const addressParts = [
    e.venues?.address ?? e.venue_address,
    e.venues?.city,
    e.venues?.state,
  ].filter(Boolean);
  const location = addressParts.join(", ");

  const _evt: any = {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    date: e.event_date ?? "",
    time: formatTime(e),
    venue: venueName ?? "TBA",
    location: location || undefined,
    mapUrl:
      (e.venues as any)?.google_maps_url ??
      (e.venues as any)?.map_link ??
      e.venues?.website ??
      (addressParts.length ? `https://maps.google.com/?q=${encodeURIComponent(addressParts.join(", "))}` : undefined),
    slug: e.slug ?? undefined,
    signup_time: e.signup_time ?? null,
    category: e.category ?? null,
    eventType: "open_mic",
  };
  return _evt as EventType;
}

export default async function OpenMicsMapPage() {
  const supabase = await createSupabaseServerClient();

  const { data: dbEvents } = await supabase
    .from("events")
    .select(
      `id,slug,title,description,event_date,start_time,signup_time,category,recurrence_rule,day_of_week,venue_id,venue_name,venue_address,venues(name,address,city,state,website,phone,map_link),status,notes`
    )
    .eq("event_type", "open_mic")
    .order("day_of_week", { ascending: true });

  const events = ((dbEvents ?? []) as DBEvent[]).map(mapDBEventToEvent);

  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-2">
            Open Mic Map
          </h1>
          <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] max-w-3xl">
            Interactive map coming soon. Use the list below to navigate to events.
          </p>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="mt-6">
          <Link href="/open-mics?view=list" className="text-[#00FFCC] hover:underline">
            ← Back to List View
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#05060b] to-[#000000] p-8 text-center">
          <p className="text-white font-semibold">Interactive map coming soon. Use the list below.</p>
        </div>

        <div className="mt-8">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#05060b] to-[#000000] p-10 text-center">
              <h2 className="text-xl font-semibold text-[var(--color-warm-white)]">
                No open mics listed yet. Check back soon!
              </h2>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {events.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
