import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";

const partnershipOpportunities = [
  {
    title: "Host Open Mics",
    description: "We are actively seeking a new home for our open mics, ideally on Friday nights, Saturday nights, or weekend afternoons.",
  },
  {
    title: "Showcase Events",
    description: "Host showcases, listening-room events, and curated performances featuring DSC artists.",
  },
  {
    title: "Live Production",
    description: "Partner on livestreamed or recorded events. We are developing a new web show filmed in front of a live audience.",
  },
  {
    title: "Recording Specials",
    description: "Offer recording or mixing specials for DSC artists and community members.",
  },
  {
    title: "Feature Performers",
    description: "Book DSC artists for your venue's events. Our community includes excellent talent ready for the stage.",
  },
  {
    title: "Provide Space",
    description: "Provide space for song clubs, meetups, co-writing gatherings, or community workshops.",
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
  "Promoters & Booking Managers",
  "Livestream & Video Production",
];

export default function PartnersPage() {
  return (
    <>
      <HeroSection minHeight="lg" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-text-accent)] leading-[var(--line-height-tight)]">
              Partner with the Denver songwriting community
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-text-primary)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              Venues, hosts, promoters, studios, and songwriting groups are welcome.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/submit-open-mic">Submit your venue</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/get-involved">Get involved</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-10 space-y-10 max-w-4xl mx-auto">

          {/* Who We Partner With */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] text-center">
              Who We Partner With
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {partnerTypes.map((type) => (
                <span
                  key={type}
                  className="px-4 py-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]"
                >
                  {type}
                </span>
              ))}
            </div>
          </section>

          {/* Partnership Opportunities */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] text-center">
              Partnership Opportunities
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {partnershipOpportunities.map((opportunity) => (
                <div
                  key={opportunity.title}
                  className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3"
                >
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                    {opportunity.title}
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                    {opportunity.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Benefits */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Why Partner With DSC?
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                  For Venues
                </h3>
                <ul className="space-y-3 text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)]">
                  <li className="flex gap-3">
                    <span className="text-[var(--color-text-accent)]">•</span>
                    Access to a community of engaged, talented performers
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-text-accent)]">•</span>
                    Free promotion through our directory and events calendar
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-text-accent)]">•</span>
                    Support in organizing songwriter-focused events
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-text-accent)]">•</span>
                    Connection to a growing creative network
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                  For Studios
                </h3>
                <ul className="space-y-3 text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)]">
                  <li className="flex gap-3">
                    <span className="text-[var(--color-text-accent)]">•</span>
                    Meet emerging artists looking for recording opportunities
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-text-accent)]">•</span>
                    Feature your studio in our partner directory
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-text-accent)]">•</span>
                    Host workshops, demo days, and educational sessions
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-text-accent)]">•</span>
                    Build lasting relationships with local songwriters
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Proven Track Record */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Proven Community Impact
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Our community is full of diverse and genuine talent. Several of our performers have already been invited to play at external events, including the Denver Chalk Festival, where eight DSC artists performed on a major stage for crowds of thousands. We are excited to continue helping artists find opportunities like this, and we welcome partnerships that create more pathways for local musicians to shine.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Our partnerships will grow over time with studios, venues, audio engineers, photographers, videographers, educators, nonprofits, festivals, rehearsal spaces, and cultural organizations. We want to celebrate and lift up the entire creative ecosystem of the Front Range.
            </p>
          </section>

          {/* Vision */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Our Vision for Partnership
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              DSC is committed to building a network where everyone benefits: venues receive engaged performers, performers discover supportive rooms, studios meet new artists, communities experience more local music, and fans build real connections with the people behind the songs.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              To make all of this possible, DSC relies on the dedication of volunteers, the generosity of our community, and the support of partners who believe in our mission. For many years, the collective has operated as a volunteer-powered labor of love, primarily supported by founder Sami Serrag and the dozens of community members who have contributed their time, equipment, skills, and enthusiasm.
            </p>
          </section>

          {/* Call to Action */}
          <section className="rounded-3xl border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)] p-6 md:p-8 text-center space-y-4">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Let&apos;s Build Something Together
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              If you would like to host an event, collaborate on a showcase, support livestream or web show production, help find sponsors, provide space, offer resources, or become part of this creative movement in any way, the community would love to connect.
            </p>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-accent)]/90 italic leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              Your partnership directly strengthens the songwriting culture of Denver and helps build a community where musicians feel seen, supported, and inspired.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/submit-open-mic">Submit your venue</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/get-involved">Get involved</Link>
              </Button>
            </div>
          </section>

        </div>
      </PageContainer>
    </>
  );
}
