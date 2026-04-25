import Link from "next/link";
import type { UnsupportedMusicLink } from "@/lib/profile/songLinks";

interface UnsupportedMusicLinksNoticeProps {
  links: UnsupportedMusicLink[];
}

export function UnsupportedMusicLinksNotice({ links }: UnsupportedMusicLinksNoticeProps) {
  if (links.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-border-accent)]/50 bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="font-medium text-[var(--color-text-primary)]">
            Some music links need a playable URL before they can appear here.
          </p>
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.url}>
                <span className="font-medium text-[var(--color-text-primary)]">{link.label}:</span>{" "}
                {link.guidance}
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/dashboard/profile"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2 font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-accent)] hover:bg-[var(--color-bg-tertiary)]"
        >
          Edit links
        </Link>
      </div>
    </div>
  );
}
