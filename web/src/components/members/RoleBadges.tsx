"use client";

import { cn } from "@/lib/utils";

/**
 * Role badge configuration for consistent styling across all surfaces.
 * Order: Songwriter → Happenings Host → Venue Manager → Fan
 */
export interface RoleBadgeFlags {
  isSongwriter?: boolean;
  isHost?: boolean;
  isVenueManager?: boolean;
  isFan?: boolean;
  // Legacy role field for backward compatibility
  role?: string;
}

interface RoleBadgeConfig {
  key: string;
  label: string;
  className: string;
}

/**
 * Get the list of badges to display based on identity flags.
 * Always returns badges in consistent order: Songwriter → Happenings Host → Venue Manager → Fan
 */
export function getRoleBadges(flags: RoleBadgeFlags): RoleBadgeConfig[] {
  const badges: RoleBadgeConfig[] = [];

  // Songwriter (includes legacy "performer" role)
  const isSongwriter = flags.isSongwriter || flags.role === "performer" || flags.role === "songwriter";
  if (isSongwriter) {
    badges.push({
      key: "songwriter",
      label: "Songwriter",
      className: "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30",
    });
  }

  // Happenings Host (includes legacy "host" role)
  const isHost = flags.isHost || flags.role === "host";
  if (isHost) {
    badges.push({
      key: "host",
      label: "Happenings Host",
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    });
  }

  // Venue Manager (new - from venue_managers table)
  if (flags.isVenueManager) {
    badges.push({
      key: "venue-manager",
      label: "Venue Manager",
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    });
  }

  // Fan (includes legacy "fan" role) - only show if explicitly set
  const isFan = flags.isFan || flags.role === "fan";
  if (isFan) {
    badges.push({
      key: "fan",
      label: "Fan",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    });
  }

  return badges;
}

/**
 * Get a single combined label for card displays (backward compatible with MemberCard).
 * Returns the primary role label, combining Songwriter & Host if both are present.
 */
export function getPrimaryRoleLabel(flags: RoleBadgeFlags): string {
  const isSongwriter = flags.isSongwriter || flags.role === "performer" || flags.role === "songwriter";
  const isHost = flags.isHost || flags.role === "host";
  const isFan = flags.isFan || flags.role === "fan";

  if (isSongwriter && isHost) {
    return "Songwriter & Host";
  }
  if (isSongwriter) {
    return "Songwriter";
  }
  if (isHost) {
    return "Happenings Host";
  }
  if (flags.isVenueManager) {
    return "Venue Manager";
  }
  if (isFan) {
    return "Fan";
  }
  return "Member";
}

/**
 * Get the primary badge style for card displays (backward compatible with MemberCard).
 */
export function getPrimaryBadgeStyle(flags: RoleBadgeFlags): string {
  const isSongwriter = flags.isSongwriter || flags.role === "performer" || flags.role === "songwriter";
  const isHost = flags.isHost || flags.role === "host";
  const isFan = flags.isFan || flags.role === "fan";

  // Priority: Songwriter > Host > Venue Manager > Fan
  if (isSongwriter) {
    return "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30";
  }
  if (isHost) {
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  }
  if (flags.isVenueManager) {
    return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  }
  if (isFan) {
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  }
  return "bg-gray-500/20 text-[var(--color-text-secondary)] border-gray-500/30";
}

interface RoleBadgesProps {
  flags: RoleBadgeFlags;
  /** Display mode: "row" shows all badges, "single" shows primary badge only */
  mode?: "row" | "single";
  /** Size variant for badges */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Shared component for displaying role badges consistently across all surfaces.
 *
 * Usage:
 * - Detail pages: <RoleBadges flags={...} mode="row" /> (shows all badges)
 * - Card overlays: <RoleBadges flags={...} mode="single" /> (shows primary badge)
 */
export function RoleBadges({ flags, mode = "row", size = "md", className }: RoleBadgesProps) {
  const sizeClasses = size === "sm"
    ? "px-2 py-0.5 text-sm"
    : "px-3 py-1 text-sm";

  if (mode === "single") {
    const label = getPrimaryRoleLabel(flags);
    const style = getPrimaryBadgeStyle(flags);
    return (
      <span
        className={cn(
          sizeClasses,
          "font-medium rounded-full border",
          style,
          className
        )}
      >
        {label}
      </span>
    );
  }

  const badges = getRoleBadges(flags);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={cn(
            sizeClasses,
            "font-medium rounded-full border",
            badge.className
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
