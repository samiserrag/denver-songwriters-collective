import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HeroSection, PageContainer } from "@/components/layout";
import { EventGrid } from "@/components/events";
import { PerformerGrid } from "@/components/performers";
import { StudioGrid } from "@/components/studios";
import { Button } from "@/components/ui";
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  const userName = user?.email ?? null;

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
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const featuredEvents: Event[] = (featuredEventsRes.data ?? []).map(mapDBEventToEvent);
  const upcomingEvents: Event[] = (upcomingEventsRes.data ?? []).map(mapDBEventToEvent);
  const featuredPerformers: Performer[] = (featuredPerformersRes.data ?? []).map(mapDBProfileToPerformer);
  const featuredStudios: Studio[] = (featuredStudiosRes.data ?? []).map(mapDBProfileToStudio);

  const hasFeaturedEvents = featuredEvents.length > 0;
  const hasUpcomingEvents = upcomingEvents.length > 0;
  const hasFeaturedPerformers = featuredPerformers.length > 0;
  const hasFeaturedStudios = featuredStudios.length > 0;

  return (
    <>
      <HeroSection minHeight="xl" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Login-aware greeting */}
            {user ? (
              <p className="text-[var(--color-gold-400)] font-medium text-lg">
                Welcome back, {userName}
              </p>
            ) : (
              <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-gold)]/80 uppercase">
                Denver&apos;s Creative Heart
              </p>
            )}

            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-gold)] leading-[var(--line-height-tight)]">
              The Denver Songwriters Collective
            </h1>

            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-warm-white)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              A warm, open, community-driven space where strangers become friends,
              friends become collaborators, and collaborators become genuine fans of one another.
            </p>

            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              We believe that music does more than entertain — it builds relationships and creates real belonging.
              Denver&apos;s creative energy is alive, growing, and filled with songwriters looking not just for a stage,
              but for connection, encouragement, and a sense of shared purpose.
            </p>

            {/* Login-aware CTAs */}
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              {user ? (
                <>
                  <Button asChild variant="primary" size="lg">
                    <Link href="/dashboard">Go to Dashboard</Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/events">Explore Events</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/open-mics">Find Open Mics</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="primary" size="lg">
                    <Link href="/events">Explore Events & Get Involved</Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/performers">Meet the Artists</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/open-mics">Find Open Mics</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-16 space-y-20">
          {/* Open Mic Directory */}
          <section>
            <div className="mb-8 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-2">
                  Open Mic Directory
                </h2>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                  Explore Denver’s full open mic scene. Find weekly events, discover hidden gems, claim performance slots, and help keep the community-maintained directory accurate and up to date.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/open-mics">View All Open Mics</Link>
              </Button>
            </div>
          </section>

          {/* Featured Events */}
          <section>
            <div className="mb-8 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-2">
                  Featured Events
                </h2>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                  Don&apos;t miss these curated showcases and special nights.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/events">View all events</Link>
              </Button>
            </div>
            {hasFeaturedEvents ? (
              <EventGrid events={featuredEvents} />
            ) : (
              <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                No featured events at this time.
              </p>
            )}
          </section>

          {/* Spotlight Performers */}
          <section>
            <div className="mb-8 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-2">
                  Spotlight Performers
                </h2>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                  Featured artists from the Denver songwriting community.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/performers">View all performers</Link>
              </Button>
            </div>
            {hasFeaturedPerformers ? (
              <PerformerGrid performers={featuredPerformers} />
            ) : (
              <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                No spotlight performers at this time.
              </p>
            )}
          </section>

          {/* Featured Studios */}
          <section>
            <div className="mb-8 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-2">
                  Featured Studios
                </h2>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                  Top-rated partner studios for your recording sessions.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/studios">View all studios</Link>
              </Button>
            </div>
            {hasFeaturedStudios ? (
              <StudioGrid studios={featuredStudios} />
            ) : (
              <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                No featured studios at this time.
              </p>
            )}
          </section>

          {/* Upcoming Events */}
          <section>
            <div className="mb-8 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-2">
                  Upcoming Events
                </h2>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                  All upcoming showcases, open mics, and special nights.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/events">View all events</Link>
              </Button>
            </div>
            {hasUpcomingEvents ? (
              <EventGrid events={upcomingEvents} />
            ) : (
              <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)]">
                No upcoming events scheduled. Check back soon.
              </p>
            )}
          </section>
        </div>
      </PageContainer>
    </>
  );
}
