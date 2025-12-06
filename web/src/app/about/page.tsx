import { PageContainer, HeroSection } from "@/components/layout";

export default function AboutPage() {
  return (
    <>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-2">About Open Mic Drop</h1>
          <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] max-w-3xl">
            Open Mic Drop is a community-driven directory of local open mics, built to help performers and venues connect. We're focused on accurate, up-to-date listings and making it easy to discover events in your area.
          </p>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-br from-[#05060b] to-[#000000] p-8">
          <h2 className="text-lg font-semibold text-[var(--color-warm-white)]">How it works</h2>
          <p className="mt-2 text-[var(--color-warm-gray-light)]">Listings are submitted by the community and reviewed for accuracy. If you see something that's out of date, use the submit form to suggest an update.</p>

          <h2 className="text-lg font-semibold text-[var(--color-warm-white)] mt-4">Join the community</h2>
          <p className="mt-2 text-[var(--color-warm-gray-light)]">Contribute by submitting open mics, suggesting edits, or sharing events with performers who might be interested.</p>
        </div>
      </PageContainer>
    </>
  );
}
