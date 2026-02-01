import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";

const missions = [
  {
    id: "songwriter",
    title: "Songwriter",
    bullets: [
      "Find an event you'd actually attend (clarity, time, signup, vibe)",
      "Check if songwriter profiles feel useful and trustworthy",
      "Tell us what would make you share this with a friend",
    ],
    feedbackSubject: "Early Contributors — Songwriter",
  },
  {
    id: "host",
    title: "Happenings Host / Organizer",
    bullets: [
      "Pretend you're promoting a happening: does the page sell it clearly?",
      "Check event details for missing info (where/when/signup/age/cover)",
      "Tell us what hosts need most to keep listings accurate",
    ],
    feedbackSubject: "Early Contributors — Host",
  },
  {
    id: "venue",
    title: "Venue / Promoter",
    bullets: [
      "Review venue pages: photos, parking, accessibility, basic trust signals",
      "Look for anything that would block you from partnering",
      "Tell us what venues would want added before saying \"yes\"",
    ],
    feedbackSubject: "Early Contributors — Venue",
  },
  {
    id: "visitor",
    title: "First-time Visitor",
    bullets: [
      "Use the site like you've never heard of it",
      "Tell us what's confusing, slow, or feels unfinished",
      "Tell us what would make you come back next week",
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
            {/* Homepage navigation notice */}
            <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-3 text-amber-800 dark:text-amber-300 text-sm">
              <span className="font-medium">This is not the homepage.</span>{" "}
              <Link href="/" className="underline hover:no-underline font-medium">
                Go to the homepage →
              </Link>
            </div>
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-text-accent)] leading-[var(--line-height-tight)]">
              Early Contributors
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-text-primary)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              Help shape the Denver Songwriters Collective. Pick a mission, explore, and tell us what you find.
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
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                    {mission.title}
                  </h3>
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

          {/* Optional Deep Dive */}
          <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
            <h2 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              If you want to go deeper
            </h2>
            <ul className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-text-accent)] mt-0.5">•</span>
                <span>Try the site on mobile and report any friction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-text-accent)] mt-0.5">•</span>
                <span>Search for a venue or happening you know and check accuracy</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-text-accent)] mt-0.5">•</span>
                <span>Look for missing &quot;trust&quot; info (who runs it, privacy, what&apos;s verified)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-text-accent)] mt-0.5">•</span>
                <span>Note anything that feels unclear in navigation or wording</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-text-accent)] mt-0.5">•</span>
                <span>If you find a bug, include steps to reproduce in <Link href="/feedback" className="text-[var(--color-text-accent)] hover:underline">/feedback</Link></span>
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
