"use client";

/**
 * HappeningCard - Phase 4.6 Premium Card Polish
 *
 * Inherits MemberCard surface recipe:
 * - card-spotlight class for radial gradient bg + shadow tokens
 * - Hover: shadow-card-hover + border-accent + subtle lift
 * - Poster zoom on hover (scale-[1.02])
 *
 * Layout:
 * - Top: 4:3 poster with overlays
 * - Bottom: Tight content stack
 */

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatTimeToAMPM, getRecurrenceSummary } from "@/lib/recurrenceHumanizer";
import { hasMissingDetails } from "@/lib/events/missingDetails";
import {
  computeNextOccurrence,
  getTodayDenver,
  type EventForOccurrence,
} from "@/lib/events/nextOccurrence";

// ============================================================
// Types
// ============================================================

export interface HappeningEvent {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;

  // Event type
  event_type?: "open_mic" | "showcase" | "song_circle" | "workshop" | "gig" | "other" | string;
  is_dsc_event?: boolean | null;

  // Timing
  event_date?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  signup_time?: string | null;
  recurrence_rule?: string | null;

  // Location (Phase 3.1 fields)
  venue_id?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  location_mode?: "venue" | "online" | "hybrid" | null;
  online_url?: string | null;
  venue?: {
    id?: string;
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  } | string | null;

  // Phase 4.0: Custom location fields
  custom_location_name?: string | null;
  custom_address?: string | null;
  custom_city?: string | null;
  custom_state?: string | null;

  // Cost (Phase 3.1 fields)
  is_free?: boolean | null;
  cost_label?: string | null;

  // Signup (Phase 3.1 fields)
  signup_mode?: "in_person" | "online" | "both" | "walk_in" | null;
  signup_url?: string | null;

  // Age policy (Phase 3.1)
  age_policy?: string | null;

  // Display
  cover_image_url?: string | null;
  cover_image_card_url?: string | null;
  imageUrl?: string | null;
  status?: string | null;
  category?: string | null;

  // Capacity / Availability
  capacity?: number | null;
  rsvp_count?: number | null;
  has_timeslots?: boolean | null;
  total_slots?: number | null;

  // Verification
  last_verified_at?: string | null;
  source?: string | null;
}

export interface HappeningCardProps {
  event: HappeningEvent;
  /** Search query for highlighting */
  searchQuery?: string | null;
  /** Display variant (reserved for future) */
  variant?: "grid" | "list";
  /** Optional click handler (if provided, renders as button instead of link) */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Show debug overlay with date computation details */
  debugDates?: boolean;
}

// ============================================================
// Date Helpers
// ============================================================

/**
 * Get date display info using the canonical computeNextOccurrence logic.
 *
 * IMPORTANT: This uses computeNextOccurrence to determine isTonight/isTomorrow,
 * which correctly handles monthly ordinal recurrence (e.g., "3rd Wednesday").
 * A 5th Wednesday will NOT show TONIGHT for a 3WE event.
 */
function getDateInfo(event: HappeningEvent): {
  label: string;
  isTonight: boolean;
  isTomorrow: boolean;
  isPast: boolean;
} {
  const todayKey = getTodayDenver();

  // Use computeNextOccurrence to get the canonical next occurrence date
  const eventForOccurrence: EventForOccurrence = {
    event_date: event.event_date,
    day_of_week: event.day_of_week,
    recurrence_rule: event.recurrence_rule,
    start_time: event.start_time,
  };
  const occurrence = computeNextOccurrence(eventForOccurrence);

  // Check if the occurrence is in the past
  const isPast = occurrence.date < todayKey;

  // Format the date label
  if (occurrence.isToday) {
    return { label: "TONIGHT", isTonight: true, isTomorrow: false, isPast: false };
  }
  if (occurrence.isTomorrow) {
    return { label: "TOMORROW", isTonight: false, isTomorrow: true, isPast: false };
  }

  // Format the date for display (parse at noon UTC for safe formatting)
  const displayDate = new Date(`${occurrence.date}T12:00:00Z`);
  const formatted = displayDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  }).toUpperCase();

  return { label: formatted, isTonight: false, isTomorrow: false, isPast };
}

// ============================================================
// Location Helper
// ============================================================

function getVenueName(event: HappeningEvent): string | null {
  if (event.venue_name) return event.venue_name;
  if (typeof event.venue === "string") return event.venue;
  if (event.venue && typeof event.venue === "object" && event.venue.name) {
    return event.venue.name;
  }
  if (event.custom_location_name) return event.custom_location_name;
  return null;
}

function getDetailHref(event: HappeningEvent): string {
  if (event.event_type === "open_mic") {
    return event.slug ? `/open-mics/${event.slug}` : `/open-mics/${event.id}`;
  }
  return `/events/${event.id}`;
}

// ============================================================
// Event Type Labels
// ============================================================

const EVENT_TYPE_LABELS: Record<string, string> = {
  open_mic: "Open Mic",
  showcase: "Showcase",
  song_circle: "Song Circle",
  workshop: "Workshop",
  gig: "Gig",
  other: "Event",
};

// ============================================================
// Default Event Type Images (Tier 3 fallback)
// ============================================================

const DEFAULT_EVENT_IMAGES: Record<string, string> = {
  open_mic: "/images/event-defaults/open-mic.svg",
  showcase: "/images/event-defaults/showcase.svg",
  song_circle: "/images/event-defaults/song-circle.svg",
  workshop: "/images/event-defaults/workshop.svg",
  gig: "/images/event-defaults/gig.svg",
  other: "/images/event-defaults/event.svg",
};

/**
 * Get default image URL for event type.
 * Returns null if type is unknown (fallback to gradient placeholder).
 */
function getDefaultImageForType(eventType: string | undefined): string | null {
  if (!eventType) return null;
  return DEFAULT_EVENT_IMAGES[eventType] || DEFAULT_EVENT_IMAGES["other"] || null;
}

// ============================================================
// Component
// ============================================================

export function HappeningCard({
  event,
  onClick,
  className,
  debugDates = false,
}: HappeningCardProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Derived values
  const dateInfo = getDateInfo(event);
  const todayKey = getTodayDenver();
  const venueName = getVenueName(event);
  const detailHref = getDetailHref(event);
  const startTime = formatTimeToAMPM(event.start_time ?? null);
  const signupTime = event.signup_time ? formatTimeToAMPM(event.signup_time) : null;

  const isOnlineOnly = event.location_mode === "online";
  const isHybrid = event.location_mode === "hybrid";

  const showScheduleTBD = event.status === "needs_verification" || event.status === "unverified";
  const showEnded = !showScheduleTBD && dateInfo.isPast;

  // Cost display - NA standardization
  const getCostDisplay = (): string => {
    if (event.is_free === true) return "Free";
    if (event.is_free === false && event.cost_label) return event.cost_label;
    return "NA";
  };

  // Location display - NA standardization
  const getLocationDisplay = (): string => {
    if (isOnlineOnly) return "Online";
    if (isHybrid && venueName) return `${venueName} + Online`;
    if (venueName) return venueName;
    return "NA";
  };

  // Age policy display
  const getAgeDisplay = (): string | null => {
    if (event.age_policy) return event.age_policy;
    if (event.is_dsc_event && !event.age_policy) return "18+";
    return null;
  };

  // Availability display
  const getAvailabilityDisplay = (): string | null => {
    if (event.has_timeslots && event.total_slots) {
      return `${event.total_slots} slots`;
    }
    if (event.capacity && event.rsvp_count !== undefined) {
      const remaining = event.capacity - (event.rsvp_count || 0);
      if (remaining > 0) return `${remaining} spots`;
      return "Full";
    }
    return null;
  };

  const eventTypeLabel = EVENT_TYPE_LABELS[event.event_type || "other"] || "Event";
  const hasMissing = hasMissingDetails(event);

  // Tier 2 recurrence summary
  const recurrenceSummary = getRecurrenceSummary(
    event.recurrence_rule,
    event.day_of_week,
    event.event_date
  );

  // Favorites state
  const [favorited, setFavorited] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkFavorite() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setFavorited(false);
          return;
        }
        const { data, error } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", user.id)
          .eq("event_id", event.id)
          .single();
        if (!error && mounted) {
          setFavorited(!!data);
        }
      } catch {
        /* ignore */
      }
    }
    checkFavorite();
    return () => { mounted = false; };
  }, [event.id, supabase]);

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoadingFav(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      if (!favorited) {
        setFavorited(true);
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id,
          event_id: event.id,
        });
        if (error) setFavorited(false);
      } else {
        setFavorited(false);
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("event_id", event.id);
        if (error) setFavorited(true);
      }
    } catch {
      router.push("/login");
    } finally {
      setLoadingFav(false);
    }
  }

  // Click handler
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // Wrapper
  const CardWrapper = onClick ? "div" : Link;
  const wrapperProps = onClick
    ? { onClick: handleClick, role: "button", tabIndex: 0, className: "block h-full group focus-visible:outline-none" }
    : { href: detailHref, className: "block h-full group focus-visible:outline-none" };

  // Image tiers:
  // 1. cover_image_card_url (optimized 4:3)
  // 2. cover_image_url / imageUrl (full poster with blurred bg)
  // 3. default image by event type
  // 4. gradient placeholder
  const cardImageUrl = event.cover_image_card_url;
  const fullPosterUrl = event.cover_image_url || event.imageUrl;
  const defaultImageUrl = getDefaultImageForType(event.event_type);
  const hasCardImage = !!cardImageUrl;
  const hasFullPoster = !hasCardImage && !!fullPosterUrl;
  const hasDefaultImage = !hasCardImage && !hasFullPoster && !!defaultImageUrl;

  // Signup chip
  const getSignupChipState = (): { label: string; show: boolean } => {
    if (signupTime) return { label: signupTime, show: true };
    if (event.signup_mode === "online") return { label: "Online", show: true };
    if (event.signup_mode === "walk_in") return { label: "Walk-in", show: true };
    return { label: "N/A", show: false };
  };
  const signupChip = getSignupChipState();
  const ageDisplay = getAgeDisplay();
  const availabilityDisplay = getAvailabilityDisplay();

  // Chip component - MemberCard pill style
  // px-2 py-0.5 text-sm rounded-full border
  // All variants use explicit tokens for theme-safe contrast
  // - accent: Tier 1 (urgency/trust) - stronger accent fill + contrasting fg
  // - recurrence: Tier 2 (pattern pills) - neutral fill + readable fg
  // - default/muted: Tier 3 (type/context) - outline + muted fg
  // - warning: Missing details badge - amber with explicit tokens
  const Chip = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "accent" | "muted" | "recurrence" | "warning" }) => (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-sm font-medium rounded-full border whitespace-nowrap",
        // Tier 1: Accent fill with contrasting foreground (dark on light, dark on gold)
        variant === "accent" && "bg-[var(--pill-bg-accent)] text-[var(--pill-fg-on-accent)] border-[var(--color-border-accent)]",
        // Tier 2: Neutral fill with readable foreground
        variant === "recurrence" && "bg-[var(--color-bg-secondary)] text-[var(--pill-fg-on-muted)] border-[var(--color-border-default)]",
        // Tier 3: Muted fill with neutral foreground
        variant === "default" && "bg-[var(--color-accent-muted)] text-[var(--pill-fg-on-neutral)] border-[var(--color-border-default)]",
        variant === "muted" && "bg-[var(--color-bg-tertiary)] text-[var(--pill-fg-on-neutral)] border-[var(--color-border-subtle)]",
        // Warning: Tokenized amber for theme safety
        variant === "warning" && "bg-[var(--pill-bg-warning)] text-[var(--pill-fg-warning)] border-[var(--pill-border-warning)]"
      )}
    >
      {children}
    </span>
  );

  return (
    <CardWrapper {...(wrapperProps as any)}>
      <article
        className={cn(
          // MemberCard exact surface: card-spotlight class
          "h-full overflow-hidden font-sans card-spotlight",
          // Transitions matching MemberCard (card-spotlight provides base transition)
          "transition-all duration-200 ease-out",
          "hover:shadow-md hover:border-[var(--color-accent-primary)]/30",
          // Focus ring
          "group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)]",
          // Tonight/Tomorrow highlight (same as MemberCard spotlight)
          (dateInfo.isTonight || dateInfo.isTomorrow) && "border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/5",
          // Past events muted
          dateInfo.isPast && "opacity-70",
          className
        )}
        role="article"
        data-testid="happening-card"
      >
        {/* Poster Media Section - 4:3 aspect with zoom on hover */}
        <div className="relative aspect-[4/3] overflow-hidden" data-testid="poster-thumbnail">
          {/* Tier 1: Card-optimized 4:3 image */}
          {hasCardImage && (
            <Image
              src={cardImageUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
              data-testid="card-image"
            />
          )}

          {/* Tier 2: Full poster with blurred background */}
          {hasFullPoster && (
            <>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${fullPosterUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(12px) brightness(0.7)',
                }}
                aria-hidden="true"
              />
              <Image
                src={fullPosterUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                data-testid="full-poster-contained"
              />
            </>
          )}

          {/* Tier 3: Default image by event type */}
          {hasDefaultImage && (
            <Image
              src={defaultImageUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
              data-testid="default-type-image"
            />
          )}

          {/* Tier 4: Designed placeholder - gradient with subtle pattern */}
          {!hasCardImage && !hasFullPoster && !hasDefaultImage && (
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center",
                // Rich gradient from bg-secondary through accent-muted to bg-tertiary
                "bg-gradient-to-br from-[var(--color-bg-secondary)] via-[var(--color-accent-muted)] to-[var(--color-bg-tertiary)]"
              )}
              data-testid="placeholder-tile"
            >
              {/* Music note icon - larger, subtler */}
              <svg
                className="w-16 h-16 text-[var(--color-text-tertiary)] opacity-20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
          )}

          {/* Favorite star overlay - top right */}
          <button
            onClick={toggleFavorite}
            aria-label={favorited ? "Remove favorite" : "Add favorite"}
            className={cn(
              "absolute top-2.5 right-2.5 z-10",
              "w-8 h-8 rounded-full flex items-center justify-center",
              "bg-black/40 backdrop-blur-sm",
              "text-lg leading-none transition-colors",
              favorited
                ? "text-[var(--color-accent-primary)]"
                : "text-white/80 hover:text-[var(--color-accent-primary)]"
            )}
            disabled={loadingFav}
          >
            {favorited ? "★" : "☆"}
          </button>

          {/* Status badge overlay - top left */}
          {(showScheduleTBD || showEnded) && (
            <div className="absolute top-2.5 left-2.5 z-10">
              <span
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded-full",
                  "bg-black/40 backdrop-blur-sm",
                  showScheduleTBD && "text-amber-300",
                  showEnded && "text-white/70"
                )}
              >
                {showScheduleTBD ? "Schedule TBD" : "Ended"}
              </span>
            </div>
          )}

          {/* Date badge overlay - bottom left */}
          {dateInfo.label && (
            <div className="absolute bottom-2.5 left-2.5 z-10">
              <span
                className={cn(
                  "px-2 py-1 text-xs font-bold uppercase tracking-wide rounded",
                  "bg-black/50 backdrop-blur-sm",
                  dateInfo.isTonight || dateInfo.isTomorrow
                    ? "text-[var(--color-accent-primary)]"
                    : "text-white"
                )}
                data-testid="date-eyebrow"
              >
                {dateInfo.label}
              </span>
            </div>
          )}
        </div>

        {/* Content Section - Tighter density */}
        <div className="p-4 space-y-1.5">
          {/* Title - slightly larger on desktop, tighter leading */}
          <h3
            className={cn(
              "font-semibold text-[var(--color-text-primary)]",
              "text-base md:text-lg leading-tight tracking-tight",
              "line-clamp-2"
            )}
          >
            {event.title}
          </h3>

          {/* Tier 2 recurrence pill - always visible, below title */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Chip variant="recurrence">{recurrenceSummary}</Chip>
            {/* DSC is Tier 1 - urgency/trust - shown prominently */}
            {event.is_dsc_event && <Chip variant="accent">DSC</Chip>}
          </div>

          {/* Meta line: Time · Venue · Cost - promoted visibility */}
          <p className="text-sm md:text-base text-[var(--color-text-secondary)] truncate">
            {startTime || "NA"} · {getLocationDisplay()} · {getCostDisplay()}
          </p>

          {/* Chips row - Tier 3 type/context pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <Chip variant="default">{eventTypeLabel}</Chip>
            {ageDisplay && <Chip variant="muted">{ageDisplay}</Chip>}
            {signupChip.show && <Chip variant="muted">Sign-up: {signupChip.label}</Chip>}
            {availabilityDisplay && <Chip variant="muted">{availabilityDisplay}</Chip>}
            {/* Missing details as warning badge, not link */}
            {hasMissing && <Chip variant="warning">Missing details</Chip>}
          </div>

          {/* Debug overlay - shown when ?debugDates=1 */}
          {debugDates && (
            <div className="mt-2 p-2 bg-black/80 text-white text-xs font-mono rounded space-y-0.5">
              <div>todayKey: {todayKey}</div>
              <div>nextOcc: {dateInfo.label}</div>
              <div>event_date: {event.event_date || "null"}</div>
              <div>day_of_week: {event.day_of_week || "null"}</div>
              <div>recurrence_rule: {event.recurrence_rule || "null"}</div>
              <div>isTonight: {dateInfo.isTonight.toString()}</div>
              <div>isTomorrow: {dateInfo.isTomorrow.toString()}</div>
            </div>
          )}
        </div>
      </article>
    </CardWrapper>
  );
}

export default HappeningCard;
