import { PageContainer, HeroSection } from "@/components/layout";
import Link from "next/link";

/**
 * Changelog Entry Type
 *
 * Each entry represents a shipped feature or fix.
 * Add new entries at the TOP of the array (newest first).
 */
interface ChangelogEntry {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Short title describing the change */
  title: string;
  /** 1-3 bullet points explaining what changed */
  bullets: string[];
  /** Optional tags for categorization */
  tags?: ("feature" | "fix" | "improvement")[];
}

/**
 * Changelog Entries
 *
 * Add new entries at the TOP (newest first).
 * Keep bullets concise (1-3 per entry).
 */
const changelogEntries: ChangelogEntry[] = [
  {
    date: "2026-01-20",
    title: "Centralized Feedback System",
    bullets: [
      "New /feedback page for bug reports, feature requests, and general feedback",
      "All submissions stored in database for tracking and prioritization",
      "Email notifications to admin when feedback is submitted",
    ],
    tags: ["feature"],
  },
  {
    date: "2026-01-20",
    title: "Get Involved Page Updates",
    bullets: [
      "Added Tip Jar link for community support",
      "Test Website Features card now links to feedback form",
    ],
    tags: ["improvement"],
  },
];

const TAG_STYLES: Record<string, string> = {
  feature: "bg-emerald-100 text-emerald-800 border-emerald-300",
  fix: "bg-rose-100 text-rose-800 border-rose-300",
  improvement: "bg-sky-100 text-sky-800 border-sky-300",
};

const TAG_LABELS: Record<string, string> = {
  feature: "New",
  fix: "Fix",
  improvement: "Improved",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T12:00:00Z");
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });
}

export default function ChangelogPage() {
  return (
    <>
      <HeroSection minHeight="xs" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-text-accent)] leading-[var(--line-height-tight)]">
              What&apos;s Changed
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-text-primary)] max-w-3xl mx-auto leading-[var(--line-height-relaxed)]">
              Recent updates to the Denver Songwriters Collective site.
            </p>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-10 max-w-3xl mx-auto">
          <div className="space-y-8">
            {changelogEntries.map((entry, index) => (
              <article
                key={`${entry.date}-${index}`}
                className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6"
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <time
                    dateTime={entry.date}
                    className="text-sm text-[var(--color-text-tertiary)]"
                  >
                    {formatDate(entry.date)}
                  </time>
                  {entry.tags?.map((tag) => (
                    <span
                      key={tag}
                      className={`text-xs px-2 py-0.5 rounded-full border ${TAG_STYLES[tag]}`}
                    >
                      {TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
                <h2 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-3">
                  {entry.title}
                </h2>
                <ul className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-relaxed space-y-2">
                  {entry.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[var(--color-text-accent)] mt-0.5">
                        •
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* Back link */}
          <div className="mt-12 text-center">
            <Link
              href="/"
              className="text-[length:var(--font-size-body-md)] text-[var(--color-text-accent)] hover:underline"
            >
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
