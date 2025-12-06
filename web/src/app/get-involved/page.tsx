import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import { VolunteerSignupForm } from "@/components/forms";

const waysToHelp = [
  {
    title: "Submit or Update Directory Entries",
    description: "Help us build the most accurate open mic directory in Denver by submitting new venues or updating existing listings.",
    cta: { text: "Submit an Open Mic", href: "/submit-open-mic" },
  },
  {
    title: "Suggest New Venues",
    description: "Know a bar, brewery, coffee shop, or art space that would welcome songwriter events? Let us know!",
    cta: { text: "Suggest a Venue", href: "/submit-open-mic" },
  },
  {
    title: "Volunteer at Events",
    description: "Help run showcases, meetups, or livestream nights. No experience needed, just enthusiasm and a willingness to show up.",
    cta: null,
  },
  {
    title: "Test Website Features",
    description: "Help us improve by testing new features and offering usability feedback. Your input shapes the platform.",
    cta: null,
  },
  {
    title: "Connect Partners",
    description: "Know studios, engineers, photographers, or videographers who want to collaborate with the community? Introduce us!",
    cta: { text: "Partner With Us", href: "/partners" },
  },
  {
    title: "Spread the Word",
    description: "Share DSC with friends, musicians, and supporters. The more people who know about us, the stronger we become.",
    cta: null,
  },
];

export default function GetInvolvedPage() {
  return (
    <>
      <HeroSection minHeight="lg" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-gold)]/80 uppercase">
              Be Part of the Movement
            </p>
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-gold)] leading-[var(--line-height-tight)]">
              Help Us Build This Community
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-warm-white)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              DSC is powered by the people who show up — and we&apos;d love your help growing the platform, improving the directory, expanding our events, and finding the next great Denver venues and studios to partner with.
            </p>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] max-w-2xl mx-auto leading-[var(--line-height-relaxed)]">
              You don&apos;t need experience. You just need enthusiasm and a willingness to be part of something meaningful.
            </p>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-16 space-y-16 max-w-4xl mx-auto">

          {/* Ways to Help */}
          <section>
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-8 text-center">
              Ways You Can Help
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {waysToHelp.map((way) => (
                <div
                  key={way.title}
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-6 space-y-4"
                >
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-gold)]">
                    {way.title}
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)] leading-relaxed">
                    {way.description}
                  </p>
                  {way.cta && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={way.cta.href}>{way.cta.text}</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Why It Matters */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Why Your Contribution Matters
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              The more participation we receive, the stronger and more accurate the directory becomes and the more meaningful all of our gatherings will be. This project only succeeds because people care enough to be part of it.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              Every submission, every suggestion, every share helps build something real for Denver&apos;s creative community. Your contribution will have a lasting impact on songwriters across the Front Range.
            </p>
          </section>

          {/* Volunteer Sign-Up */}
          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-4">
                Volunteer Sign-Up
              </h2>
              <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] max-w-2xl mx-auto leading-[var(--line-height-relaxed)]">
                Interested in helping out at events, running open mics, or supporting DSC in other ways? Fill out the form below and we will be in touch.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-6 md:p-8">
              <VolunteerSignupForm />
            </div>
          </section>

          {/* Donation & Sponsorship */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Support DSC Financially
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              The Denver Songwriters Collective has operated for years as a volunteer-powered labor of love, primarily supported by founder Sami Serrag and the dozens of community members who have contributed their time, equipment, skills, and enthusiasm. We are deeply grateful for everyone who has helped us get this far.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)]">
              Financial contributions or sponsorships would make a meaningful difference in our ability to grow, host more events, and serve more musicians across Denver.
            </p>
            <div className="rounded-2xl border border-[var(--color-gold)]/30 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-6 md:p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-gold)]">
                    Individual Donations
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)] leading-relaxed">
                    Every donation, no matter the size, helps us continue hosting events, maintaining the directory, and building community resources.
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-gold)]">
                    Corporate Sponsorships
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)] leading-relaxed">
                    Partner with DSC as a sponsor and support Denver&apos;s songwriting community while gaining visibility among a creative, engaged audience.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] mb-4">
                  We are currently setting up our donation system. In the meantime, if you would like to contribute or discuss sponsorship opportunities, please reach out to us directly.
                </p>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-gold)]/80 italic">
                  Online donations coming soon.
                </p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="rounded-3xl border border-[var(--color-gold)]/20 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-8 md:p-12 text-center space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-warm-white)]">
              Ready to Get Started?
            </h2>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              The easiest way to help right now is to submit or update an open mic listing. It only takes a few minutes and makes a real difference.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/submit-open-mic">Submit an Open Mic</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/open-mics">Browse the Directory</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/partners">Partner With Us</Link>
              </Button>
            </div>
          </section>

        </div>
      </PageContainer>
    </>
  );
}
