"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Songwriter } from "@/types";
import { SongwriterAvatar } from "./SongwriterAvatar";
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
  return (
    <Link href={`/songwriters/${songwriter.id}`} className="block h-full group">
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "hover:-translate-y-1",
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
        <div className="p-5 space-y-3">
          <h3
            className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] tracking-tight"
          >
            {songwriter.name}
          </h3>

          {songwriter.genre && (
            <SongwriterTag>{songwriter.genre}</SongwriterTag>
          )}

          {songwriter.bio && (
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] line-clamp-2">
              {songwriter.bio}
            </p>
          )}

          {songwriter.location && (
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {songwriter.location}
            </p>
          )}

          {songwriter.socialLinks && (
            <SocialLinks links={songwriter.socialLinks} className="mt-3" />
          )}
        </div>
      </article>
    </Link>
  );
}
