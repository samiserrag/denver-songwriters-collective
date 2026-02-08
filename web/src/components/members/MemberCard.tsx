"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Member } from "@/types";
import { SpotlightBadge } from "@/components/special/spotlight-badge";
import { SocialLinks } from "@/components/special/social-links";
import { ImagePlaceholder } from "@/components/ui";
import { RoleBadges } from "./RoleBadges";

interface MemberCardProps {
  member: Member;
  className?: string;
}

function getInitials(name: string): string {
  if (!name) return "CSC";
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
 * Convert Member to RoleBadgeFlags for the shared RoleBadges component
 */
function memberToRoleBadgeFlags(member: Member) {
  return {
    isSongwriter: isMemberSongwriter(member),
    isHost: isMemberHost(member),
    isVenueManager: member.isVenueManager,
    isFan: isMemberFan(member),
    role: member.role,
  };
}

/**
 * Get profile link based on identity flags
 * Routing priority:
 * - Studios → /studios/[id]
 * - Songwriters or Hosts → /songwriters/[id]
 * - Fan-only (is_fan=true and all others false) → /members/[id]
 * Prefers slug for SEO-friendly URLs, falls back to id for backward compatibility
 */
function getProfileLink(member: Member): string {
  const identifier = member.slug || member.id;
  if (isMemberStudio(member)) {
    return `/studios/${identifier}`;
  }
  if (isMemberSongwriter(member) || isMemberHost(member)) {
    return `/songwriters/${identifier}`;
  }
  // Fan-only members go to /members/[id]
  return `/members/${identifier}`;
}

export function MemberCard({ member, className }: MemberCardProps) {
  const profileLink = getProfileLink(member);
  const roleBadgeFlags = memberToRoleBadgeFlags(member);

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
              // Phase 4.38: Use object-top to prioritize showing head/face, preventing top crop
              className="object-cover object-top"
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
            <RoleBadges flags={roleBadgeFlags} mode="single" size="sm" />
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
