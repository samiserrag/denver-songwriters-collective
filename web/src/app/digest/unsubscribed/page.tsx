/**
 * Digest Unsubscribe Confirmation Page
 *
 * Public page shown after one-click unsubscribe.
 * Warm, community-forward tone with easy opt-back-in.
 *
 * Phase: GTM-2
 */

import Link from "next/link";

export const metadata = {
  title: "Unsubscribed — Denver Songwriters Collective",
  robots: "noindex",
};

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function UnsubscribedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const success = params.success === "1";
  const error = params.error;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        {success ? (
          <>
            <div className="text-5xl mb-6">👋</div>
            <h1 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">
              You&apos;ve been unsubscribed
            </h1>
            <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              We&apos;ve removed you from the weekly digest. You&apos;ll still be part of the community
              — just without the weekly email.
            </p>
            <p className="text-[var(--color-text-secondary)] mb-8 leading-relaxed">
              Changed your mind? You can re-subscribe anytime from your settings.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard/settings"
                className="inline-block px-6 py-3 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Re-subscribe in Settings
              </Link>
              <Link
                href="/happenings"
                className="inline-block px-6 py-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Browse Happenings
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-6">⚠️</div>
            <h1 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">
              Something went wrong
            </h1>
            <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              {error === "invalid"
                ? "This unsubscribe link appears to be invalid or expired. You can manage your email preferences from your account settings instead."
                : "We couldn\u2019t process your request right now. Please try again or manage your preferences from your account settings."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard/settings"
                className="inline-block px-6 py-3 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Manage Email Preferences
              </Link>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Go Home
              </Link>
            </div>
          </>
        )}

        <p className="text-[var(--color-text-tertiary)] text-sm mt-8">
          Questions? Reply to any digest email or reach out at{" "}
          <a
            href="mailto:hello@denversongwriterscollective.org"
            className="text-[var(--color-accent-primary)] hover:underline"
          >
            hello@denversongwriterscollective.org
          </a>
        </p>
      </div>
    </main>
  );
}
