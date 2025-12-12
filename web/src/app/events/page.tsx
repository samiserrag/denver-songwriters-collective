import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventGrid } from "@/components/events";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import Link from "next/link";
import type { Database } from "@/lib/supabase/database.types";
import type { Event } from "@/types";
import { EVENT_TYPE_CONFIG } from "@/types/events";

export const metadata: Metadata = {
  title: "Happenings | Denver Songwriters Collective",
  description: "Discover songwriter showcases, song circles, workshops, and special happenings in Denver's music community.",
};

export const dynamic = "force-dynamic";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];

function mapDBEventToEvent(dbEvent: DBEvent): Event {
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description ?? undefined,
    date: dbEvent.event_date,
    time: dbEvent.start_time,
    venue: dbEvent.venue_name ?? "TBA",
    location: dbEvent.venue_address ?? undefined,
  };
}

const eventTypes = [
  {
    name: "Open Mics",
    description: "Welcoming, supportive performance nights for sharing original music.",
  },
  {
    name: "Curated Showcases",
    description: "Longer sets from a small group of artists with an attentive audience.",
  },
  {
    name: "Song Clubs",
    description: "Intimate gatherings for sharing works-in-progress and offering gentle feedback.",
  },
  {
    name: "Meetups & Socials",
    description: "Friendly hangouts where relationships grow naturally.",
  },
  {
    name: "Co-Writing Nights",
    description: "Match-based writing sessions for creative pairings and group ideas.",
  },
  {
    name: "Busking Meetups",
    description: "Outdoor performances that explore Denver's public music scene.",
  },
  {
    name: "Studio Days",
    description: "Recording sessions, demo workshops, mixing intros, and production mentorship.",
  },
  {
    name: "Listening Rooms",
    description: "Quiet, intimate shows that highlight songwriting craft.",
  },
  {
    name: "Livestream Events",
    description: "Broadcast shows, interviews, behind-the-scenes content, and digital showcases.",
  },
  {
    name: "Venue Spotlights",
    description: "Nights hosted in partnership with local bars, breweries, coffee shops, and art spaces.",
  },
  {
    name: "Collaborative Jams",
    description: "Low-pressure musical gatherings to experiment and improvise together.",
  },
];

interface DSCEvent {
  id: string;
  title: string;
  event_type: string;
  venue_name: string | null;
  venue_address: string | null;
  day_of_week: string | null;
  start_time: string | null;
  capacity: number | null;
  cover_image_url: string | null;
  event_hosts: Array<{
    user: { full_name: string | null } | null;
  }>;
  rsvp_count?: number;
}

function getGoogleMapsUrl(address: string | null): string | null {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default async function EventsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: dbEvents } = await supabase
    .from("events")
    .select("*")
    .neq('event_type', 'open_mic')
    .order("event_date", { ascending: true });

  const events: Event[] = (dbEvents ?? []).map(mapDBEventToEvent);

  // Fetch DSC community events
  const { data: dscEventsData } = await supabase
    .from("events")
    .select(`
      id, title, event_type, venue_name, venue_address, day_of_week, start_time, capacity, cover_image_url,
      event_hosts(user:profiles(full_name))
    `)
    .eq("is_dsc_event", true)
    .eq("status", "active")
    .order("day_of_week", { ascending: true });

  // Get RSVP counts for DSC events
  const dscEvents: DSCEvent[] = await Promise.all(
    ((dscEventsData as unknown as DSCEvent[]) || []).map(async (event) => {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed");
      return { ...event, rsvp_count: count || 0 };
    })
  );

  return (
    <>
      {/* Hero Header with Background Image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img
          src="/images/open-mic-placeholder.jpg"
          alt="Denver Songwriters Events"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] drop-shadow-lg">
              Happenings
            </h1>
            <p className="text-lg text-[var(--color-gold)] mt-2 drop-shadow">
              Showcases, song circles, workshops, and community gatherings
            </p>
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="py-12 space-y-16">

          {/* DSC Community Events */}
          {dscEvents.length > 0 && (
            <section>
              <div className="mb-6">
                <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-2">
                  Community Events
                </h2>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                  Song circles, workshops, and gatherings hosted by DSC members
                </p>
              </div>
              <div className="grid gap-4">
                {dscEvents.map((event) => {
                  const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
                    || EVENT_TYPE_CONFIG.other;
                  const hostNames = event.event_hosts
                    ?.map((h) => h.user?.full_name)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(", ");
                  const remaining = event.capacity
                    ? Math.max(0, event.capacity - (event.rsvp_count || 0))
                    : null;
                  const mapsUrl = getGoogleMapsUrl(event.venue_address);

                  return (
                    <div
                      key={event.id}
                      className="bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg overflow-hidden"
                    >
                      {/* Cover Image */}
                      {event.cover_image_url && (
                        <Link href={`/events/${event.id}`} className="block">
                          <img
                            src={event.cover_image_url}
                            alt={event.title}
                            className="w-full h-40 object-cover hover:opacity-90 transition-opacity"
                          />
                        </Link>
                      )}
                      <Link
                        href={`/events/${event.id}`}
                        className="block p-6 hover:bg-[var(--color-indigo-950)]/70 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">{config.icon}</span>
                              <span className="px-2 py-0.5 bg-[var(--color-indigo-950)] text-[var(--color-warm-gray-light)] text-xs rounded">
                                {config.label}
                              </span>
                              <span className="px-2 py-0.5 bg-[var(--color-gold)]/20 text-[var(--color-gold)] text-xs rounded">
                                DSC Event
                              </span>
                            </div>
                            <h3 className="text-lg font-medium text-[var(--color-warm-white)] mb-1">{event.title}</h3>
                            <p className="text-[var(--color-warm-gray)] text-sm">
                              {event.venue_name} {event.day_of_week && `• ${event.day_of_week}s`} {event.start_time && `at ${event.start_time}`}
                            </p>
                            {hostNames && (
                              <p className="text-[var(--color-warm-gray)] text-xs mt-2">
                                Hosted by {hostNames}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-[var(--color-warm-white)]">{event.rsvp_count || 0}</div>
                            <div className="text-xs text-[var(--color-warm-gray)]">
                              {event.capacity ? (
                                remaining === 0 ? (
                                  <span className="text-amber-400">Full</span>
                                ) : (
                                  `${remaining} left`
                                )
                              ) : (
                                "going"
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                      {/* Google Maps Link */}
                      {mapsUrl && (
                        <div className="px-6 pb-4 -mt-2">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Get Directions
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Event Types Grid */}
          <section>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {eventTypes.map((eventType) => (
                <div
                  key={eventType.name}
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-5 space-y-2"
                >
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-gold)]">
                    {eventType.name}
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)] leading-relaxed">
                    {eventType.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Open Mic Directory Callout */}
          <section className="rounded-2xl border border-teal-500/30 bg-teal-900/20 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-teal-300 mb-2">
                  Looking for Open Mics?
                </h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)]">
                  Explore Denver&apos;s full open mic scene in our community-maintained directory.
                </p>
              </div>
              <Button asChild variant="primary" size="lg">
                <Link href="/open-mics">Visit the Open Mic Directory</Link>
              </Button>
            </div>
          </section>

          {/* Upcoming Events */}
          <section>
            <div className="mb-8">
              <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-2">
                Upcoming Events
              </h2>
              <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                Showcases, special nights, and community gatherings.
              </p>
            </div>
            {events.length > 0 ? (
              <EventGrid events={events} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#05060b] to-[#000000] p-10 text-center">
                <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray)]">
                  No upcoming events scheduled. Check back soon!
                </p>
              </div>
            )}
          </section>

          {/* Get Involved CTA */}
          <section className="rounded-3xl border border-[var(--color-gold)]/20 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-8 md:p-12 text-center space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Want to Help Shape Our Events?
            </h2>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              We&apos;re always looking for volunteers, venues, and partners to help expand our event offerings across the Front Range.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              <Button asChild variant="primary" size="lg">
                <Link href="/get-involved">Get Involved</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/partners">Partner With Us</Link>
              </Button>
            </div>
          </section>

        </div>
      </PageContainer>
    </>
  );
}
