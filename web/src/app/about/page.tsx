import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "About | The Colorado Songwriters Collective",
  description: "The Colorado Songwriters Collective is your home for finding stages, connecting with artists, and growing as a songwriter in Colorado.",
};

export const dynamic = "force-dynamic";

// Helper for initials fallback
function getInitials(name: string): string {
  if (!name) return "SS";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function AboutPage() {
  // Fetch Sami's avatar for the "Built by" card
  const supabase = await createSupabaseServerClient();
  const { data: samiProfile } = await supabase
    .from("profiles")
    .select("avatar_url, full_name")
    .eq("slug", "sami-serrag")
    .single();

  const avatarUrl = samiProfile?.avatar_url;
  const fullName = samiProfile?.full_name || "Sami Serrag";
  const mainCopyClass = "text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]";

  return (
    <>
      {/* Hero Section */}
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-6 py-8">
          <h1 className="font-[var(--font-family-display)] font-bold text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-3 drop-shadow-lg">
            About
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-6 max-w-2xl mx-auto drop-shadow">
            A community platform for Colorado songwriters
          </p>
        </div>
      </HeroSection>

      {/* Main Content */}
      <PageContainer typography>
        <div className="py-10 space-y-10 max-w-3xl mx-auto">

          {/* Section A: What This Is */}
          <section className="space-y-4">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              What This Is
            </h2>
            <p className={mainCopyClass}>
              The Colorado Songwriters Collective grew out of years of informal open mics, songwriting circles, and community-run events across Colorado. What started as a way to keep track of shows and stay connected gradually became something larger: a shared resource for songwriters, hosts, venues, and listeners.
            </p>
            <p className={mainCopyClass}>
              Today, this site is a community platform for discovering open mics, finding places to play, connecting with local musicians, and staying informed about Colorado&apos;s songwriter scene. Whether you&apos;re a performer looking for stages, a venue hosting events, or someone who simply loves local music, the goal is simple: make it easier to find your people and keep the scene visible.
            </p>
          </section>

          {/* Section B: Who Built It */}
          <section className="space-y-4">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Who Built It
            </h2>

            {/* Built By Card */}
            <Link
              href="/songwriters/sami-serrag"
              className="block group focus-visible:outline-none"
            >
              <div className="card-spotlight p-4 flex items-center gap-4 transition-shadow hover:shadow-md hover:border-[var(--color-accent-primary)]/30 group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30">
                {/* Avatar */}
                <div className="shrink-0">
                  {avatarUrl ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-[var(--color-border-default)]">
                      <Image
                        src={avatarUrl}
                        alt={fullName}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--color-accent-muted)] border border-[var(--color-border-default)] flex items-center justify-center text-[var(--color-text-secondary)] font-medium">
                      {getInitials(fullName)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[length:var(--font-size-body-lg)] font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                    {fullName}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Creator
                  </p>
                </div>

                {/* Arrow */}
                <div className="shrink-0 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent-primary)] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Built by Sami Serrag with help from modern AI-assisted development tools, this project is a practical response to real gaps in how local music events are shared and supported. It&apos;s an ongoing, community-driven project shaped by feedback from the people who actually use it.
            </p>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Sami has hosted around 80 events and could not have done it without the many volunteers from the collective and the hundreds of songwriters who have shown up to contribute their time, talents, and mutual encouragement to each other. Special shoutout to{" "}
              <Link
                href="/songwriters/robert"
                className="text-[var(--color-text-accent)] hover:underline"
              >
                Robert Fulton Jr
              </Link>, who set up and hosted a year of open mics for the collective.
            </p>
          </section>

          {/* Section C: Privacy */}
          <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
            <h2 className="text-[length:var(--font-size-heading-md)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Your Privacy Matters
            </h2>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              This site collects only what&apos;s necessary to function (such as an email address and basic activity data). Your information is never sold or shared with third parties, and you&apos;re always in control of your account.
            </p>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              For details, see the{" "}
              <Link
                href="/privacy"
                className="text-[var(--color-text-accent)] hover:underline"
              >
                Privacy Policy
              </Link>.
            </p>
          </section>

          {/* Section D: Get Involved CTAs */}
          <section className="space-y-4">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
              Get Involved
            </h2>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              The Collective improves through community participation.
            </p>
            <ul className="list-disc list-inside text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)] space-y-1">
              <li>Host or suggest events</li>
              <li>Help test new features</li>
              <li>Share feedback or report issues</li>
              <li>Support the project financially if you&apos;re able</li>
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="primary" size="lg">
                <Link href="/get-involved">Get Involved</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/feedback">Submit Feedback</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/tip-jar">Tip Jar</Link>
              </Button>
            </div>
          </section>

        </div>
      </PageContainer>
    </>
  );
}
