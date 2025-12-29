"use client";

/**
 * HappeningCard - Phase 4.3 Visual Redesign
 *
 * Live music calendar style - NOT a SaaS dashboard.
 * 3-line maximum, 2-line minimum layout.
 *
 * LINE 1: Date (dominant) + Title + Details →
 * LINE 2: Time · Signup · Venue/Online · Cost · Age · ☆
 * LINE 3: Event Type · DSC Presents · Availability
 */

import * as React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import { hasMissingDetails } from "@/lib/events/missingDetails";

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
  /** Display variant: "grid" for card layout, "list" for compact row layout */
  variant?: "grid" | "list";
  /** Optional click handler (if provided, renders as button instead of link) */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================
// Date Helpers
// ============================================================

function getDateInfo(event: HappeningEvent): {
  label: string;
  isTonight: boolean;
  isTomorrow: boolean;
  isPast: boolean;
} {
  if (!event.event_date) {
    // Recurring event - use day_of_week
    const day = event.day_of_week?.trim();
    if (day) {
      // Check if today is that day
      const today = new Date();
      const todayDay = today.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Denver" });
      if (todayDay.toUpperCase() === day.toUpperCase()) {
        return { label: "TONIGHT", isTonight: true, isTomorrow: false, isPast: false };
      }
      // Check if tomorrow is that day
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDay = tomorrow.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Denver" });
      if (tomorrowDay.toUpperCase() === day.toUpperCase()) {
        return { label: "TOMORROW", isTonight: false, isTomorrow: true, isPast: false };
      }
      // Future recurring - show abbreviated day
      return { label: day.substring(0, 3).toUpperCase(), isTonight: false, isTomorrow: false, isPast: false };
    }
    return { label: "", isTonight: false, isTomorrow: false, isPast: false };
  }

  const eventDate = new Date(event.event_date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const eventDateOnly = new Date(eventDate);
  eventDateOnly.setHours(0, 0, 0, 0);

  if (eventDateOnly.getTime() === today.getTime()) {
    return { label: "TONIGHT", isTonight: true, isTomorrow: false, isPast: false };
  }
  if (eventDateOnly.getTime() === tomorrow.getTime()) {
    return { label: "TOMORROW", isTonight: false, isTomorrow: true, isPast: false };
  }
  if (eventDateOnly < today) {
    // Past event
    const formatted = eventDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    }).toUpperCase();
    return { label: formatted, isTonight: false, isTomorrow: false, isPast: true };
  }

  // Future event
  const formatted = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  }).toUpperCase();
  return { label: formatted, isTonight: false, isTomorrow: false, isPast: false };
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
// Component
// ============================================================

export function HappeningCard({
  event,
  searchQuery: _searchQuery, // Reserved for future search highlighting
  variant: _variant = "list", // Reserved for potential future grid view
  onClick,
  className,
}: HappeningCardProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Derived values
  const dateInfo = getDateInfo(event);
  const venueName = getVenueName(event);
  const detailHref = getDetailHref(event);
  const startTime = formatTimeToAMPM(event.start_time ?? null);
  const signupTime = event.signup_time ? formatTimeToAMPM(event.signup_time) : null;

  const isOnlineOnly = event.location_mode === "online";
  const isHybrid = event.location_mode === "hybrid";

  const showScheduleTBD = event.status === "needs_verification" || event.status === "unverified";
  const showEnded = !showScheduleTBD && dateInfo.isPast;

  // Cost display
  const getCostDisplay = (): string => {
    if (event.is_free === true) return "Free";
    if (event.is_free === false && event.cost_label) return event.cost_label;
    return "—"; // Unknown cost
  };

  // Signup display
  const getSignupDisplay = (): string => {
    if (signupTime) return `Sign-up: ${signupTime}`;
    if (event.signup_mode === "online") return "Online signup";
    if (event.signup_mode === "walk_in") return "Walk-in";
    return "Sign-up: NA";
  };

  // Location display for Line 2
  const getLocationDisplay = (): string => {
    if (isOnlineOnly) return "Online";
    if (isHybrid && venueName) return `${venueName} + Online`;
    if (venueName) return venueName;
    return "—";
  };

  // Age policy display (only if known)
  const getAgeDisplay = (): string | null => {
    if (event.age_policy) return event.age_policy;
    // DSC events default to 18+ if not specified
    if (event.is_dsc_event && !event.age_policy) return "18+";
    return null;
  };

  // Availability display
  const getAvailabilityDisplay = (): string | null => {
    // Timeslot-based events
    if (event.has_timeslots && event.total_slots) {
      // Would need to query actual claimed slots - for now just show total
      return `${event.total_slots} slots`;
    }
    // RSVP-based events with capacity
    if (event.capacity && event.rsvp_count !== undefined) {
      const remaining = event.capacity - (event.rsvp_count || 0);
      if (remaining > 0) return `${remaining} spots available`;
      return "Full";
    }
    return null;
  };

  // Event type label
  const eventTypeLabel = EVENT_TYPE_LABELS[event.event_type || "other"] || "Event";

  // Missing details check
  const hasMissing = hasMissingDetails(event);

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
    ? { onClick: handleClick, role: "button", tabIndex: 0, className: "block focus-visible:outline-none" }
    : { href: detailHref, className: "block focus-visible:outline-none" };

  // Border color based on temporal state
  const getBorderColor = () => {
    if (dateInfo.isTonight || dateInfo.isTomorrow) return "border-l-amber-400";
    if (dateInfo.isPast) return "border-l-stone-400/50";
    return "border-l-stone-300";
  };

  // Date text color
  const getDateColor = () => {
    if (dateInfo.isTonight || dateInfo.isTomorrow) return "text-amber-500";
    if (dateInfo.isPast) return "text-stone-400";
    return "text-stone-700 dark:text-stone-300";
  };

  // Separator dot
  const Dot = () => <span className="text-stone-400 dark:text-stone-500 mx-1.5">·</span>;

  // Age display value
  const ageDisplay = getAgeDisplay();
  const availabilityDisplay = getAvailabilityDisplay();

  return (
    <CardWrapper {...(wrapperProps as any)}>
      <article
        className={cn(
          // Base container - left border accent, rounded right corners
          "border-l-[3px] rounded-r-lg",
          getBorderColor(),
          // Padding and spacing
          "py-2.5 px-3 pr-4",
          // Hover state
          "transition-all duration-150",
          "hover:bg-amber-50/50 dark:hover:bg-stone-800/50",
          "hover:border-l-amber-400",
          "hover:translate-x-0.5",
          // Past events are muted
          dateInfo.isPast && "opacity-70",
          className
        )}
        role="article"
        data-testid="happening-card"
      >
        {/* LINE 1: Date + Title + Details → */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Date - bold, uppercase, dominant */}
            {dateInfo.label && (
              <span
                className={cn(
                  "font-bold text-sm uppercase tracking-wide whitespace-nowrap",
                  "min-w-[5rem]",
                  getDateColor()
                )}
              >
                {dateInfo.label}
              </span>
            )}
            {/* Title */}
            <h3
              className={cn(
                "font-semibold text-stone-800 dark:text-stone-100 truncate",
                "text-[0.95rem] leading-tight"
              )}
            >
              {event.title}
            </h3>
          </div>
          {/* Right side: Status badge OR Details arrow */}
          {showScheduleTBD ? (
            <span className="text-amber-600 dark:text-amber-400 text-sm whitespace-nowrap">
              Schedule TBD
            </span>
          ) : showEnded ? (
            <span className="text-stone-400 text-sm whitespace-nowrap">
              Ended
            </span>
          ) : (
            <span className="text-stone-400 dark:text-stone-500 text-sm whitespace-nowrap group-hover:underline">
              Details →
            </span>
          )}
        </div>

        {/* LINE 2: Time · Signup · Venue/Online · Cost · Age · ☆ */}
        <div className="flex items-center text-[0.85rem] text-stone-500 dark:text-stone-400 mt-1 flex-wrap gap-y-0.5">
          {/* Time */}
          <span>{startTime || "TBD"}</span>
          <Dot />
          {/* Signup */}
          <span>{getSignupDisplay()}</span>
          <Dot />
          {/* Venue/Online */}
          <span className="truncate max-w-[12rem]">{getLocationDisplay()}</span>
          <Dot />
          {/* Cost */}
          <span>{getCostDisplay()}</span>
          {/* Age (only if known) */}
          {ageDisplay && (
            <>
              <Dot />
              <span>{ageDisplay}</span>
            </>
          )}
          {/* Favorite star - always shown */}
          <button
            onClick={toggleFavorite}
            aria-label={favorited ? "Remove favorite" : "Add favorite"}
            className={cn(
              "ml-2 text-lg leading-none transition-colors",
              favorited
                ? "text-amber-500"
                : "text-stone-300 dark:text-stone-600 hover:text-amber-400"
            )}
            disabled={loadingFav}
          >
            {favorited ? "★" : "☆"}
          </button>
        </div>

        {/* LINE 3: Event Type · DSC Presents · Availability · Missing details */}
        <div className="flex items-center text-[0.8rem] text-stone-400 dark:text-stone-500 mt-1 flex-wrap gap-y-0.5">
          {/* Event Type - italic */}
          <span className="italic">{eventTypeLabel}</span>
          {/* DSC Presents */}
          {event.is_dsc_event && (
            <>
              <Dot />
              <span className="italic text-amber-600/70 dark:text-amber-500/70">DSC Presents</span>
            </>
          )}
          {/* Availability (only if known) */}
          {availabilityDisplay && (
            <>
              <Dot />
              <span>{availabilityDisplay}</span>
            </>
          )}
          {/* Missing details link */}
          {hasMissing && (
            <>
              <Dot />
              <span className="text-stone-400 dark:text-stone-500 underline decoration-dotted">
                Missing details
              </span>
            </>
          )}
        </div>
      </article>
    </CardWrapper>
  );
}

export default HappeningCard;
