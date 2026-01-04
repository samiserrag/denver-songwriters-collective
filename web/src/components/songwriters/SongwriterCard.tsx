"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Songwriter } from "@/types";
// SongwriterAvatar removed - using next/image directly
import { SongwriterTag } from "./SongwriterTag";
import { SpotlightBadge } from "@/components/special/spotlight-badge";
import { SocialLinks } from "@/components/special/social-links";
import { ImagePlaceholder } from "@/components/ui";

interface SongwriterCardProps {
  songwriter: Songwriter;
  className?: string;
}

function getInitials(name: string): string {
  if (!name) return "OMD";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SongwriterCard({ songwriter, className }: SongwriterCardProps) {
  // Prefer slug for SEO-friendly URLs, fallback to id for backward compatibility
  const profilePath = `/songwriters/${songwriter.slug || songwriter.id}`;
  return (
    <Link href={profilePath} className="block h-full group focus-visible:outline-none">
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "transition-shadow transition-colors duration-200 ease-out",
          "hover:shadow-md hover:border-[var(--color-accent-primary)]/30",
          "group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)]",
          className
        )}
      >
        {/* Image Section - aspect-[4/3] reserves stable space to prevent CLS */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {songwriter.avatarUrl ? (
            <Image
              src={songwriter.avatarUrl}
              alt={songwriter.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <ImagePlaceholder
              initials={getInitials(songwriter.name)}
              className="w-full h-full"
            />
          )}

          {/* Spotlight badge */}
          {songwriter.isSpotlight && (
            <div className="absolute top-3 right-3">
              <SpotlightBadge />
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3 text-center">
          <h3
            className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight"
          >
            {songwriter.name}
          </h3>

          {songwriter.genre && (
            <SongwriterTag>{songwriter.genre}</SongwriterTag>
          )}

          {songwriter.bio && (
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 text-left mx-auto max-w-prose">
              {songwriter.bio}
            </p>
          )}

          {songwriter.location && (
            <p className="text-base uppercase tracking-widest text-[var(--color-text-tertiary)]">
              {songwriter.location}
            </p>
          )}

          {songwriter.socialLinks && (
            <SocialLinks links={songwriter.socialLinks} className="mt-3 justify-center" />
          )}
        </div>
      </article>
    </Link>
  );
}
