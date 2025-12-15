"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Member, MemberRole } from "@/types";
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

function getRoleBadgeStyle(role: MemberRole): string {
  switch (role) {
    case "performer":
      return "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30";
    case "studio":
      return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    case "host":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "fan":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    default:
      return "bg-gray-500/20 text-gray-300 border-gray-500/30";
  }
}

function getRoleLabel(role: MemberRole, isHost?: boolean): string {
  if (role === "performer" && isHost) {
    return "Performer & Host";
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getProfileLink(member: Member): string {
  switch (member.role) {
    case "performer":
      return `/performers/${member.id}`;
    case "studio":
      return `/studios/${member.id}`;
    case "host":
      return `/performers/${member.id}`;
    default:
      return `/performers/${member.id}`;
  }
}

export function MemberCard({ member, className }: MemberCardProps) {
  const profileLink = getProfileLink(member);
  const roleLabel = getRoleLabel(member.role, member.isHost);
  const roleBadgeStyle = getRoleBadgeStyle(member.role);

  return (
    <Link href={profileLink} className="block h-full group">
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "hover:-translate-y-1",
          className
        )}
      >
        {/* Image Section */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <ImagePlaceholder
              initials={getInitials(member.name)}
              className="w-full h-full"
            />
          )}

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

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
                "px-2 py-1 text-xs font-medium rounded-full border",
                roleBadgeStyle
              )}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3">
          <h3 className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-text-primary)] tracking-tight">
            {member.name}
          </h3>

          {/* Tags - genres or specialties */}
          {(member.genres?.length || member.specialties?.length) && (
            <div className="flex flex-wrap gap-1.5">
              {(member.genres || member.specialties)?.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] rounded-full border border-[var(--color-border-default)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Availability indicators */}
          <div className="flex flex-wrap gap-2">
            {member.availableForHire && (
              <span className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                Available for Hire
              </span>
            )}
            {member.interestedInCowriting && (
              <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                Open to Cowriting
              </span>
            )}
          </div>

          {member.bio && (
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] line-clamp-2">
              {member.bio}
            </p>
          )}

          {member.location && (
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
              {member.location}
            </p>
          )}

          {member.socialLinks && (
            <SocialLinks links={member.socialLinks} className="mt-3" />
          )}
        </div>
      </article>
    </Link>
  );
}
