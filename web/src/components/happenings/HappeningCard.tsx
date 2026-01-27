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
import { getPublicVerificationState, shouldShowUnconfirmedBadge } from "@/lib/events/verification";
import {
  computeNextOccurrence,
  getTodayDenver,
  type EventForOccurrence,
  type NextOccurrenceResult,
  type OccurrenceOverride,
} from "@/lib/events/nextOccurrence";
import { VenueLink } from "@/components/venue/VenueLink";

// ============================================================
// Types
// ============================================================

export interface HappeningEvent {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;

  // Event type
  event_type?: "open_mic" | "showcase" | "song_circle" | "workshop" | "gig" | "kindred_group" | "jam_session" | "other" | string;
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
    // Phase 4.52: Venue link URLs
    google_maps_url?: string | null;
    website_url?: string | null;
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
  categories?: string[] | null;

  // Capacity / Availability
  capacity?: number | null;
  rsvp_count?: number | null;
  has_timeslots?: boolean | null;
  total_slots?: number | null;

  // Verification
  last_verified_at?: string | null;
  verified_by?: string | null;
  source?: string | null;
  host_id?: string | null;
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
  /**
   * Pre-computed occurrence from parent.
   * When provided, the card uses this instead of computing independently.
   * This ensures consistent todayKey across all cards in a list.
   */
  occurrence?: NextOccurrenceResult;
  /**
   * Canonical today key (YYYY-MM-DD in Denver timezone).
   * When provided with occurrence, ensures consistent date comparisons.
   */
  todayKey?: string;
  /**
   * Phase 4.21: Per-occurrence override (cancellation, time change, notes, flyer).
   * When provided, the card uses override data for display.
   */
  override?: OccurrenceOverride;
  /**
   * Phase 4.21: Whether this occurrence is cancelled.
   * Shorthand derived from override?.status === 'cancelled'.
   */
  isCancelled?: boolean;
  /**
   * Phase 4.81: Pre-resolved venue data for override venue_id.
   * When override_patch.venue_id changes the venue, this provides the name/URLs
   * without requiring a client-side fetch.
   */
  overrideVenueData?: {
    name: string;
    slug?: string | null;
    google_maps_url?: string | null;
    website_url?: string | null;
  } | null;
}

// ============================================================
// Date Helpers
// ============================================================

/**
 * Date display info derived from occurrence.
 */
interface DateInfo {
  label: string;
  isTonight: boolean;
  isTomorrow: boolean;
  isPast: boolean;
  /** Whether the schedule is unknown/unconfident */
  isUnknown: boolean;
  /** The occurrence used to compute this info */
  occurrence: NextOccurrenceResult;
}

/**
 * Get date display info using the canonical computeNextOccurrence logic.
 *
 * IMPORTANT: This uses computeNextOccurrence to determine isTonight/isTomorrow,
 * which correctly handles monthly ordinal recurrence (e.g., "3rd Wednesday").
 * A 5th Wednesday will NOT show TONIGHT for a 3WE event.
 *
 * @param event - The event to compute date info for
 * @param precomputedOccurrence - Optional pre-computed occurrence from parent
 * @param canonicalTodayKey - Optional canonical today key for consistency
 */
function getDateInfo(
  event: HappeningEvent,
  precomputedOccurrence?: NextOccurrenceResult,
  canonicalTodayKey?: string
): DateInfo {
  const todayKey = canonicalTodayKey ?? getTodayDenver();

  // Use pre-computed occurrence if provided, otherwise compute fresh
  let occurrence: NextOccurrenceResult;
  if (precomputedOccurrence) {
    occurrence = precomputedOccurrence;
  } else {
    const eventForOccurrence: EventForOccurrence = {
      event_date: event.event_date,
      day_of_week: event.day_of_week,
      recurrence_rule: event.recurrence_rule,
      start_time: event.start_time,
    };
    occurrence = computeNextOccurrence(eventForOccurrence, { todayKey });
  }

  // Check if the occurrence is in the past
  const isPast = occurrence.date < todayKey;

  // Phase 4.17.6: Only show TONIGHT/TOMORROW for confident schedules
  // Events with unknown schedules should not display misleading temporal badges
  if (occurrence.isConfident) {
    if (occurrence.isToday) {
      return { label: "TONIGHT", isTonight: true, isTomorrow: false, isPast: false, isUnknown: false, occurrence };
    }
    if (occurrence.isTomorrow) {
      return { label: "TOMORROW", isTonight: false, isTomorrow: true, isPast: false, isUnknown: false, occurrence };
    }
  }

  // For unconfident events, show "Schedule unknown"
  if (!occurrence.isConfident) {
    return { label: "SCHEDULE UNKNOWN", isTonight: false, isTomorrow: false, isPast: false, isUnknown: true, occurrence };
  }

  // Format the date for display (parse at noon UTC for safe formatting)
  const displayDate = new Date(`${occurrence.date}T12:00:00Z`);
  const formatted = displayDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  }).toUpperCase();

  return { label: formatted, isTonight: false, isTomorrow: false, isPast, isUnknown: false, occurrence };
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

/**
 * Phase 4.52: Get venue object with URLs for VenueLink component
 * Returns null if:
 * - No venue (custom location or online-only)
 * - Venue is a string (legacy data without URLs)
 */
function getVenueForLink(event: HappeningEvent): {
  google_maps_url?: string | null;
  website_url?: string | null;
} | null {
  // Only return venue object if it has URL data
  if (event.venue && typeof event.venue === "object") {
    return {
      google_maps_url: event.venue.google_maps_url,
      website_url: event.venue.website_url,
    };
  }
  return null;
}

/**
 * Build the detail page href for an event.
 *
 * Phase 4.87: When dateKey is provided, includes `?date=YYYY-MM-DD` for
 * occurrence-specific navigation. This ensures clicking a timeline card
 * anchors to the correct occurrence on the detail page.
 *
 * @param event - The event to link to
 * @param dateKey - Optional occurrence date (YYYY-MM-DD) to anchor the link
 */
function getDetailHref(event: HappeningEvent, dateKey?: string): string {
  // Prefer slug for SEO-friendly URLs, fallback to id for backward compatibility
  const identifier = event.slug || event.id;
  const basePath = event.event_type === "open_mic"
    ? `/open-mics/${identifier}`
    : `/events/${identifier}`;

  // Phase 4.87: Include ?date= when occurrence date is known
  return dateKey ? `${basePath}?date=${dateKey}` : basePath;
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
  kindred_group: "Kindred Songwriter Groups",
  jam_session: "Jam Session",
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
  kindred_group: "/images/event-defaults/song-circle.svg", // Uses song circle icon (similar community vibe)
  jam_session: "/images/event-defaults/gig.svg", // Uses gig icon (music/performance vibe)
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
  occurrence: precomputedOccurrence,
  todayKey: canonicalTodayKey,
  override,
  isCancelled = false,
  overrideVenueData,
}: HappeningCardProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Use canonical todayKey if provided, otherwise compute fresh
  const todayKey = canonicalTodayKey ?? getTodayDenver();

  // Phase 4.21/4.81: Apply ALL override_patch fields
  // override_patch takes precedence over legacy columns, which take precedence over event fields
  const patch = override?.override_patch as Record<string, unknown> | null | undefined;
  const effectiveStartTime = (patch?.start_time as string | undefined) || override?.override_start_time || event.start_time;
  const effectiveEndTime = (patch?.end_time as string | undefined) || event.end_time;
  const effectiveCoverUrl = (patch?.cover_image_url as string | undefined) || override?.override_cover_image_url || event.cover_image_url;
  const effectiveTitle = (patch?.title as string | undefined) || event.title;
  const effectiveLocationMode = (patch?.location_mode as typeof event.location_mode) || event.location_mode;
  const effectiveVenueId = (patch?.venue_id as string | undefined) || event.venue_id;
  const effectiveCustomLocationName = (patch?.custom_location_name as string | undefined) ?? event.custom_location_name;
  const effectiveCategories = (patch?.categories as string[] | undefined) || event.categories;
  const effectiveIsFree = patch?.is_free !== undefined ? (patch.is_free as boolean | null) : event.is_free;
  const effectiveCostLabel = (patch?.cost_label as string | undefined) ?? event.cost_label;
  const effectiveCapacity = patch?.capacity !== undefined ? (patch.capacity as number | null) : event.capacity;
  const effectiveHasTimeslots = patch?.has_timeslots !== undefined ? (patch.has_timeslots as boolean | null) : event.has_timeslots;
  const effectiveTotalSlots = patch?.total_slots !== undefined ? (patch.total_slots as number | null) : event.total_slots;
  const effectiveAgePolicy = (patch?.age_policy as string | undefined) ?? event.age_policy;

  // Build effective event for helpers that read from the event object
  const effectiveEvent: HappeningEvent = {
    ...event,
    title: effectiveTitle,
    start_time: effectiveStartTime,
    end_time: effectiveEndTime,
    cover_image_url: effectiveCoverUrl,
    location_mode: effectiveLocationMode,
    venue_id: effectiveVenueId,
    custom_location_name: effectiveCustomLocationName,
    categories: effectiveCategories,
    is_free: effectiveIsFree,
    cost_label: effectiveCostLabel,
    capacity: effectiveCapacity,
    has_timeslots: effectiveHasTimeslots,
    total_slots: effectiveTotalSlots,
    age_policy: effectiveAgePolicy,
    // If venue_id is overridden, use resolved override venue data (from server pre-fetch)
    ...(patch?.venue_id && patch.venue_id !== event.venue_id
      ? overrideVenueData
        ? { venue: { id: patch.venue_id as string, name: overrideVenueData.name, google_maps_url: overrideVenueData.google_maps_url, website_url: overrideVenueData.website_url }, venue_name: overrideVenueData.name }
        : { venue: null, venue_name: null }
      : {}),
    // If custom_location_name is overridden, clear venue data so custom location displays
    ...(patch?.custom_location_name && !patch?.venue_id ? { venue_name: null, venue: null } : {}),
  };

  // Derived values - use pre-computed occurrence if available
  const dateInfo = getDateInfo(event, precomputedOccurrence, todayKey);
  const venueName = getVenueName(effectiveEvent);
  const venueForLink = getVenueForLink(effectiveEvent);
  // Phase 4.87: Pass occurrence date for anchored links (if known and confident)
  const occurrenceDateKey = dateInfo.occurrence.isConfident ? dateInfo.occurrence.date : undefined;
  const detailHref = getDetailHref(effectiveEvent, occurrenceDateKey);
  const startTime = formatTimeToAMPM(effectiveStartTime ?? null);
  const signupTime = event.signup_time ? formatTimeToAMPM(event.signup_time) : null;

  const isOnlineOnly = effectiveLocationMode === "online";
  const isHybrid = effectiveLocationMode === "hybrid";
  // Phase 4.52: Custom locations don't get venue links
  const isCustomLocation = !effectiveVenueId && !!effectiveCustomLocationName;

  // Phase 4.37: Use verification state helper for consistent badge logic
  const verificationResult = getPublicVerificationState({
    status: event.status,
    host_id: event.host_id,
    source: event.source,
    last_verified_at: event.last_verified_at,
    verified_by: event.verified_by,
  });
  const verificationState = verificationResult.state;
  // P0 Fix: Suppress "Unconfirmed" badge for DSC TEST events
  const showUnconfirmedBadge = shouldShowUnconfirmedBadge({
    title: event.title,
    is_dsc_event: event.is_dsc_event,
    status: event.status,
    last_verified_at: event.last_verified_at,
  });

  // Phase 4.40: Show "Ended" for all past events regardless of verification
  // "Ended" takes priority over "Unconfirmed" since the event already happened
  const showEnded = dateInfo.isPast;

  // Cost display - NA standardization (uses effective override values)
  const getCostDisplay = (): string => {
    if (effectiveIsFree === true) return "Free";
    if (effectiveIsFree === false && effectiveCostLabel) return effectiveCostLabel;
    return "NA";
  };

  // Age policy display (uses effective override value)
  const getAgeDisplay = (): string | null => {
    if (effectiveAgePolicy) return effectiveAgePolicy;
    if (event.is_dsc_event && !effectiveAgePolicy) return "18+";
    return null;
  };

  // Availability display (uses effective override values)
  const getAvailabilityDisplay = (): string | null => {
    if (effectiveHasTimeslots && effectiveTotalSlots) {
      return `${effectiveTotalSlots} slots`;
    }
    if (effectiveCapacity && event.rsvp_count !== undefined) {
      const remaining = effectiveCapacity - (event.rsvp_count || 0);
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
  // 2. cover_image_url / imageUrl (full poster with blurred bg) - or override flyer
  // 3. default image by event type
  // 4. gradient placeholder
  // Phase 4.21: override flyer takes precedence if present
  const cardImageUrl = event.cover_image_card_url;
  const fullPosterUrl = effectiveCoverUrl || event.imageUrl;
  const defaultImageUrl = getDefaultImageForType(event.event_type);
  const hasOverrideCover = !!(patch?.cover_image_url || override?.override_cover_image_url);
  const hasCardImage = !!cardImageUrl && !hasOverrideCover; // Skip card image if override has flyer
  const hasFullPoster = (!hasCardImage && !!fullPosterUrl) || hasOverrideCover;
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
  // - success: Confirmed/verified - green
  // - danger: Cancelled - red
  const Chip = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "accent" | "muted" | "recurrence" | "warning" | "success" | "danger" }) => (
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
        variant === "warning" && "bg-[var(--pill-bg-warning)] text-[var(--pill-fg-warning)] border-[var(--pill-border-warning)]",
        // Success: Confirmed/verified - green
        variant === "success" && "bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)] border-[var(--pill-border-success)]",
        // Danger: Cancelled - red (theme-aware)
        variant === "danger" && "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400 border-red-300 dark:border-red-500/30"
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
          // Phase 4.21: Cancelled occurrences - de-emphasized with red accent
          isCancelled && "opacity-60 border-red-500/30 bg-red-500/5",
          // Tonight/Tomorrow highlight (same as MemberCard spotlight) - skip if cancelled
          !isCancelled && (dateInfo.isTonight || dateInfo.isTomorrow) && "border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/5",
          // Unknown schedule warning style
          !isCancelled && dateInfo.isUnknown && "border-amber-500/30 bg-amber-500/5",
          // Past events muted
          !isCancelled && dateInfo.isPast && "opacity-70",
          className
        )}
        role="article"
        data-testid="happening-card"
        data-cancelled={isCancelled ? "true" : undefined}
      >
        {/* Poster Media Section - Reduced height for density (was 4:3, now 3:2) */}
        {/* bg-tertiary provides letterbox background for object-contain images */}
        <div className="relative aspect-[3/2] overflow-hidden bg-[var(--color-bg-tertiary)]" data-testid="poster-thumbnail">
          {/* Tier 1: Card-optimized 4:3 image */}
          {hasCardImage && (
            <Image
              src={cardImageUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.02]"
              data-testid="card-image"
            />
          )}

          {/* Tier 2: Full cover image - object-contain shows full image with letterboxing */}
          {hasFullPoster && fullPosterUrl && (
            <Image
              src={fullPosterUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
              data-testid="full-poster-contained"
            />
          )}

          {/* Tier 3: Default image by event type */}
          {hasDefaultImage && (
            <Image
              src={defaultImageUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.02]"
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
          {/* Phase 4.37/4.40: Show verification state badges */}
          {/* Priority: cancelled > ended (past) > unconfirmed */}
          {/* P0 Fix: showUnconfirmedBadge suppresses badge for DSC TEST events */}
          {(isCancelled || showEnded || showUnconfirmedBadge) && (
            <div className="absolute top-2.5 left-2.5 z-10">
              <span
                className={cn(
                  "px-2 py-1 text-xs font-bold uppercase tracking-wide rounded-full",
                  "bg-black/50 backdrop-blur-sm",
                  isCancelled && "text-red-400",
                  !isCancelled && showEnded && "text-white/70",
                  !isCancelled && !showEnded && showUnconfirmedBadge && "text-amber-300"
                )}
              >
                {isCancelled ? "CANCELLED" : showEnded ? "Ended" : "Unconfirmed"}
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

        {/* Content Section - Denser padding (was p-4, now p-3) */}
        <div className="p-3 space-y-1">
          {/* Title - slightly larger on desktop, tighter leading */}
          <h3
            className={cn(
              "font-semibold text-[var(--color-text-primary)]",
              "text-base md:text-lg leading-tight tracking-tight",
              "line-clamp-2"
            )}
          >
            {effectiveTitle}
          </h3>

          {/* Tier 2 recurrence pill - always visible, below title */}
          <div className="flex items-center gap-1 flex-wrap">
            <Chip variant="recurrence">{recurrenceSummary}</Chip>
            {/* DSC is Tier 1 - urgency/trust - shown prominently */}
            {event.is_dsc_event && <Chip variant="accent">DSC</Chip>}
          </div>

          {/* Meta line: Time · Venue · Cost - promoted visibility */}
          {/* Phase 4.52: Venue name is linkable when venue has google_maps_url or website_url */}
          <p className="text-sm md:text-base text-[var(--color-text-secondary)] truncate">
            {startTime || "NA"} ·{" "}
            {isOnlineOnly ? (
              "Online"
            ) : isHybrid && venueName ? (
              <>
                <VenueLink
                  name={venueName}
                  venue={isCustomLocation ? null : venueForLink}
                />
                {" + Online"}
              </>
            ) : venueName ? (
              <VenueLink
                name={venueName}
                venue={isCustomLocation ? null : venueForLink}
              />
            ) : (
              "NA"
            )}{" "}
            · {getCostDisplay()}
          </p>

          {/* Chips row - Tier 3 type/context pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Phase 4.38: Always-visible verification status pill */}
            {/* P0 Fix: Use showUnconfirmedBadge to suppress for DSC TEST events */}
            {verificationState === "confirmed" && (
              <Chip variant="success">
                <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Confirmed
              </Chip>
            )}
            {showUnconfirmedBadge && (
              <Chip variant="warning">Unconfirmed</Chip>
            )}
            {verificationState === "cancelled" && (
              <Chip variant="danger">Cancelled</Chip>
            )}
            <Chip variant="default">{eventTypeLabel}</Chip>
            {/* Categories (up to 3) */}
            {effectiveCategories && effectiveCategories.length > 0 && effectiveCategories.map((cat) => (
              <Chip key={cat} variant="muted">{cat}</Chip>
            ))}
            {ageDisplay && <Chip variant="muted">{ageDisplay}</Chip>}
            {signupChip.show && <Chip variant="muted">Sign-up: {signupChip.label}</Chip>}
            {availabilityDisplay && <Chip variant="muted">{availabilityDisplay}</Chip>}
            {/* Missing details as warning badge, not link */}
            {hasMissing && <Chip variant="warning">Missing details</Chip>}
            {/* Phase 4.21: Override notes indicator */}
            {override?.override_notes && <Chip variant="accent">Note</Chip>}
          </div>

          {/* Debug overlay - shown when ?debugDates=1 */}
          {debugDates && (
            <div className="mt-2 p-2 bg-black/80 text-white text-xs font-mono rounded space-y-0.5">
              <div>todayKey: {todayKey}</div>
              <div>occDate: {dateInfo.occurrence.date}</div>
              <div>label: {dateInfo.label}</div>
              <div>event_date: {event.event_date || "null"}</div>
              <div>day_of_week: {event.day_of_week || "null"}</div>
              <div>recurrence_rule: {event.recurrence_rule || "null"}</div>
              <div>isTonight: {dateInfo.isTonight.toString()}</div>
              <div>isTomorrow: {dateInfo.isTomorrow.toString()}</div>
              <div>precomputed: {precomputedOccurrence ? "yes" : "no"}</div>
            </div>
          )}
        </div>
      </article>
    </CardWrapper>
  );
}

export default HappeningCard;
