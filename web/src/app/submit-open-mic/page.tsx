import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import WorkInProgressBanner from "@/components/WorkInProgressBanner";

export default async function SubmitOpenMicPlaceholder({
  searchParams,
}: {
  searchParams?: { eventId?: string } | Promise<{ eventId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const eventId = resolvedSearchParams?.eventId ?? null;

  return (
    <div data-event-id={eventId ?? undefined}>
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-2">
            Submit an Open Mic
          </h1>
          <p className="text-[length:var(--font-size-body-md)] text-[var(--color-warm-gray-light)] max-w-3xl">
            This feature is coming soon. If you&apos;d like to submit an open mic now, email us at <a className="text-[#00FFCC] underline" href="mailto:hello@openmicdrop.com">hello@openmicdrop.com</a>.
          </p>

          <div className="mt-6">
            <Link
              href="/open-mics"
              className="inline-block rounded-xl bg-gradient-to-r from-[#00202b] to-[#000] px-5 py-2 text-sm font-semibold text-[#00FFCC] ring-1 ring-[#00FFCC]/10 hover:shadow-[0_0_14px_rgba(0,255,204,0.15)] transition"
            >
              Back to Directory
            </Link>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <WorkInProgressBanner />
      </PageContainer>

      <PageContainer>
        <div className="py-16 text-center">
          <p className="text-[var(--color-warm-gray-light)]">We're working on a submission form. In the meantime, reach out via email to have your event added.</p>
        </div>
      </PageContainer>
    </div>
  );
}
