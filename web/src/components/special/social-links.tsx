import * as React from "react";
import { cn } from "@/lib/utils";
import type { SocialLinks as SocialLinksType } from "@/types";

type SocialLinksSize = "sm" | "md";

interface SocialLinksProps {
  /** Pass a links object (preferred) */
  links?: SocialLinksType;
  /** Or pass individual props (backwards compatible) */
  instagram?: string;
  twitter?: string;
  website?: string;
  /** Size variant */
  size?: SocialLinksSize;
  className?: string;
}

const sizeClasses: Record<SocialLinksSize, { button: string; icon: string }> = {
  sm: { button: "h-8 w-8", icon: "h-3.5 w-3.5" },
  md: { button: "h-10 w-10", icon: "h-4 w-4" },
};

export function SocialLinks({
  links,
  instagram,
  twitter,
  website,
  size = "md",
  className,
}: SocialLinksProps) {
  // Merge: prefer `links` object, fall back to individual props
  const merged: SocialLinksType = links ?? { instagram, twitter, website };

  const socialItems = [
    { key: "instagram", url: merged.instagram, label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
    { key: "twitter", url: merged.twitter, label: "Twitter", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
    { key: "website", url: merged.website, label: "Website", path: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
  ].filter((item) => item.url);

  if (socialItems.length === 0) return null;

  const sizes = sizeClasses[size];

  return (
    <div
      className={cn("flex items-center gap-3", className)}
      role="list"
      aria-label="Social media links"
    >
      {socialItems.map(({ key, url, label, path }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            sizes.button,
            "rounded-full border border-[var(--color-gold)]/40",
            "flex items-center justify-center",
            "text-[var(--color-gold)]/70",
            "hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/50",
            "transition-all duration-200"
          )}
          aria-label={`${label} profile`}
          role="listitem"
        >
          <svg
            className={sizes.icon}
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d={path} />
          </svg>
        </a>
      ))}
    </div>
  );
}
