import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import { VolunteerSignupForm } from "@/components/forms";

const waysToHelp = [
  {
    title: "Help Host Events",
    description: "Want to run an open mic, showcase, or songwriter meetup? We'll help you get started with venues, promotion, and logistics.",
    cta: { text: "Learn About Hosting", href: "/host" },
  },
  {
    title: "Find & Suggest Venues",
    description: "Know a bar, brewery, coffee shop, or art space that would welcome live music? Help us connect with new venues across Denver.",
    cta: { text: "Suggest a Venue", href: "/submit-open-mic" },
  },
  {
    title: "Update Open Mic Info",
    description: "Help keep our directory accurate! If you notice outdated times, venues that closed, or new open mics we're missing, let us know.",
    cta: { text: "Submit an Update", href: "/submit-open-mic" },
  },
  {
    title: "Spread the Word",
    description: "Tell other musicians, songwriters, and music lovers about CSC. Share with your band, your open mic regulars, or anyone in the local music scene.",
    cta: null,
  },
  {
    title: "Connect Partners",
    description: "Know studios, engineers, photographers, or videographers who want to collaborate with the community? Introduce us!",
    cta: { text: "Partner With Us", href: "/partners" },
  },
  {
    title: "Test Website Features",
    description: "Help us improve by testing new features and reporting bugs. Found an issue or have an idea? Use our feedback form.",
    cta: { text: "Submit Feedback", href: "/feedback" },
  },
];

export default function GetInvolvedPage() {
  return (
    <>
      <HeroSection minHeight="xs" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-text-accent)] leading-[var(--line-height-tight)]">
              Get Involved
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-text-primary)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              Host events, find venues, spread the word, and help keep our open mic directory accurate.
            </p>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] italic max-w-2xl mx-auto">
              Many hands make lighter load-ins.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/submit-open-mic">Submit an open mic</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/partners">Partner with the community</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-10 space-y-10 max-w-4xl mx-auto">

          {/* Ways to Help */}
          <section>
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-6 text-center">
              Ways You Can Help
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {waysToHelp.map((way) => (
                <div
                  key={way.title}
                  className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4"
                >
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                    {way.title}
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
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
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Why Your Contribution Matters
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Denver&apos;s music scene thrives when people in the community help each other find places to play. Whether you host an open mic, connect us with a venue, or simply tell a fellow songwriter about CSC, you&apos;re helping build something real.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              The more people who know about us and keep our listings accurate, the easier it becomes for musicians across the Front Range to find their next stage.
            </p>
          </section>

          {/* Volunteer Sign-Up */}
          <section className="space-y-6">
            <div className="text-center">
              <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-4">
                Volunteer Sign-Up
              </h2>
              <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-[var(--line-height-relaxed)]">
                Want to host events, help with venues, or support CSC in other ways? Fill out the form below and we&apos;ll be in touch.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5 md:p-6">
              <VolunteerSignupForm />
            </div>
          </section>

          {/* Donation & Sponsorship */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Support CSC Financially
            </h2>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              The Colorado Songwriters Collective has operated for years as a volunteer-powered labor of love, primarily supported by founder Sami Serrag and the dozens of community members who have contributed their time, equipment, skills, and enthusiasm. We are deeply grateful for everyone who has helped us get this far.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Financial contributions or sponsorships would make a meaningful difference in our ability to grow, host more events, and serve more musicians across Denver.
            </p>
            <div className="rounded-2xl border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)] p-5 md:p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                    Individual Donations
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                    Every donation, no matter the size, helps us continue hosting events, maintaining the directory, and building community resources.
                  </p>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                    Corporate Sponsorships
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                    Partner with CSC as a sponsor and support Denver&apos;s songwriting community while gaining visibility among a creative, engaged audience.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--color-border-default)]">
                <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] mb-4">
                  Your contributions help cover venue fees, equipment, website hosting, and community programming.
                </p>
                <Button asChild variant="primary" size="lg">
                  <Link href="/tip-jar">Support the Collective</Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="rounded-3xl border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)] p-6 md:p-8 text-center space-y-4">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Ready to Get Started?
            </h2>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              The easiest way to help right now is to submit or update an open mic listing. It only takes a few minutes and makes a real difference.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/submit-open-mic">Submit an open mic</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/happenings?type=open_mic">See open mics</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/partners">Partner with the community</Link>
              </Button>
            </div>
          </section>

        </div>
      </PageContainer>
    </>
  );
}
