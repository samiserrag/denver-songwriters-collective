import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HeroSection, PageContainer } from "@/components/layout";
import { EventGrid } from "@/components/events";
import { PerformerGrid } from "@/components/performers";
import { StudioGrid } from "@/components/studios";
import type { Database } from "@/lib/supabase/database.types";
import type { Event, Performer, Studio } from "@/types";

export const dynamic = "force-dynamic";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];
type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

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

function mapDBProfileToPerformer(profile: DBProfile): Performer {
  return {
    id: profile.id,
    name: profile.full_name ?? "Anonymous Performer",
    bio: profile.bio ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
  };
}

function mapDBProfileToStudio(profile: DBProfile): Studio {
  return {
    id: profile.id,
    name: profile.full_name ?? "Unnamed Studio",
    description: profile.bio ?? undefined,
  };
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  // --- AUTH CHECK ---
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName = user?.email ?? null;

  // --- HOMEPAGE DATA ---
  const [featuredEventsRes, upcomingEventsRes, featuredPerformersRes, featuredStudiosRes] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("featured_rank", { ascending: true })
      .order("event_date", { ascending: true })
      .limit(6),
    supabase
      .from("events")
      .select("*")
      .gte("event_date", new Date().toISOString().slice(0, 10))
      .order("event_date", { ascending: true })
      .limit(6),
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "performer")
      .order("is_featured", { ascending: false })
      .order("featured_rank", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "studio")
      .order("is_featured", { ascending: false })
      .order("featured_rank", { ascending: true })
      .order("created_at", { ascending: false})
      .limit(6),
  ]);

  const featuredEvents: Event[] = (featuredEventsRes.data ?? []).map(mapDBEventToEvent);
  const upcomingEvents: Event[] = (upcomingEventsRes.data ?? []).map(mapDBEventToEvent);
  const featuredPerformers: Performer[] = (featuredPerformersRes.data ?? []).map(
    mapDBProfileToPerformer,
  );
  const featuredStudios: Studio[] = (featuredStudiosRes.data ?? []).map(mapDBProfileToStudio);

  const hasFeaturedEvents = featuredEvents.length > 0;
  const hasUpcomingEvents = upcomingEvents.length > 0;
  const hasFeaturedPerformers = featuredPerformers.length > 0;
  const hasFeaturedStudios = featuredStudios.length > 0;

  return (
    <>
      <HeroSection minHeight="lg">
        <PageContainer>
          <div className="max-w-3xl space-y-6">
            {/* LOGIN-AWARE GREETING */}
            {user ? (
              <p className="text-gold-400 font-medium text-lg">
                Welcome back, {userName}
              </p>
            ) : (
              <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-gold)]/80 uppercase">
                Denver • Songwriters • Community
              </p>
            )}

            <h1 className="text-gradient-gold text-[length:var(--font-size-heading-2xl)] font-[var(--font-family-serif)] italic leading-tight">
              Open Mic Drop
            </h1>

            <p className="text-lg text-neutral-200 max-w-xl">
              A curated home for Denver&apos;s songwriters, showcases, and
              studio sessions. Discover new voices, claim open mic slots, and
              book time with partner studios—all in one place.
            </p>

            {/* LOGIN-AWARE BUTTONS */}
            <div className="flex flex-wrap gap-4">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium
                      bg-[var(--color-gold)] text-black shadow-lg shadow-[var(--color-gold)]/30
                      hover:shadow-[var(--color-gold)]/50 hover:-translate-y-0.5 transition-transform"
                  >
                    Go to Dashboard
                  </Link>
                  <Link
                    href="/dashboard/appointments"
                    className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium
                      border border-[var(--color-gold)]/50 text-[var(--color-gold)]
                      hover:bg-[var(--color-gold)]/10 transition-colors"
                  >
                    Your Appointments
                  </Link>
                </>
              ) : (
                <>
                  <a
                    href="/events"
                    className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium
                      bg-[var(--color-gold)] text-black shadow-lg shadow-[var(--color-gold)]/30
                      hover:shadow-[var(--color-gold)]/50 hover:-translate-y-0.5 transition-transform"
                  >
                    Browse events
                  </a>
                  <a
                    href="/performers"
                    className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium
                      border border-[var(--color-gold)]/50 text-[var(--color-gold)]
                      hover:bg-[var(--color-gold)]/10 transition-colors"
                  >
                    Meet the artists
                  </a>
                </>
              )}
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12 space-y-16">
          {/* Featured Events */}
          <section>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Featured Events
                </h2>
                <p className="text-sm text-neutral-400">
                  Don&apos;t miss these curated showcases and special nights.
                </p>
              </div>
              <a
                href="/events"
                className="text-sm font-medium text-[var(--color-gold)] hover:underline"
              >
                View all events
              </a>
            </div>
            {hasFeaturedEvents ? (
              <EventGrid events={featuredEvents} />
            ) : (
              <p className="text-sm text-neutral-400">
                No featured events at this time.
              </p>
            )}
          </section>

          {/* Spotlight Performers */}
          <section>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Spotlight Performers
                </h2>
                <p className="text-sm text-neutral-400">
                  Featured artists from the Denver songwriting community.
                </p>
              </div>
              <a
                href="/performers"
                className="text-sm font-medium text-[var(--color-gold)] hover:underline"
              >
                View all performers
              </a>
            </div>
            {hasFeaturedPerformers ? (
              <PerformerGrid performers={featuredPerformers} />
            ) : (
              <p className="text-sm text-neutral-400">
                No spotlight performers at this time.
              </p>
            )}
          </section>

          {/* Featured Studios */}
          <section>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Featured Studios
                </h2>
                <p className="text-sm text-neutral-400">
                  Top-rated partner studios for your recording sessions.
                </p>
              </div>
              <a
                href="/studios"
                className="text-sm font-medium text-[var(--color-gold)] hover:underline"
              >
                View all studios
              </a>
            </div>
            {hasFeaturedStudios ? (
              <StudioGrid studios={featuredStudios} />
            ) : (
              <p className="text-sm text-neutral-400">
                No featured studios at this time.
              </p>
            )}
          </section>

          {/* Upcoming Events */}
          <section>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Upcoming Events
                </h2>
                <p className="text-sm text-neutral-400">
                  All upcoming showcases, open mics, and special nights.
                </p>
              </div>
              <a
                href="/events"
                className="text-sm font-medium text-[var(--color-gold)] hover:underline"
              >
                View all events
              </a>
            </div>
            {hasUpcomingEvents ? (
              <EventGrid events={upcomingEvents} />
            ) : (
              <p className="text-sm text-neutral-400">
                No upcoming events scheduled. Check back soon.
              </p>
            )}
          </section>
        </div>
      </PageContainer>
    </>
  );
}
