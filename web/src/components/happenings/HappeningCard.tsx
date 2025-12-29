"use client";

/**
 * HappeningCard - Unified event card component
 *
 * Single card component for ALL event types (open mics, DSC events, user events).
 * Implements Phase 3.1 display spec:
 * - Minimal events (title/date/time only) render gracefully
 * - Missing fields are omitted, not shown as placeholders
 * - Image container only renders if cover_image_url exists
 * - `object-fit: contain` for images (no cropping)
 */

import * as React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { highlight } from "@/lib/highlight";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import { PosterMedia } from "@/components/media";
import { MissingDetailsChipStatic } from "@/components/events/MissingDetailsChip";

// ============================================================
// Types
// ============================================================

export interface HappeningEvent {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;

  // Event type
  event_type?: "open_mic" | "showcase" | "song_circle" | "workshop" | "other" | string;
  is_dsc_event?: boolean | null;

  // Timing
  event_date?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
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
    google_maps_url?: string | null;
    map_link?: string | null;
    website_url?: string | null;
    neighborhood?: string | null;
  } | string | null;

  // Phase 4.0: Custom location fields (mutually exclusive with venue)
  custom_location_name?: string | null;
  custom_address?: string | null;
  custom_city?: string | null;
  custom_state?: string | null;
  custom_latitude?: number | null;
  custom_longitude?: number | null;
  location_notes?: string | null;

  // Cost (Phase 3.1 fields)
  is_free?: boolean | null;
  cost_label?: string | null;

  // Signup (Phase 3.1 fields)
  signup_mode?: "in_person" | "online" | "both" | "walk_in" | null;
  signup_time?: string | null;
  signup_url?: string | null;

  // Age policy (Phase 3.1)
  age_policy?: string | null;

  // Display
  cover_image_url?: string | null;
  imageUrl?: string | null;
  status?: string | null;
  category?: string | null;

  // Capacity
  capacity?: number | null;
  rsvp_count?: number | null;

  // Verification
  last_verified_at?: string | null;
  source?: string | null;
}

export interface HappeningCardProps {
  event: HappeningEvent;
  /** Search query for highlighting */
  searchQuery?: string | null;
  /** Display variant: "grid" for card layout, "list" for compact row layout */
  variant?: "grid" | "list";
  /** Optional click handler (if provided, renders as button instead of link) */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Phase 4.0: Get location name - checks venue first, then custom location
 * Venues and custom locations are mutually exclusive
 */
function getVenueName(event: HappeningEvent): string | null {
  // Check venue fields first
  if (event.venue_name) return event.venue_name;
  if (typeof event.venue === "string") return event.venue;
  if (event.venue && typeof event.venue === "object" && event.venue.name) {
    return event.venue.name;
  }
  // Phase 4.0: Fall back to custom location name
  if (event.custom_location_name) return event.custom_location_name;
  return null;
}

function getVenueCity(event: HappeningEvent): string | null {
  // Check venue object first
  if (typeof event.venue === "object" && event.venue?.city) {
    return event.venue.city;
  }
  // Phase 4.0: Fall back to custom city
  if (event.custom_city) return event.custom_city;
  return null;
}

function getVenueState(event: HappeningEvent): string | null {
  // Check venue object first
  if (typeof event.venue === "object" && event.venue?.state) {
    return event.venue.state;
  }
  // Phase 4.0: Fall back to custom state
  if (event.custom_state) return event.custom_state;
  return null;
}

function getLocationDisplay(event: HappeningEvent): string | null {
  const city = getVenueCity(event);
  const state = getVenueState(event);
  if (city && city.toUpperCase() !== "UNKNOWN") {
    return state ? `${city}, ${state}` : city;
  }
  return null;
}

function isValidMapUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Must be a proper HTTP(S) URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  // goo.gl and maps.app.goo.gl shortened URLs are broken (Dynamic Link Not Found)
  if (url.includes("goo.gl")) return false;
  return true;
}

function getMapUrl(event: HappeningEvent): string | null {
  // Check for venue map URLs first
  if (typeof event.venue === "object" && event.venue) {
    if (isValidMapUrl(event.venue.google_maps_url)) {
      return event.venue.google_maps_url!;
    }
    if (isValidMapUrl(event.venue.map_link)) {
      return event.venue.map_link!;
    }
  }

  // Phase 4.0: Handle custom location with lat/lng
  if (event.custom_latitude && event.custom_longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${event.custom_latitude},${event.custom_longitude}`;
  }

  // Fallback: generate search URL from name and address
  const locationName = getVenueName(event);
  if (locationName) {
    // Use custom address if available, otherwise fall back to venue address
    const address = event.custom_address ||
      event.venue_address ||
      (typeof event.venue === "object" && event.venue?.address);
    const query = address ? `${locationName}, ${address}` : locationName;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return null;
}

function getDetailHref(event: HappeningEvent): string {
  // Open mics use slug-based routing
  if (event.event_type === "open_mic") {
    return event.slug ? `/open-mics/${event.slug}` : `/open-mics/${event.id}`;
  }
  // All other events use ID-based routing
  return `/events/${event.id}`;
}

function getDateLabel(event: HappeningEvent): string | null {
  if (!event.event_date) return null;
  const d = new Date(event.event_date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  }).toUpperCase();
}

function getImageUrl(event: HappeningEvent): string | null {
  return event.cover_image_url || event.imageUrl || null;
}

// ============================================================
// Status Styles
// ============================================================

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active: { bg: "bg-emerald-900/60", text: "text-emerald-300", border: "border-emerald-500/40", label: "Active" },
  inactive: { bg: "bg-red-900/60", text: "text-red-300", border: "border-red-500/40", label: "Inactive" },
  cancelled: { bg: "bg-red-900/60", text: "text-red-300", border: "border-red-500/40", label: "Cancelled" },
  unverified: { bg: "bg-amber-900/60", text: "text-amber-300", border: "border-amber-500/40", label: "Schedule TBD" },
  needs_verification: { bg: "bg-amber-900/60", text: "text-amber-300", border: "border-amber-500/40", label: "Schedule TBD" },
  ended: { bg: "bg-slate-900/60", text: "text-slate-300", border: "border-slate-500/40", label: "Ended" },
};

const CATEGORY_COLORS: Record<string, string> = {
  music: "bg-emerald-900/60 text-emerald-200 border-emerald-500/40",
  comedy: "bg-yellow-900/60 text-yellow-200 border-yellow-500/40",
  poetry: "bg-purple-900/60 text-purple-200 border-purple-500/40",
  mixed: "bg-sky-900/60 text-sky-200 border-sky-500/40",
};

// ============================================================
// Component
// ============================================================

export function HappeningCard({
  event,
  searchQuery,
  variant = "grid",
  onClick,
  className,
}: HappeningCardProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Derived values
  const venueName = getVenueName(event);
  const locationDisplay = getLocationDisplay(event);
  const mapUrl = getMapUrl(event);
  const detailHref = getDetailHref(event);
  const imageUrl = getImageUrl(event);
  const dateLabel = getDateLabel(event);
  const dayOfWeek = event.day_of_week;

  const recurrenceText = humanizeRecurrence(event.recurrence_rule ?? null, dayOfWeek ?? null);
  const startTime = formatTimeToAMPM(event.start_time ?? null);
  const endTime = formatTimeToAMPM(event.end_time ?? null);

  const eventStatus = event.status;
  const statusStyle = eventStatus ? STATUS_STYLES[eventStatus] : null;
  const showStatusBadge = eventStatus && eventStatus !== "active";

  // Check if event is in the past (for dated events only)
  const isPastEvent = event.event_date
    ? new Date(event.event_date + "T23:59:59") < new Date()
    : false;

  // Location mode display
  const isOnlineOnly = event.location_mode === "online";
  const isHybrid = event.location_mode === "hybrid";

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

  // Click handler for custom onClick
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // Wrapper component
  const CardWrapper = onClick ? "div" : Link;
  const wrapperProps = onClick
    ? { onClick: handleClick, role: "button", tabIndex: 0, className: "block h-full group cursor-pointer focus-visible:outline-none" }
    : { href: detailHref, className: "block h-full group focus-visible:outline-none" };

  return (
    <CardWrapper {...(wrapperProps as any)}>
      <article
        className={cn(
          "group rounded-xl bg-[var(--color-bg-secondary)] border overflow-hidden transition-all duration-200 card-hover h-full",
          showStatusBadge
            ? "border-amber-500/30 hover:border-amber-500/50"
            : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]",
          className
        )}
        role="article"
        data-testid="happening-card"
      >
        {/* Image Section - only renders if image exists, hidden in list variant */}
        {variant === "grid" && imageUrl && (
          <div className="relative">
            <PosterMedia
              src={imageUrl}
              alt={event.title}
              variant="card"
            />
            {/* Day badge (for recurring events) */}
            {dayOfWeek && (
              <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 backdrop-blur rounded-full">
                <span className="text-[var(--color-text-accent)] text-sm font-medium">{dayOfWeek}</span>
              </div>
            )}
            {/* Date badge (for one-time events) */}
            {!dayOfWeek && dateLabel && (
              <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 backdrop-blur rounded-full">
                <span className="text-[var(--color-text-accent)] text-sm font-medium">{dateLabel}</span>
              </div>
            )}
            {/* Status badge */}
            {showStatusBadge && statusStyle && (
              <div className={`absolute bottom-3 left-3 px-3 py-1 backdrop-blur rounded-full ${statusStyle.bg} border ${statusStyle.border}`}>
                <span className={`text-sm font-semibold uppercase tracking-wide ${statusStyle.text}`}>{statusStyle.label}</span>
              </div>
            )}
            {/* Ended badge (for past dated events) */}
            {!showStatusBadge && isPastEvent && (
              <div className={`absolute bottom-3 left-3 px-3 py-1 backdrop-blur rounded-full ${STATUS_STYLES.ended.bg} border ${STATUS_STYLES.ended.border}`}>
                <span className={`text-sm font-semibold uppercase tracking-wide ${STATUS_STYLES.ended.text}`}>{STATUS_STYLES.ended.label}</span>
              </div>
            )}
            {/* Favorite button */}
            <button
              onClick={toggleFavorite}
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
              className="absolute top-3 right-3 text-xl leading-none px-2 py-1 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 transition text-[var(--color-text-accent)]"
              disabled={loadingFav}
            >
              {favorited ? "★" : "☆"}
            </button>
          </div>
        )}

        {/* Content Section */}
        <div
          data-testid="happening-card-content"
          className={cn(
            variant === "list" ? "p-3 space-y-1" : "p-5 space-y-3",
            variant === "list" ? "text-left" : ""
          )}
        >
          {/* List variant: inline badges + favorite */}
          {variant === "list" && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {showStatusBadge && statusStyle && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                    {statusStyle.label}
                  </span>
                )}
                {!showStatusBadge && isPastEvent && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES.ended.bg} ${STATUS_STYLES.ended.text} border ${STATUS_STYLES.ended.border}`}>
                    {STATUS_STYLES.ended.label}
                  </span>
                )}
                {dateLabel && !dayOfWeek && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-inverse)]/70 font-medium tracking-[0.18em] text-[var(--color-accent-primary)] uppercase text-xs">
                    {dateLabel}
                  </span>
                )}
                {isOnlineOnly && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 text-xs font-medium">
                    Online
                  </span>
                )}
                {isHybrid && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 text-xs font-medium">
                    Hybrid
                  </span>
                )}
              </div>
              <button
                onClick={toggleFavorite}
                aria-label={favorited ? "Remove favorite" : "Add favorite"}
                className="text-lg leading-none px-1.5 py-0.5 rounded-full hover:bg-black/10 transition text-[var(--color-text-accent)]"
                disabled={loadingFav}
              >
                {favorited ? "★" : "☆"}
              </button>
            </div>
          )}

          {/* Title + Category */}
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "font-[var(--font-family-serif)] text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors leading-tight break-words",
                variant === "list" ? "text-base" : "text-lg"
              )}
              dangerouslySetInnerHTML={{ __html: searchQuery ? highlight(event.title, searchQuery) : event.title }}
            />
            {event.category && (
              <span
                className={cn(
                  "shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-sm font-semibold uppercase tracking-wide",
                  CATEGORY_COLORS[event.category] ?? "bg-slate-900/60 text-slate-200 border-slate-500/40"
                )}
              >
                {event.category}
              </span>
            )}
          </div>

          {/* Venue - only if exists */}
          {venueName && !isOnlineOnly && (
            <div className="text-base text-[var(--color-text-secondary)] flex items-center gap-2">
              <span>📍</span>
              <span
                className="break-words"
                dangerouslySetInnerHTML={{ __html: searchQuery ? highlight(venueName, searchQuery) : venueName }}
              />
            </div>
          )}

          {/* Online indicator for online-only */}
          {isOnlineOnly && event.online_url && (
            <div className="text-base text-[var(--color-text-secondary)] flex items-center gap-2">
              <span>🌐</span>
              <span>Online Event</span>
            </div>
          )}

          {/* Location (City, State) - only if exists */}
          {locationDisplay && !isOnlineOnly && (
            <div className="text-base text-[var(--color-text-secondary)]">
              {locationDisplay}
            </div>
          )}

          {/* Time */}
          {startTime && (
            <div className="text-base text-[var(--color-text-accent)]">
              {startTime}
              {endTime && endTime !== "TBD" ? ` — ${endTime}` : ""}
              {/* Hide recurrence text in list variant */}
              {variant === "grid" && recurrenceText && recurrenceText !== "Every week" && (
                <span className="text-[var(--color-text-secondary)] ml-2">• {recurrenceText}</span>
              )}
            </div>
          )}

          {/* Cost - only if explicitly set (Phase 3.1: NULL = show nothing) */}
          {event.is_free === true && (
            <div className="text-sm text-emerald-400 font-medium">Free</div>
          )}
          {event.is_free === false && event.cost_label && (
            <div className="text-sm text-[var(--color-text-secondary)]">{event.cost_label}</div>
          )}

          {/* Signup mode - only if exists */}
          {event.signup_mode && event.signup_mode !== "walk_in" && (
            <div className="text-sm text-[var(--color-text-secondary)]">
              {event.signup_mode === "online" && "Online signup"}
              {event.signup_mode === "in_person" && event.signup_time && `Sign up at ${event.signup_time}`}
              {event.signup_mode === "both" && "Online or in-person signup"}
            </div>
          )}

          {/* Phase 4.1: Missing details chip - invite community to help complete listing */}
          {/* Use Static version since we're inside a Link wrapper */}
          <MissingDetailsChipStatic event={event} compact={variant === "list"} />

          {/* Footer: View Details + Map */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
            <span className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-base font-medium transition-colors">
              View Details →
            </span>
            {mapUrl && !isOnlineOnly && (
              <button
                type="button"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-base font-medium transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(mapUrl, "_blank", "noopener,noreferrer");
                }}
              >
                Map
              </button>
            )}
          </div>
        </div>
      </article>
    </CardWrapper>
  );
}

export default HappeningCard;
