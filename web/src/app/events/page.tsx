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
    start_time: dbEvent.start_time,
    end_time: dbEvent.end_time,
    venue: dbEvent.venue_name ?? "TBA",
    venue_address: dbEvent.venue_address ?? undefined,
    location: dbEvent.venue_address ?? undefined,
    capacity: dbEvent.capacity,
    is_dsc_event: dbEvent.is_dsc_event,
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
  const today = new Date().toISOString().split("T")[0];

  // Fetch upcoming events (excluding open mics and DSC community events, published only)
  // DSC events are shown separately in the Community Happenings section
  const { data: upcomingDbEvents } = await supabase
    .from("events")
    .select("*")
    .neq('event_type', 'open_mic')
    .neq('is_dsc_event', true)
    .eq('is_published', true)
    .gte('event_date', today)
    .order("event_date", { ascending: true });

  const upcomingEvents: Event[] = (upcomingDbEvents ?? []).map(mapDBEventToEvent);

  // Fetch past events (excluding open mics and DSC events) - last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const { data: pastDbEvents } = await supabase
    .from("events")
    .select("*")
    .neq('event_type', 'open_mic')
    .neq('is_dsc_event', true)
    .eq('is_published', true)
    .lt('event_date', today)
    .gte('event_date', thirtyDaysAgoStr)
    .order("event_date", { ascending: false })
    .limit(6);

  const pastEvents: Event[] = (pastDbEvents ?? []).map(mapDBEventToEvent);

  // Fetch DSC community events (published only)
  // Note: event_hosts.user_id references auth.users, not profiles
  // So we fetch hosts without profile join, then fetch profiles separately
  const { data: dscEventsData } = await supabase
    .from("events")
    .select(`
      id, title, event_type, venue_name, venue_address, day_of_week, start_time, capacity, cover_image_url,
      event_hosts(user_id)
    `)
    .eq("is_dsc_event", true)
    .eq("status", "active")
    .eq("is_published", true)
    .order("day_of_week", { ascending: true });

  // Collect all host user_ids and fetch profiles
  const allHostUserIds = (dscEventsData || []).flatMap(e =>
    (e.event_hosts as { user_id: string }[])?.map(h => h.user_id) || []
  );
  const uniqueHostUserIds = [...new Set(allHostUserIds)];

  let hostProfileMap = new Map<string, { full_name: string | null }>();
  if (uniqueHostUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uniqueHostUserIds);

    hostProfileMap = new Map(profiles?.map(p => [p.id, { full_name: p.full_name }]) || []);
  }

  // Enrich events with host profiles and get RSVP counts
  const dscEvents: DSCEvent[] = await Promise.all(
    (dscEventsData || []).map(async (event) => {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      // Map hosts with profiles
      const enrichedHosts = (event.event_hosts as { user_id: string }[])?.map(h => ({
        user: hostProfileMap.get(h.user_id) || null
      })) || [];

      return {
        ...event,
        event_hosts: enrichedHosts,
        rsvp_count: count || 0
      } as DSCEvent;
    })
  );

  return (
    <>
      {/* Page Header */}
      <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
            Happenings
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] mt-3">
            Showcases, song circles, workshops, and community gatherings
          </p>
        </div>
      </div>

      <PageContainer>
        <div className="py-12 space-y-16">

          {/* Community Happenings - Single consolidated section */}
          <section>
            <div className="mb-6">
              <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-2">
                Upcoming Happenings
              </h2>
              <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                Song circles, workshops, showcases, and community gatherings
              </p>
            </div>
            {dscEvents.length > 0 || upcomingEvents.length > 0 ? (
              <div className="space-y-6">
                {/* DSC Community Events */}
                {dscEvents.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

                      return (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          className="block p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg hover:bg-[var(--color-bg-tertiary)]/50 hover:border-[var(--color-border-accent)] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{config.icon}</span>
                                <span className="px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-xs rounded truncate">
                                  {config.label}
                                </span>
                              </div>
                              <h3 className="text-[var(--color-text-primary)] font-medium mb-1 line-clamp-1">{event.title}</h3>
                              <p className="text-[var(--color-text-secondary)] text-sm line-clamp-1">
                                • {event.day_of_week}s {event.start_time && `at ${event.start_time}`}
                              </p>
                              {hostNames && (
                                <p className="text-[var(--color-text-secondary)] text-xs mt-1.5 line-clamp-1">
                                  Hosted by {hostNames}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xl font-bold text-[var(--color-text-primary)]">{event.rsvp_count || 0}</div>
                              <div className="text-xs text-[var(--color-text-secondary)]">
                                {event.capacity ? (
                                  remaining === 0 ? (
                                    <span className="text-amber-400">Full</span>
                                  ) : (
                                    `of ${event.capacity}`
                                  )
                                ) : (
                                  "going"
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {/* Other upcoming events (non-DSC) */}
                {upcomingEvents.length > 0 && (
                  <EventGrid events={upcomingEvents} />
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-10 text-center">
                <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)]">
                  No upcoming happenings scheduled. Check back soon!
                </p>
              </div>
            )}
          </section>

          {/* Open Mic Directory Callout */}
          <section className="rounded-2xl border border-[var(--color-border-accent)]/30 bg-[var(--color-accent-primary)]/10 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-2">
                  Looking for Open Mics?
                </h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                  Explore Denver&apos;s full open mic scene in our community-maintained directory.
                </p>
              </div>
              <Button asChild variant="primary" size="lg">
                <Link href="/open-mics">Visit the Open Mic Directory</Link>
              </Button>
            </div>
          </section>

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <section>
              <div className="mb-6">
                <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-2">
                  Past Events
                </h2>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                  Recent happenings from the community.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pastEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]/50 opacity-75"
                  >
                    <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                      {event.date ? new Date(event.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      }) : "Date TBA"}
                    </p>
                    <h3 className="text-[var(--color-text-primary)] font-medium line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-1">
                      {typeof event.venue === "string" ? event.venue : event.venue?.name || "Venue TBA"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Event Types We Need Help Hosting */}
          <section>
            <div className="mb-4">
              <h2 className="text-[length:var(--font-size-heading-md)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-1">
                Types of Events We Need Volunteers &amp; Venues to Help Us Host
              </h2>
              <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                Have a space or want to help? Reach out to host one of these!
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((eventType) => (
                <div
                  key={eventType.name}
                  className="group relative px-3 py-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-colors cursor-default"
                >
                  <span className="text-sm text-[var(--color-text-primary)]">
                    {eventType.name}
                  </span>
                  {/* Tooltip */}
                  <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] shadow-lg z-10">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {eventType.description}
                    </p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-[var(--color-bg-tertiary)] border-b border-r border-[var(--color-border-default)] transform rotate-45" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Get Involved CTA */}
          <section className="rounded-3xl border border-[var(--color-border-accent)]/20 bg-[var(--color-bg-secondary)] p-8 md:p-12 text-center space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Want to Help Shape Our Happenings?
            </h2>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              We&apos;re always looking for volunteers, venues, and partners to help expand our offerings across the Front Range.
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
