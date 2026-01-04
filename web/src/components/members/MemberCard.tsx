"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Member } from "@/types";
import { SpotlightBadge } from "@/components/special/spotlight-badge";
import { SocialLinks } from "@/components/special/social-links";
import { ImagePlaceholder } from "@/components/ui";

interface MemberCardProps {
  member: Member;
  className?: string;
}

function getInitials(name: string): string {
  if (!name) return "DSC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Identity flag helpers with legacy role fallback
 */
function isMemberSongwriter(member: Member): boolean {
  return member.isSongwriter || member.role === "performer" || member.role === "songwriter";
}

function isMemberHost(member: Member): boolean {
  return member.isHost || member.role === "host";
}

function isMemberStudio(member: Member): boolean {
  return member.isStudio || member.role === "studio";
}

function isMemberFan(member: Member): boolean {
  return member.isFan || member.role === "fan";
}

/**
 * Get primary badge style based on identity flags (priority: Studio > Host > Songwriter > Fan)
 */
function getBadgeStyle(member: Member): string {
  if (isMemberStudio(member)) {
    return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  }
  if (isMemberHost(member) && !isMemberSongwriter(member)) {
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  }
  if (isMemberSongwriter(member)) {
    return "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30";
  }
  if (isMemberFan(member)) {
    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  }
  return "bg-gray-500/20 text-[var(--color-text-secondary)] border-gray-500/30";
}

/**
 * Get primary label based on identity flags
 * Shows combined labels when appropriate (e.g., "Songwriter & Host")
 */
function getLabel(member: Member): string {
  if (isMemberStudio(member)) {
    return "Studio";
  }
  if (isMemberSongwriter(member) && isMemberHost(member)) {
    return "Songwriter & Host";
  }
  if (isMemberSongwriter(member)) {
    return "Songwriter";
  }
  if (isMemberHost(member)) {
    return "Host";
  }
  if (isMemberFan(member)) {
    return "Fan";
  }
  return "Member";
}

/**
 * Get profile link based on identity flags (Studio -> /studios, others -> /songwriters)
 * Prefers slug for SEO-friendly URLs, falls back to id for backward compatibility
 */
function getProfileLink(member: Member): string {
  const identifier = member.slug || member.id;
  if (isMemberStudio(member)) {
    return `/studios/${identifier}`;
  }
  // All other members (songwriters, hosts, fans) go to /songwriters/[id]
  return `/songwriters/${identifier}`;
}

export function MemberCard({ member, className }: MemberCardProps) {
  const profileLink = getProfileLink(member);
  const roleLabel = getLabel(member);
  const roleBadgeStyle = getBadgeStyle(member);

  return (
    <Link href={profileLink} className="block h-full group focus-visible:outline-none">
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "transition-shadow transition-colors duration-200 ease-out",
          "hover:shadow-md hover:border-[var(--color-accent-primary)]/30",
          "group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)]",
          // Highlight treatment for spotlight members
          member.isSpotlight && "border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/5",
          className
        )}
      >
        {/* Image Section */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {member.avatarUrl ? (
            <Image
              src={member.avatarUrl}
              alt={member.name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          ) : (
            <ImagePlaceholder
              initials={getInitials(member.name)}
              className="w-full h-full"
            />
          )}

          {/* Spotlight badge */}
          {member.isSpotlight && (
            <div className="absolute top-3 right-3">
              <SpotlightBadge />
            </div>
          )}

          {/* Role badge */}
          <div className="absolute top-3 left-3">
            <span
              className={cn(
                "px-2 py-1 text-sm font-medium rounded-full border",
                roleBadgeStyle
              )}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3 text-center">
          <h3 className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight">
            {member.name}
          </h3>

          {/* Tags - genres or specialties */}
          {(member.genres?.length || member.specialties?.length) && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {(member.genres || member.specialties)?.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-sm tracking-wide bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] rounded-full border border-[var(--color-border-default)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Availability indicators */}
          <div className="flex flex-wrap justify-center gap-2">
            {member.availableForHire && (
              <span className="px-2 py-0.5 text-sm tracking-wide bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                Available for Hire
              </span>
            )}
            {member.interestedInCowriting && (
              <span className="px-2 py-0.5 text-sm tracking-wide bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                Open to Cowriting
              </span>
            )}
          </div>

          {member.bio && (
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
              {member.bio}
            </p>
          )}

          {member.location && (
            <p className="text-base uppercase tracking-widest text-[var(--color-text-tertiary)]">
              {member.location}
            </p>
          )}

          {member.socialLinks && (
            <SocialLinks links={member.socialLinks} className="mt-3 justify-center" />
          )}
        </div>
      </article>
    </Link>
  );
}
