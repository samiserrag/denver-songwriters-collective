import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";

const partnershipOpportunities = [
  {
    title: "Host an Event",
    description: "Host an open mic, showcase, or listening-room event at your venue.",
  },
  {
    title: "Recording Specials",
    description: "Offer recording or mixing specials for DSC artists and community members.",
  },
  {
    title: "Feature Performers",
    description: "Feature performers at your venue's weekly or monthly events.",
  },
  {
    title: "Collaborate on Content",
    description: "Collaborate on livestreams, podcasts, interviews, or behind-the-scenes sessions.",
  },
  {
    title: "Provide Space",
    description: "Provide space for song clubs, meetups, or co-writing gatherings.",
  },
  {
    title: "Community Programs",
    description: "Partner on community fundraisers or nonprofit songwriting programs.",
  },
];

const partnerTypes = [
  "Venues & Bars",
  "Recording Studios",
  "Breweries & Coffee Shops",
  "Rehearsal Spaces",
  "Nonprofits & Education Programs",
  "Photographers & Videographers",
  "Audio Engineers",
  "Community Centers",
  "Cultural Organizations",
  "Festivals & Events",
];

export default function PartnersPage() {
  return (
    <>
      <HeroSection minHeight="lg" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-gold)]/80 uppercase">
              Grow Together
            </p>
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-gold)] leading-[var(--line-height-tight)]">
              Partner With The Denver Songwriters Collective
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-warm-white)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              DSC welcomes partnerships with venues, studios, nonprofits, education programs, rehearsal spaces, breweries, community centers, cultural organizations, and anyone who wants to help support the songwriter community.
            </p>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-16 space-y-16 max-w-4xl mx-auto">

          {/* Who We Partner With */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] text-center">
              Who We Partner With
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {partnerTypes.map((type) => (
                <span
                  key={type}
                  className="px-4 py-2 rounded-full border border-white/10 bg-[var(--color-indigo-950)] text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)]"
                >
                  {type}
                </span>
              ))}
            </div>
          </section>

          {/* Partnership Opportunities */}
          <section className="space-y-8">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] text-center">
              Partnership Opportunities
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {partnershipOpportunities.map((opportunity) => (
                <div
                  key={opportunity.title}
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-6 space-y-3"
                >
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-gold)]">
                    {opportunity.title}
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)] leading-relaxed">
                    {opportunity.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Benefits */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Why Partner With DSC?
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-gold)]">
                  For Venues
                </h3>
                <ul className="space-y-3 text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)]">
                  <li className="flex gap-3">
                    <span className="text-[var(--color-gold)]">•</span>
                    Access to a community of engaged, talented performers
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-gold)]">•</span>
                    Free promotion through our directory and events calendar
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-gold)]">•</span>
                    Support in organizing songwriter-focused events
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-gold)]">•</span>
                    Connection to a growing creative network
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-gold)]">
                  For Studios
                </h3>
                <ul className="space-y-3 text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)]">
                  <li className="flex gap-3">
                    <span className="text-[var(--color-gold)]">•</span>
                    Meet emerging artists looking for recording opportunities
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-gold)]">•</span>
                    Feature your studio in our partner directory
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-gold)]">•</span>
                    Host workshops, demo days, and educational sessions
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-gold)]">•</span>
                    Build lasting relationships with local songwriters
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Vision */}
          <section className="space-y-6">
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              Our partnerships will grow over time — with studios, venues, audio engineers, photographers, videographers, educators, nonprofits, festivals, rehearsal spaces, and cultural organizations. We want to celebrate and lift up the entire creative ecosystem of the Front Range.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              DSC is committed to building a network where everyone benefits: venues receive engaged performers, performers discover supportive rooms, studios meet new artists, communities experience more local music, and fans build real connections with the people behind the songs.
            </p>
          </section>

          {/* Call to Action */}
          <section className="rounded-3xl border border-[var(--color-gold)]/20 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-8 md:p-12 text-center space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Let&apos;s Build Something Together
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              If you are a venue or studio interested in becoming part of the DSC movement, we would love to connect. Together, we can build something meaningful for Colorado&apos;s creative community.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/submit-open-mic">Submit Your Venue</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/studios">View Partner Studios</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/about">Learn More About DSC</Link>
              </Button>
            </div>
          </section>

        </div>
      </PageContainer>
    </>
  );
}
