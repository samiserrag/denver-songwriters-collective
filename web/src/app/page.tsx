import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HeroSection, PageContainer } from "@/components/layout";
import { EventGrid } from "@/components/events";
import { MemberCard } from "@/components/members/MemberCard";
import { OpenMicGrid, type SpotlightOpenMic } from "@/components/open-mics";
import { Button } from "@/components/ui";
import { LazyIframe, CLSLogger } from "@/components/home";
import { NewsletterSection } from "@/components/navigation/NewsletterSection";
import type { Database } from "@/lib/supabase/database.types";
import type { Event, Member, MemberRole } from "@/types";

export const dynamic = "force-dynamic";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];
type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

function mapDBEventToEvent(dbEvent: DBEvent & { rsvp_count?: number }): Event {
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
    rsvp_count: dbEvent.rsvp_count ?? 0,
    is_dsc_event: dbEvent.is_dsc_event,
    imageUrl: dbEvent.cover_image_url ?? undefined,
  };
}

function mapDBProfileToMember(profile: DBProfile): Member {
  return {
    id: profile.id,
    name: profile.full_name ?? "Anonymous Member",
    role: (profile.role as MemberRole) ?? "fan",
    bio: profile.bio ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    isSpotlight: profile.is_featured ?? false,
    genres: profile.genres ?? undefined,
    instruments: profile.instruments ?? undefined,
    specialties: profile.specialties ?? undefined,
    availableForHire: profile.available_for_hire ?? undefined,
    interestedInCowriting: profile.interested_in_cowriting ?? undefined,
    openToCollabs: profile.open_to_collabs ?? undefined,
  };
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  const userName = user?.email ?? null;

  const [upcomingEventsRes, featuredMembersRes, spotlightOpenMicsRes, latestBlogRes, highlightsRes] = await Promise.all([
    // Single events query - upcoming DSC events (published only)
    supabase
      .from("events")
      .select("*")
      .eq("is_dsc_event", true)
      .eq("is_published", true)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6),
    // Featured members of any role - only spotlighted members
    supabase
      .from("profiles")
      .select("*")
      .eq("is_featured", true)
      .order("featured_rank", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(8),
    // Spotlight Open Mics - featured open mics from the directory
    supabase
      .from("events")
      .select(`
        id,
        slug,
        title,
        description,
        day_of_week,
        start_time,
        signup_time,
        venue_name,
        is_featured,
        venues(name, city)
      `)
      .eq("event_type", "open_mic")
      .eq("status", "active")
      .eq("is_featured", true)
      .order("featured_rank", { ascending: true })
      .order("day_of_week", { ascending: true })
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
      .eq("is_approved", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Monthly highlights for the homepage
    supabase
      .from("monthly_highlights")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", new Date().toISOString().split("T")[0])
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split("T")[0]}`)
      .order("display_order", { ascending: true })
      .limit(4),
  ]);

  // Fetch RSVP counts for DSC events
  const eventsData = upcomingEventsRes.data ?? [];
  const upcomingEvents: Event[] = await Promise.all(
    eventsData.map(async (dbEvent) => {
      let rsvpCount = 0;
      if (dbEvent.is_dsc_event) {
        const { count } = await supabase
          .from("event_rsvps")
          .select("*", { count: "exact", head: true })
          .eq("event_id", dbEvent.id)
          .eq("status", "confirmed");
        rsvpCount = count || 0;
      }
      return mapDBEventToEvent({ ...dbEvent, rsvp_count: rsvpCount });
    })
  );
  const featuredMembers: Member[] = (featuredMembersRes.data ?? []).map(mapDBProfileToMember);

  // Map spotlight open mics
  const spotlightOpenMics: SpotlightOpenMic[] = (spotlightOpenMicsRes.data ?? []).map((om: any) => ({
    id: om.id,
    slug: om.slug,
    title: om.title,
    description: om.description,
    day_of_week: om.day_of_week,
    start_time: om.start_time,
    signup_time: om.signup_time,
    venue_name: om.venues?.name ?? om.venue_name,
    venue_city: om.venues?.city,
    is_featured: om.is_featured,
  }));

  const latestBlog = latestBlogRes.data;
  const latestBlogAuthor = latestBlog?.author
    ? Array.isArray(latestBlog.author)
      ? latestBlog.author[0]
      : latestBlog.author
    : null;

  // Monthly highlights
  interface Highlight {
    id: string;
    title: string;
    description: string | null;
    highlight_type: string;
    image_url: string | null;
    link_url: string | null;
    link_text: string | null;
  }
  const highlights: Highlight[] = highlightsRes.data ?? [];

  const hasUpcomingEvents = upcomingEvents.length > 0;
  const hasFeaturedMembers = featuredMembers.length > 0;
  const hasSpotlightOpenMics = spotlightOpenMics.length > 0;
  const hasLatestBlog = !!latestBlog;
  const hasHighlights = highlights.length > 0;

  return (
    <>
      <CLSLogger />
      <HeroSection minHeight="lg" showVignette={false} showBottomFade={false} backgroundImage="/images/hero.jpg">
        <div />
      </HeroSection>

      {/* What We Offer Each Other Section */}
      <section className="py-16 px-6 bg-[var(--color-bg-secondary)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-center text-[var(--color-text-primary)] mb-4">
            What We Offer Each Other
          </h2>
          <p className="text-[var(--color-text-secondary)] text-center mb-12 max-w-2xl mx-auto">
            Built by songwriters, for songwriters. This is our shared space to
            connect, collaborate, and lift each other up.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "🎤",
                title: "Stages to Share",
                desc: "Community-maintained open mic listings. Know a spot? Help keep the list updated.",
                href: "/open-mics",
                accent: "from-amber-500/10 to-transparent"
              },
              {
                icon: "🤝",
                title: "Real Connections",
                desc: "Meet fellow songwriters, find collaborators, and build lasting friendships.",
                href: "/members",
                accent: "from-sky-500/10 to-transparent"
              },
              {
                icon: "📖",
                title: "Stories & Wisdom",
                desc: "Share your journey, learn from others, and grow together.",
                href: "/blog",
                accent: "from-violet-500/10 to-transparent"
              },
              {
                icon: "🎧",
                title: "Local Resources",
                desc: "Studios, gear, and services recommended by your fellow musicians.",
                href: "/studios",
                accent: "from-rose-500/10 to-transparent"
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={`p-6 bg-gradient-to-br ${item.accent} card-base border border-[var(--color-border-default)] rounded-xl hover:border-[var(--color-border-accent)]/50 transition-all group card-hover`}
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--color-text-accent)] transition-colors">
                  {item.title}
                </h3>
                <p className="text-[var(--color-text-secondary)] text-sm">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Monthly Highlights */}
      {hasHighlights && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-2">
                This Month&apos;s Highlights
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Featured news and announcements from the community.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className="p-6 card-base border border-[var(--color-border-accent)]/20 rounded-xl hover:border-[var(--color-border-accent)]/50 transition-all"
                >
                  {highlight.image_url && (
                    <div className="relative h-40 mb-4 rounded-lg overflow-hidden">
                      <Image
                        src={highlight.image_url}
                        alt={highlight.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] mb-3 inline-block">
                    {highlight.highlight_type === "event" && "Featured Event"}
                    {highlight.highlight_type === "performer" && "Featured Songwriter"}
                    {highlight.highlight_type === "venue" && "Featured Venue"}
                    {highlight.highlight_type === "custom" && "Announcement"}
                  </span>
                  <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                    {highlight.title}
                  </h3>
                  {highlight.description && (
                    <p className="text-[var(--color-text-secondary)] text-sm mb-4 line-clamp-3">
                      {highlight.description}
                    </p>
                  )}
                  {highlight.link_url && (
                    <Link
                      href={highlight.link_url}
                      className="inline-flex items-center gap-2 text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors text-sm font-medium"
                    >
                      {highlight.link_text || "Learn More"}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Community Happenings - DSC events */}
      {hasUpcomingEvents && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-2">
                  Community Happenings
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Song circles, workshops, and gatherings hosted by DSC members.
                </p>
              </div>
              <Link
                href="/events"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                View all
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <EventGrid events={upcomingEvents} compact />
          </div>
        </section>
      )}

      {/* Featured Playlists */}
      <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 text-center">
            <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-2">
              Featured Playlists
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Music from the Denver songwriting community.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spotify Playlist - Lazy loaded to prevent LCP blocking */}
            <LazyIframe
              src="https://open.spotify.com/embed/playlist/6LohBdSSOxypGZeI4hIGqK?utm_source=generator"
              title="Denver Songwriters Collective Spotify Playlist - Community music from local songwriters"
              height="352px"
              className="rounded-xl overflow-hidden"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
            {/* YouTube Playlist - Lazy loaded to prevent LCP blocking */}
            <LazyIframe
              src="https://www.youtube.com/embed/videoseries?si=JA6QrSYIVBwpfOi1&list=PL0HB-8-Ot_s5KVdniord-fsKK3rPz3O7e"
              title="Denver Songwriters Collective YouTube Playlist - Live performances and music videos"
              height="352px"
              className="rounded-xl overflow-hidden"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* Featured Members - Single unified section for all spotlighted members */}
      {hasFeaturedMembers && (
        <section className="py-10 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-2">
                  Featured Members
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Spotlighted songwriters, hosts, and studios from our community.
                </p>
              </div>
              <Link
                href="/members"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                View all
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredMembers.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Open Mics */}
      {hasSpotlightOpenMics && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-2">
                  Featured Open Mics
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Popular stages around Denver for songwriters to share their music.
                </p>
              </div>
              <Link
                href="/open-mics"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                View all
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <OpenMicGrid openMics={spotlightOpenMics} />
          </div>
        </section>
      )}

      {/* Latest from the Blog */}
      {hasLatestBlog && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-baseline justify-between gap-4 mb-6">
              <div>
                <h2 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-2">
                  Latest from the Blog
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Tips, stories, and insights from the Denver songwriting community. <Link href="/dashboard/blog" className="text-[var(--color-text-accent)] hover:underline">Share your own story!</Link>
                </p>
              </div>
              <Link
                href="/blog"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                View all posts
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Blog Card + Share Your Story CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Latest Blog Post */}
              <Link
                href={`/blog/${latestBlog.slug}`}
                className="block group"
              >
              <article className="h-full overflow-hidden card-spotlight hover:-translate-y-1">
                {/* Image Section - aspect-[4/3] */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {latestBlog.cover_image_url ? (
                    <Image
                      src={latestBlog.cover_image_url}
                      alt={latestBlog.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-[var(--color-bg-tertiary)] flex items-center justify-center">
                      <svg className="w-16 h-16 text-[var(--color-text-accent)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                </div>

                {/* Content Section */}
                <div className="p-5 space-y-3">
                  {latestBlog.tags && latestBlog.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {latestBlog.tags.slice(0, 2).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors">
                    {latestBlog.title}
                  </h3>
                  {latestBlog.excerpt && (
                    <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] line-clamp-2">
                      {latestBlog.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    {latestBlogAuthor?.avatar_url ? (
                      <Image
                        src={latestBlogAuthor.avatar_url}
                        alt={latestBlogAuthor.full_name ?? "Author"}
                        width={24}
                        height={24}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                        <span className="text-[var(--color-text-accent)] text-xs">
                          {latestBlogAuthor?.full_name?.[0] ?? "?"}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {latestBlogAuthor?.full_name ?? "Anonymous"}
                    </p>
                  </div>
                </div>
              </article>
            </Link>

              {/* Share Your Story CTA Card */}
              <Link
                href="/dashboard/blog"
                className="block group"
              >
                <article className="h-full overflow-hidden card-spotlight hover:-translate-y-1 flex flex-col">
                  {/* Icon Section - same aspect ratio as blog image */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-[var(--color-bg-tertiary)] flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto text-[var(--color-text-accent)]/70 group-hover:text-[var(--color-text-accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    {/* Gradient overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </div>

                  {/* Content Section */}
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-center">
                    <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors">
                      Share Your Story
                    </h3>
                    <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] line-clamp-2">
                      Got advice, insights, or a journey to share? Add your voice to the community.
                    </p>
                    <span className="inline-flex items-center gap-1 text-[var(--color-text-accent)] text-sm font-medium">
                      Write a post
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </article>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Newsletter Signup */}
      <NewsletterSection />
    </>
  );
}
