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

  const [featuredEventsRes, upcomingEventsRes, featuredPerformersRes, featuredStudiosRes, latestBlogRes] = await Promise.all([
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
    supabase
      .from("blog_posts")
      .select(`
        id,
        slug,
        title,
        excerpt,
        cover_image_url,
        published_at,
        tags,
        author:profiles!blog_posts_author_id_fkey(full_name, avatar_url)
      `)
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const featuredEvents: Event[] = (featuredEventsRes.data ?? []).map(mapDBEventToEvent);
  const upcomingEvents: Event[] = (upcomingEventsRes.data ?? []).map(mapDBEventToEvent);
  const featuredPerformers: Performer[] = (featuredPerformersRes.data ?? []).map(mapDBProfileToPerformer);
  const featuredStudios: Studio[] = (featuredStudiosRes.data ?? []).map(mapDBProfileToStudio);
  const latestBlog = latestBlogRes.data;
  const latestBlogAuthor = latestBlog?.author
    ? Array.isArray(latestBlog.author)
      ? latestBlog.author[0]
      : latestBlog.author
    : null;

  const hasFeaturedEvents = featuredEvents.length > 0;
  const hasUpcomingEvents = upcomingEvents.length > 0;
  const hasFeaturedPerformers = featuredPerformers.length > 0;
  const hasFeaturedStudios = featuredStudios.length > 0;
  const hasLatestBlog = !!latestBlog;

  return (
    <>
      <HeroSection minHeight="xl" showVignette showBottomFade>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} aria-hidden="true" />

        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Login-aware greeting */}
            {user ? (
              <p className="text-[var(--color-gold-400)] font-medium text-lg">
                Welcome back, {userName}
              </p>
            ) : (
              <p className="text-[var(--color-gold)]/80 uppercase tracking-[0.3em] text-sm mb-4 font-medium">
                Denver • Songwriters • Community
              </p>
            )}

            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[4rem] font-[var(--font-family-serif)] text-[var(--color-warm-white)] leading-[var(--line-height-tight)]">
              Find Your People.<br />
              <span className="text-[var(--color-gold)]">Find Your Stage.</span>
            </h1>

            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-warm-gray-light)] max-w-2xl mx-auto leading-[var(--line-height-relaxed)]">
              Denver&apos;s home for songwriters. Discover open mics, showcases,
              song circles, and connect with your creative community.
            </p>

            {/* Login-aware CTAs */}
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 pt-4">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
                  >
                    Go to Dashboard
                  </Link>
                  <Link
                    href="/open-mics"
                    className="px-8 py-4 border-2 border-white/30 hover:border-white text-[var(--color-warm-white)] font-semibold rounded-lg transition-all hover:bg-white/5"
                  >
                    Find Open Mics
                  </Link>
                  <Link
                    href="/events"
                    className="px-8 py-4 border-2 border-teal-500/50 hover:border-teal-400 text-teal-400 font-semibold rounded-lg transition-all hover:bg-teal-500/10"
                  >
                    Browse Events
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/open-mics"
                    className="px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
                  >
                    Find Open Mics
                  </Link>
                  <Link
                    href="/events"
                    className="px-8 py-4 border-2 border-white/30 hover:border-white text-[var(--color-warm-white)] font-semibold rounded-lg transition-all hover:bg-white/5"
                  >
                    Browse Events
                  </Link>
                  <Link
                    href="/performers"
                    className="px-8 py-4 border-2 border-teal-500/50 hover:border-teal-400 text-teal-400 font-semibold rounded-lg transition-all hover:bg-teal-500/10"
                  >
                    Meet Artists
                  </Link>
                </>
              )}
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      {/* What We Offer Section */}
      <section className="py-20 px-6 bg-[var(--color-background-dark)]/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-center text-[var(--color-warm-white)] mb-4">
            Everything Songwriters Need
          </h2>
          <p className="text-[var(--color-warm-gray)] text-center mb-12 max-w-2xl mx-auto">
            Whether you&apos;re looking for your first open mic or your hundredth,
            we&apos;ve got you covered.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "🎤",
                title: "Open Mics",
                desc: "Find weekly open mics across Denver, sorted by day and venue.",
                href: "/open-mics"
              },
              {
                icon: "🎵",
                title: "Showcases",
                desc: "Discover songwriter showcases and listening room events.",
                href: "/events"
              },
              {
                icon: "🎸",
                title: "Artists",
                desc: "Connect with Denver's talented songwriter community.",
                href: "/performers"
              },
              {
                icon: "🎧",
                title: "Studios",
                desc: "Book recording time at local studios and creative spaces.",
                href: "/studios"
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="p-6 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-xl hover:border-[var(--color-gold)]/50 transition-all group card-hover"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold text-[var(--color-warm-white)] mb-2 group-hover:text-[var(--color-gold)] transition-colors">
                  {item.title}
                </h3>
                <p className="text-[var(--color-warm-gray)] text-sm">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest from the Blog */}
      {hasLatestBlog && (
        <section className="py-16 px-6 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-baseline justify-between gap-4 mb-8">
              <div>
                <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-warm-white)] mb-2">
                  Latest from the Blog
                </h2>
                <p className="text-[var(--color-warm-gray)]">
                  Tips, stories, and insights from the Denver songwriting community.
                </p>
              </div>
              <Link
                href="/blog"
                className="text-[var(--color-gold)] hover:text-[var(--color-gold-400)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                View all posts
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <Link
              href={`/blog/${latestBlog.slug}`}
              className="block group"
            >
              <div className="grid md:grid-cols-2 gap-8 items-center bg-[var(--color-indigo-950)]/30 border border-white/10 rounded-2xl overflow-hidden hover:border-[var(--color-gold)]/30 transition-all">
                {latestBlog.cover_image_url ? (
                  <div className="relative h-64 md:h-80 overflow-hidden">
                    <img
                      src={latestBlog.cover_image_url}
                      alt={latestBlog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--color-background)]/50 md:hidden" />
                  </div>
                ) : (
                  <div className="h-64 md:h-80 bg-gradient-to-br from-[var(--color-gold)]/20 to-[var(--color-teal)]/20 flex items-center justify-center">
                    <svg className="w-16 h-16 text-[var(--color-gold)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </div>
                )}
                <div className="p-6 md:p-8">
                  {latestBlog.tags && latestBlog.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {latestBlog.tags.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] border border-[var(--color-gold)]/20"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <h3 className="text-2xl md:text-3xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-3 group-hover:text-[var(--color-gold)] transition-colors">
                    {latestBlog.title}
                  </h3>
                  {latestBlog.excerpt && (
                    <p className="text-[var(--color-warm-gray)] mb-4 line-clamp-3">
                      {latestBlog.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    {latestBlogAuthor?.avatar_url ? (
                      <img
                        src={latestBlogAuthor.avatar_url}
                        alt={latestBlogAuthor.full_name ?? "Author"}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
                        <span className="text-[var(--color-gold)]">
                          {latestBlogAuthor?.full_name?.[0] ?? "?"}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-[var(--color-warm-white)] text-sm font-medium">
                        {latestBlogAuthor?.full_name ?? "Anonymous"}
                      </p>
                      {latestBlog.published_at && (
                        <p className="text-neutral-500 text-xs">
                          {new Date(latestBlog.published_at).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

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
