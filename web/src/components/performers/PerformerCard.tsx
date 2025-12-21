"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Performer } from "@/types";
// PerformerAvatar removed - using next/image directly
import { PerformerTag } from "./PerformerTag";
import { SpotlightBadge } from "@/components/special/spotlight-badge";
import { SocialLinks } from "@/components/special/social-links";
import { ImagePlaceholder } from "@/components/ui";

interface PerformerCardProps {
  performer: Performer;
  className?: string;
}

function getInitials(name: string): string {
  if (!name) return "OMD";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PerformerCard({ performer, className }: PerformerCardProps) {
  return (
    <Link href={`/performers/${performer.id}`} className="block h-full group">
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "hover:-translate-y-1",
          className
        )}
      >
        {/* Image Section - aspect-[4/3] reserves stable space to prevent CLS */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {performer.avatarUrl ? (
            <Image
              src={performer.avatarUrl}
              alt={performer.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <ImagePlaceholder
              initials={getInitials(performer.name)}
              className="w-full h-full"
            />
          )}

          {/* Spotlight badge */}
          {performer.isSpotlight && (
            <div className="absolute top-3 right-3">
              <SpotlightBadge />
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3 text-center">
          <h3
            className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] tracking-tight"
          >
            {performer.name}
          </h3>

          {performer.genre && (
            <PerformerTag>{performer.genre}</PerformerTag>
          )}

          {performer.bio && (
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] line-clamp-2 text-left">
              {performer.bio}
            </p>
          )}

          {performer.location && (
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {performer.location}
            </p>
          )}

          {performer.socialLinks && (
            <SocialLinks links={performer.socialLinks} className="mt-3 justify-center" />
          )}
        </div>
      </article>
    </Link>
  );
}
