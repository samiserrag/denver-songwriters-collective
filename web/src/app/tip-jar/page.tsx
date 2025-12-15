import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";

export const metadata: Metadata = {
  title: "Tip Jar | Denver Songwriters Collective",
  description: "Support the Denver Songwriters Collective and help us keep building community for songwriters across Denver.",
};

export default function TipJarPage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection minHeight="md" showVignette showBottomFade>
        <PageContainer>
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-[length:var(--font-size-heading-2xl)] md:text-[3.5rem] font-[var(--font-family-serif)] text-[var(--color-text-accent)] leading-[var(--line-height-tight)]">
              Tip Jar
            </h1>
            <p className="text-[length:var(--font-size-body-lg)] md:text-xl text-[var(--color-text-primary)] max-w-2xl mx-auto leading-[var(--line-height-relaxed)]">
              Help us keep the music playing and the community growing.
            </p>
          </div>
        </PageContainer>
      </HeroSection>

      {/* Main Content */}
      <PageContainer>
        <div className="py-16 space-y-12 max-w-3xl mx-auto">

          {/* Why Support */}
          <section className="space-y-6 text-center">
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              The Denver Songwriters Collective is a grassroots, volunteer-run community. We don&apos;t charge membership fees or take cuts from performers. Everything we do is powered by passion and generosity.
            </p>
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] leading-[var(--line-height-relaxed)]">
              Your tips help cover costs like venue fees, equipment maintenance, website hosting, promotional materials, and the little things that make our events special.
            </p>
          </section>

          {/* Tip Options */}
          <section className="space-y-6">
            <h2 className="text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] text-center">
              Ways to Contribute
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Venmo */}
              <a
                href="https://venmo.com/u/Sami-Serrag-Music"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-8 space-y-4 text-center hover:border-[var(--color-border-accent)]/50 transition-colors"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-[#008CFF] flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.5 3c.9 1.5 1.3 3 1.3 5 0 4-3.4 9.3-6.2 13H6.8L4 3.5l6-.6 1.3 10.4C12.5 11 15 6.5 15 4.5c0-.8-.1-1.3-.3-1.8l4.8.3z"/>
                  </svg>
                </div>
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)] group-hover:text-[var(--color-gold-300)] transition-colors">
                  Venmo
                </h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                  @Sami-Serrag-Music
                </p>
                <span className="inline-block text-sm text-[var(--color-text-accent)] group-hover:underline">
                  Send a tip →
                </span>
              </a>

              {/* PayPal */}
              <a
                href="https://paypal.me/SamiSerrag"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-8 space-y-4 text-center hover:border-[var(--color-border-accent)]/50 transition-colors"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-[#003087] flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.384a.77.77 0 0 1 .757-.645h6.483c2.953 0 4.937 1.543 4.448 4.49-.612 3.684-2.93 5.04-5.812 5.04H8.233l-.996 8.363a.641.641 0 0 1-.633.56l-.528.145zm12.82-14.533c.138-.827.063-1.39-.254-1.9-.35-.563-1.075-.948-2.008-1.042a3.555 3.555 0 0 0-.422-.025h-1.94l-.663 4.205h1.808c1.433 0 2.593-.316 3.097-1.238.12-.22.302-.668.382-1zm.826 4.398c-.613 3.685-2.93 5.04-5.813 5.04h-2.586l-.996 8.363a.64.64 0 0 1-.633.56H6.692a.641.641 0 0 1-.633-.74l.353-2.968h2.52a.77.77 0 0 0 .757-.645l.85-5.384h3.005c3.954 0 6.91-1.883 7.778-5.226.27-.77.4-1.452.4-2.048 0-.378-.04-.728-.118-1.052a2.79 2.79 0 0 1 .138 1.052c0 .596-.13 1.278-.4 2.048-.268.78-.556 1.5-.856 2.088.32-.15.634-.32.956-.538z"/>
                  </svg>
                </div>
                <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-accent)] group-hover:text-[var(--color-gold-300)] transition-colors">
                  PayPal
                </h3>
                <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)]">
                  @SamiSerrag
                </p>
                <span className="inline-block text-sm text-[var(--color-text-accent)] group-hover:underline">
                  Send a tip →
                </span>
              </a>
            </div>
          </section>

          {/* What Your Support Does */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] p-8 space-y-6">
            <h2 className="text-[length:var(--font-size-heading-md)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] text-center">
              What Your Support Makes Possible
            </h2>
            <ul className="space-y-3 text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)]">
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)] mt-1">✓</span>
                <span>Venue rental fees for open mics and showcases</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)] mt-1">✓</span>
                <span>Sound equipment, cables, and microphones</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)] mt-1">✓</span>
                <span>Website hosting and development</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)] mt-1">✓</span>
                <span>Promotional materials and event signage</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)] mt-1">✓</span>
                <span>Community events and special programming</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-text-accent)] mt-1">✓</span>
                <span>Keeping everything free and accessible for all</span>
              </li>
            </ul>
          </section>

          {/* Thank You */}
          <section className="text-center space-y-4">
            <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-accent)]/90 italic leading-[var(--line-height-relaxed)]">
              Every dollar helps us create more opportunities for songwriters to connect, share, and grow together.
            </p>
            <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-secondary)]">
              Thank you for being part of the collective.
            </p>
          </section>

          {/* Back Link */}
          <div className="text-center pt-8">
            <Link
              href="/about"
              className="text-[var(--color-text-accent)] hover:text-[var(--color-gold-300)] underline"
            >
              ← Back to About
            </Link>
          </div>

        </div>
      </PageContainer>
    </>
  );
}
