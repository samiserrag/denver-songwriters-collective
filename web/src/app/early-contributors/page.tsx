import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";

const missions = [
  {
    id: "songwriter",
    title: "Songwriter",
    timebox: "~20 minutes",
    bullets: [
      "Find 1 event you'd actually attend",
      "Check if artist profiles feel useful",
      "Tell us what would make you share this site",
    ],
    feedbackSubject: "Early Contributors — Songwriter",
  },
  {
    id: "host",
    title: "Happenings Host / Organizer",
    timebox: "~20 minutes",
    bullets: [
      "Pretend you're promoting a happening",
      "Check event detail clarity (where/when/signup)",
      "Tell us what's missing for hosts",
    ],
    feedbackSubject: "Early Contributors — Host",
  },
  {
    id: "venue",
    title: "Venue / Promoter",
    timebox: "~20 minutes",
    bullets: [
      "Check venue pages (photos, parking, accessibility)",
      "Look for anything that would stop you partnering",
      "Tell us what info venues need most",
    ],
    feedbackSubject: "Early Contributors — Venue",
  },
  {
    id: "visitor",
    title: "First-time Visitor",
    timebox: "~20 minutes",
    bullets: [
      "Use the site like you've never heard of it",
      "Tell us what's confusing or feels unfinished",
      "Tell us what would make you come back",
    ],
    feedbackSubject: "Early Contributors — Visitor",
  },
];

export default function EarlyContributorsPage() {
  return (
    <>
      <HeroSection minHeight="xs" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-text-accent)] leading-[var(--line-height-tight)]">
              Early Contributors
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-text-primary)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              Help shape the Denver Songwriters Collective site in ~20 minutes.
            </p>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-10 space-y-12 max-w-4xl mx-auto">

          {/* Mission Cards */}
          <section>
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-6 text-center">
              Pick Your Mission
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {missions.map((mission) => (
                <div
                  key={mission.id}
                  id={mission.id}
                  className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                      {mission.title}
                    </h3>
                    <span className="text-xs px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-full">
                      {mission.timebox}
                    </span>
                  </div>
                  <ul className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed space-y-2">
                    {mission.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[var(--color-text-accent)] mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="primary" size="sm" className="w-full">
                    <Link
                      href={`/feedback?category=feature&subject=${encodeURIComponent(mission.feedbackSubject)}`}
                    >
                      Send Feedback
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Boundaries Section */}
          <section className="rounded-2xl border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
            <h2 className="text-[length:var(--font-size-heading-md)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              What to Expect
            </h2>
            <ul className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-relaxed space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)]">→</span>
                <span>We review everything, but can&apos;t reply to every message.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)]">→</span>
                <span>Please use the Feedback form (not DMs or comments) so nothing gets lost.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)]">→</span>
                <span>Some events may be unverified during pre-launch testing.</span>
              </li>
            </ul>
          </section>

          {/* Quick Links */}
          <section className="text-center space-y-4">
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)]">
              Not sure where to start? Explore first, then come back.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="secondary" size="default">
                <Link href="/happenings">Explore Happenings</Link>
              </Button>
              <Button asChild variant="outline" size="default">
                <Link href="/venues">Browse Venues</Link>
              </Button>
              <Button asChild variant="outline" size="default">
                <Link href="/songwriters">Meet Songwriters</Link>
              </Button>
            </div>
          </section>

        </div>
      </PageContainer>
    </>
  );
}
