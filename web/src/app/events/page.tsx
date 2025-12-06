import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventGrid } from "@/components/events";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import Link from "next/link";
import type { Database } from "@/lib/supabase/database.types";
import type { Event } from "@/types";

export const metadata: Metadata = {
  title: "Events | Denver Songwriters Collective",
  description: "Discover songwriter showcases, song circles, workshops, and special events in Denver's music community.",
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

export default async function EventsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: dbEvents } = await supabase
    .from("events")
    .select("*")
    .neq('event_type', 'open_mic')
    .order("event_date", { ascending: true });

  const events: Event[] = (dbEvents ?? []).map(mapDBEventToEvent);

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
              Events
            </h1>
            <p className="text-lg text-[var(--color-gold)] mt-2 drop-shadow">
              Showcases, song circles, workshops, and community gatherings
            </p>
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="py-12 space-y-16">

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
