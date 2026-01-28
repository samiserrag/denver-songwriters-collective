import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Host on DSC | Denver Songwriters Collective",
  description:
    "Learn about hosting happenings on Denver Songwriters Collective. Create your own events or claim existing open mics to manage signups and lineups.",
};

const benefits = [
  {
    title: "Manage Your Lineup",
    description:
      "Let performers sign up ahead of time. See who's coming, manage the order, and reduce day-of chaos.",
    icon: "clipboard",
  },
  {
    title: "Track Attendance",
    description:
      "Know how many people are planning to attend. Get notified when someone RSVPs or claims a slot.",
    icon: "users",
  },
  {
    title: "Reach More Musicians",
    description:
      "Your happening appears in the DSC directory. Musicians across Denver can discover and sign up.",
    icon: "megaphone",
  },
];

const hostingModes = [
  {
    title: "Create Your Own Event",
    description:
      "Starting a new open mic, showcase, or songwriter meetup? Create it from scratch with your own schedule, venue, and format.",
    cta: { text: "Create a Happening", href: "/dashboard/my-events/new" },
  },
  {
    title: "Claim an Existing Open Mic",
    description:
      "Already running an open mic that's listed on DSC? Claim it to manage the listing, get notified about signups, and handle the lineup.",
    cta: { text: "Browse Happenings", href: "/happenings" },
  },
];

const faqs = [
  {
    question: "Do I need to pay to host?",
    answer:
      "No. Hosting on DSC is completely free. We want to make it easy for anyone to run an open mic or showcase.",
  },
  {
    question: "What if someone else is already listed as host?",
    answer:
      "If you run an open mic that's listed with someone else as host, you can request to claim it. We'll verify and transfer hosting to you.",
  },
  {
    question: "Can I have co-hosts?",
    answer:
      "Yes! Once you're a host, you can invite others as co-hosts. They'll get the same notifications and can help manage the lineup.",
  },
  {
    question: "How do performers sign up?",
    answer:
      "Performers visit your event page and claim available slots. You can see who's signed up and adjust the lineup as needed.",
  },
  {
    question: "What if I need to cancel a date?",
    answer:
      "You can cancel individual occurrences without affecting the rest of your series. Signed-up performers will be notified automatically.",
  },
];

function BenefitIcon({ type }: { type: string }) {
  switch (type) {
    case "clipboard":
      return (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      );
    case "users":
      return (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    case "megaphone":
      return (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function HostPage() {
  return (
    <>
      <HeroSection minHeight="xs" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-text-accent)] leading-[var(--line-height-tight)]">
              Host on DSC
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-text-primary)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              Run an open mic, showcase, or songwriter meetup? DSC helps you
              manage signups, track attendance, and reach more musicians.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/signup">Get Started</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/happenings">See Happenings</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-10 space-y-12 max-w-4xl mx-auto">
          {/* Benefits Section */}
          <section>
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-6 text-center">
              What You Get as a Host
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {benefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="card-spotlight rounded-2xl p-6 space-y-4 text-center"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center text-[var(--color-accent-primary)]">
                    <BenefitIcon type={benefit.icon} />
                  </div>
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                    {benefit.title}
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Two Ways to Host */}
          <section>
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-6 text-center">
              Two Ways to Host
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {hostingModes.map((mode) => (
                <div
                  key={mode.title}
                  className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4"
                >
                  <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)]">
                    {mode.title}
                  </h3>
                  <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] leading-relaxed">
                    {mode.description}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={mode.cta.href}>{mode.cta.text}</Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Lineup Display Section */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] text-center">
              Lineup Display for Your Event
            </h2>
            <div className="rounded-2xl border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
              <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
                Each happening gets a dedicated display page you can show on a
                TV or projector at your venue. It shows:
              </p>
              <ul className="space-y-2 text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-accent-primary)]">1.</span>
                  <span>
                    <strong>Who&apos;s performing now</strong> — highlighted at
                    the top
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-accent-primary)]">2.</span>
                  <span>
                    <strong>Who&apos;s up next</strong> — so performers can get
                    ready
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-accent-primary)]">3.</span>
                  <span>
                    <strong>The full lineup</strong> — everyone signed up for
                    the night
                  </span>
                </li>
              </ul>
              <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-tertiary)] italic">
                You control the lineup from your phone. Advance to the next
                performer with one tap.
              </p>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5"
                >
                  <h3 className="text-[length:var(--font-size-body-lg)] font-medium text-[var(--color-text-primary)] mb-2">
                    {faq.question}
                  </h3>
                  <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Call to Action */}
          <section className="rounded-3xl border border-[var(--color-border-accent)] bg-[var(--color-bg-secondary)] p-6 md:p-8 text-center space-y-4">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Ready to Host?
            </h2>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] max-w-2xl mx-auto">
              Create a free account to get started. You can create a new
              happening or claim an existing one from the directory.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/signup">Create Account</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/happenings">Browse Happenings</Link>
              </Button>
            </div>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
