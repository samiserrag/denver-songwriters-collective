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
  const venueName =
    e.venues?.name ?? e.venue_name ?? (e.venue_id ? "Venue" : "TBA");
  const addressParts = [
    e.venues?.address ?? e.venue_address,
    e.venues?.city,
    e.venues?.state,
  ].filter((v): v is string => Boolean(v));
  const location = addressParts.join(", ");

  const _evt: any = {
    id: e.id,
    title: e.title,
    description: e.description ?? undefined,
    date: e.event_date ?? "",
    time: formatTime(e),
    venue: venueName ?? "TBA",
    location: location || undefined,
    mapUrl: getMapUrl(
      (e.venues as any)?.google_maps_url,
      (e.venues as any)?.map_link,
      venueName,
      addressParts.length > 0 ? addressParts : undefined
    ),
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
      `id,slug,title,description,event_date,start_time,signup_time,category,recurrence_rule,day_of_week,venue_id,venue_name,venue_address,venues(name,address,city,state,website,phone,map_link,google_maps_url),status,notes`
    )
    .eq("event_type", "open_mic")
    .eq("status", "active")
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
            Find open mics across the Denver metro area. Click any venue to get directions.
          </p>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="mt-6">
          <Link href="/open-mics?view=list" className="text-[#00FFCC] hover:underline">
            ← Back to List View
          </Link>
        </div>

        {/* Embedded Google Map centered on Denver */}
        <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d196281.12937236825!2d-104.99519357812503!3d39.764519!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x876b80aa231f17cf%3A0x118ef4f8278a36d6!2sDenver%2C%20CO!5e0!3m2!1sen!2sus!4v1733500000000!5m2!1sen!2sus"
            width="100%"
            height="400"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Denver Area Map"
            className="w-full"
          />
        </div>

        <div className="mt-4 text-center text-sm text-[var(--color-warm-gray)]">
          <p>Click any venue below to get directions on Google Maps</p>
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
