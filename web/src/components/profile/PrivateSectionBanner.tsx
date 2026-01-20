/**
 * PrivateSectionBanner
 *
 * A prominent visual indicator that a section is private and only visible to the profile owner.
 * Used on profile pages to clearly communicate that content like RSVPs and Performances
 * are not visible to other visitors.
 */

interface PrivateSectionBannerProps {
  className?: string;
}

export function PrivateSectionBanner({ className = "" }: PrivateSectionBannerProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] ${className}`}
      data-testid="private-section-banner"
    >
      {/* Lock icon */}
      <svg
        className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <span className="text-sm text-[var(--color-text-secondary)]">
        <span className="font-medium">Private</span> — Only you can see this section
      </span>
    </div>
  );
}
