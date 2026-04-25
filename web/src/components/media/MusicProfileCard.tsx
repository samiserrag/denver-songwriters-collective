import { SocialIcon } from "@/components/profile";
import type { MusicProfileLinkMeta } from "@/lib/mediaEmbeds";

interface MusicProfileCardProps {
  meta: MusicProfileLinkMeta;
}

export function MusicProfileCard({ meta }: MusicProfileCardProps) {
  const hasThumbnail = Boolean(meta.thumbnailUrl);

  return (
    <a
      href={meta.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 transition-colors hover:border-[var(--color-border-accent)]/50"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {hasThumbnail ? (
          <img
            src={meta.thumbnailUrl ?? undefined}
            alt=""
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-[var(--color-accent-muted)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
            <SocialIcon type={meta.provider} />
            <span className="capitalize">{meta.provider}</span>
          </div>
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{meta.headline}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">{meta.supportingText}</p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-[var(--color-link)]">{meta.ctaLabel}</span>
    </a>
  );
}
