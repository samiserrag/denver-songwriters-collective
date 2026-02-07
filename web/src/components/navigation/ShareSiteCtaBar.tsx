import Link from "next/link";
import { INVITE_CTA_BODY, INVITE_CTA_HEADLINE, SHARE_SITE_CTA_LABEL } from "@/lib/referrals";

interface ShareSiteCtaBarProps {
  position: "top" | "bottom";
}

export function ShareSiteCtaBar({ position }: ShareSiteCtaBarProps) {
  return (
    <section
      aria-label={`Share site call to action ${position}`}
      className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:px-8">
        <p className="text-sm text-[var(--color-text-secondary)]">
          <span className="font-medium text-[var(--color-text-primary)]">{INVITE_CTA_HEADLINE}</span>{" "}
          {INVITE_CTA_BODY}
        </p>
        <Link
          href="/dashboard/invite"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          {SHARE_SITE_CTA_LABEL}
        </Link>
      </div>
    </section>
  );
}
