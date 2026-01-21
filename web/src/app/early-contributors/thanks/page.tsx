import Link from "next/link";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui";

export default function EarlyContributorsThanksPage() {
  return (
    <PageContainer className="min-h-screen flex items-center justify-center">
      <div className="max-w-lg w-full text-center px-6 py-12">
        <div className="text-6xl mb-6">🎸</div>
        <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-4">
          Thanks for Your Feedback
        </h1>
        <p className="text-[length:var(--font-size-body-lg)] text-[var(--color-text-secondary)] mb-4 leading-relaxed">
          We&apos;ll review your submission and use it to make the site better for Denver&apos;s music community.
        </p>
        <p className="text-[length:var(--font-size-body-md)] text-[var(--color-text-tertiary)] mb-4">
          Fixes and improvements will roll out over the coming weeks. No individual replies, but your input shapes what we prioritize.
        </p>
        <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-tertiary)] mb-8">
          <Link href="/changelog" className="text-[var(--color-text-accent)] hover:underline">
            See what&apos;s changed &rarr;
          </Link>
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild variant="primary" size="lg">
            <Link href="/">Home</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/happenings">Happenings</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/get-involved">Get Involved</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/tip-jar">Tip Jar</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
