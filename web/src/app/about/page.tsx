import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import { NewsletterSection } from "@/components/navigation/NewsletterSection";

export const metadata: Metadata = {
  title: "About | Denver Songwriters Collective",
  description: "The Denver Songwriters Collective is your home for finding stages, connecting with artists, and growing as a songwriter in Denver.",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection minHeight="lg" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-text-accent)] leading-[var(--line-height-tight)]">
              About The Denver Songwriters Collective
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-text-primary)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              A grassroots community built around a simple idea: when people share their music, they share themselves — and something powerful happens.
            </p>
          </div>
        </PageContainer>
      </HeroSection>

      {/* Main Content */}
      <PageContainer>
        <div className="py-16 space-y-16 max-w-4xl mx-auto">

          {/* Our Story */}
          <section className="space-y-6">
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              In an era where everyone feels spread thin and disconnected, the act of gathering in a creative space helps restore meaning, friendship, and belonging. DSC is not an industry platform. It is a people platform. It is a space where neighbors, co-workers, strangers, out-of-towners, hobbyists, professionals, students, parents, and long-time musicians can all come together, get to know each other, and build genuine relationships through the art of original songwriting.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Many communities focus on perfect performances or competition. DSC focuses on connection. At our gatherings, you&apos;ll meet people who root for you even if they just met you five minutes ago. You&apos;ll hear songs that surprise you, encourage you, make you laugh, or make you feel less alone. You&apos;ll see performers cheer for each other, swap ideas, collaborate, lend gear, share writing prompts, trade tips, and form friendships that carry far beyond a single event.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-accent)]/90 italic leading-[var(--line-height-relaxed)]">
              The music is important — but the people are everything.
            </p>
          </section>

          {/* Our History */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Our History
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              The Denver Songwriters Collective began its journey as the Denver Songwriters and Lyricists Meetup Group, a grassroots gathering for musicians who wanted a welcoming place to share original songs, receive feedback, and build friendships through creativity. Over the years, the group hosted well-attended open mics at several beloved local venues, including Banded Oak Brewery and FlyteCo Brewing Tennyson, both of which became cherished homes for our community for a time. These events helped shape the friendly, supportive culture that defines the collective today.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              From the start, DSC has embraced the broader Denver music scene rather than trying to exist apart from it. Many long-time members are regulars at other open mics across the city, and the group has always encouraged cross-pollination between communities. We believe that the rising tide lifts everyone: more songs, more venues, more collaboration, more art, and more people discovering each other in a creative city that&apos;s full of talent. Our members actively support other songwriting groups, new open mic nights, and the many established events that have inspired us along the way.
            </p>
          </section>

          {/* The People Behind DSC */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              The People Behind DSC
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              The collective has been shaped by the people who stepped forward to host, volunteer, and nurture the community. Sami Serrag, the group&apos;s founder, has organized and facilitated the majority of our songwriting critique circles and community-building gatherings. Robert Fulton Jr. has played a key role in leading many of our open mic events, helping new performers feel confident on stage and keeping the energy warm and welcoming. Countless other volunteers from within the group have contributed over the years, offering time, ideas, equipment, encouragement, and heartfelt presence.
            </p>
          </section>

          {/* Inclusion Statement */}
          <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-8 space-y-4">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Everyone Is Welcome Here
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              The Denver Songwriters Collective is and always has been a place where all people are welcomed and supported. We celebrate people of every gender identity, orientation, background, and experience level. We are proudly LGBTQ-friendly, inclusive, and committed to fostering an uplifting environment where everyone can create without fear, collaborate freely, and build lasting friendships.
            </p>
          </section>

          {/* What We Offer */}
          <section className="space-y-8">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              What We Offer
            </h2>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              DSC offers multiple kinds of happenings to meet the needs of every songwriter and supporter:
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">Open Mics</h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  For sharing songs and meeting fellow artists in a supportive environment.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">Curated Showcases</h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  Highlighting a small group of performers in longer sets for deeper artistic expression.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">Song Clubs</h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  Where participants share works-in-progress and exchange encouraging feedback.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">Meetups & Socials</h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  For casual socializing, collaboration, and community building.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">Co-Writing Sessions</h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  Connecting writers who want to create something new as a team.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">Studio Partnerships</h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  Recording opportunities, discounted sessions, workshops, and demo-creation days.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">Open Mic Directory</h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  Helping everyone in Denver find places to play, discover new spaces, and support local venues.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">Special Events</h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                  Collaborative events with breweries, nonprofits, listening rooms, galleries, and neighborhood festivals.
                </p>
              </div>
            </div>
          </section>

          {/* Our Vision */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Our Vision
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Our dream is to build not only a community, but a fully interconnected creative network that supports Denver songwriters at every stage of their journey. We aim to help venues host songwriter nights, help studios connect with emerging talent, help performers find places to play, help audiences discover local music, and help people feel at home in the creative world around them.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              As Denver continues to grow as one of the most creative cities in the country, DSC hopes to become the heart of its songwriter community. We are actively shaping a network where events flourish, partnerships thrive, and performers lift each other up.
            </p>
          </section>

          {/* Get Involved */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Help Us Build Something Meaningful
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Our website and platform are being built with the community&apos;s input. We welcome help from anyone who wants to support: testing features, submitting event listings, suggesting venues, reporting updates to the open mic directory, offering feedback on design and usability, contributing information, volunteering at events, or simply spreading the word.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              The more participation we receive, the stronger and more accurate the directory becomes — and the more meaningful all of our gatherings will be. This project only succeeds because people care enough to be part of it.
            </p>
          </section>

          {/* Partnerships */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Growing Together
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Our partnerships will grow over time — with studios, venues, audio engineers, photographers, videographers, educators, nonprofits, festivals, rehearsal spaces, and cultural organizations. We want to celebrate and lift up the entire creative ecosystem of the Front Range.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              DSC is committed to building a network where everyone benefits: venues receive engaged performers, performers discover supportive rooms, studios meet new artists, communities experience more local music, and fans build real connections with the people behind the songs.
            </p>
          </section>

          {/* Expansion */}
          <section className="space-y-6">
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              All of this grows from one simple truth: people make music, but music makes community. As DSC expands into surrounding areas — Boulder, Golden, Lakewood, Aurora, Fort Collins, Colorado Springs, and eventually chapters beyond Colorado — our purpose remains unchanged.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-accent)]/90 italic leading-[var(--line-height-relaxed)]">
              We exist to help people find each other.
            </p>
          </section>

          {/* Final Call to Action */}
          <section className="rounded-3xl border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)] p-8 md:p-12 text-center space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Join the Collective
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              If you love songwriting, love local music, love community, or simply want to support a creative movement that brings people together in meaningful ways, The Denver Songwriters Collective welcomes you.
            </p>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              Come help us shape the story, one song, one friendship, and one happening at a time.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/events">Explore Happenings</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/open-mics">Find Open Mics</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/tip-jar">Support Us</Link>
              </Button>
            </div>
          </section>

        </div>
      </PageContainer>

      {/* Newsletter Signup */}
      <NewsletterSection source="about" />
    </>
  );
}
