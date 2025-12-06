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
            <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-gold)]/80 uppercase">
              Grow Together
            </p>
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-gold)] leading-[var(--line-height-tight)]">
              Partner With The Denver Songwriters Collective
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-warm-white)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              We invite venues, promoters, booking coordinators, festivals, studios, and independent organizations to connect with us. Together, we can create more pathways for local musicians to shine.
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

          {/* Proven Track Record */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Proven Community Impact
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              Our community is full of diverse and genuine talent. Several of our performers have already been invited to play at external events, including the Denver Chalk Festival, where eight DSC artists performed on a major stage for crowds of thousands. We are excited to continue helping artists find opportunities like this, and we welcome partnerships that create more pathways for local musicians to shine.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              Our partnerships will grow over time with studios, venues, audio engineers, photographers, videographers, educators, nonprofits, festivals, rehearsal spaces, and cultural organizations. We want to celebrate and lift up the entire creative ecosystem of the Front Range.
            </p>
          </section>

          {/* Vision */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Our Vision for Partnership
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              DSC is committed to building a network where everyone benefits: venues receive engaged performers, performers discover supportive rooms, studios meet new artists, communities experience more local music, and fans build real connections with the people behind the songs.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              To make all of this possible, DSC relies on the dedication of volunteers, the generosity of our community, and the support of partners who believe in our mission. For many years, the collective has operated as a volunteer-powered labor of love, primarily supported by founder Sami Serrag and the dozens of community members who have contributed their time, equipment, skills, and enthusiasm.
            </p>
          </section>

          {/* Call to Action */}
          <section className="rounded-3xl border border-[var(--color-gold)]/20 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-8 md:p-12 text-center space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Let&apos;s Build Something Together
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              If you would like to host an event, collaborate on a showcase, support our livestream or web show production, help us find sponsors, provide space, offer resources, or become part of this creative movement in any way, we would love to speak with you.
            </p>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-gold)]/90 italic leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              Your partnership directly strengthens the songwriting culture of Denver and helps us continue building a community where musicians feel seen, supported, and inspired.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/submit-open-mic">Submit Your Venue</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/get-involved">Get Involved</Link>
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
