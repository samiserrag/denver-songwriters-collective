"use client";

/**
 * SeriesCard - Phase 4.54 Series View Card
 *
 * Displays a recurring event as a single series row with:
 * - Event image, title, venue, recurrence badge, DSC badge
 * - "Next: [date] @ [time]" with chevron for expand
 * - Row click navigates to event detail (base URL)
 * - Chevron toggles expandable list of upcoming dates (capped at 12)
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ [Image]  Title                          [Every Monday] [DSC]│
 * │          Venue Name                                         │
 * │          Next: Mon, Jan 13 @ 7pm        ▼ 12 more dates    │
 * └─────────────────────────────────────────────────────────────┘
 */

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import { getPublicVerificationState } from "@/lib/events/verification";
import { VenueLink } from "@/components/venue/VenueLink";
import {
  type SeriesEntry,
  type EventForOccurrence,
  type ExpandedOccurrence,
} from "@/lib/events/nextOccurrence";

// ============================================================
// Types
// ============================================================

export interface SeriesEvent extends EventForOccurrence {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;
  event_type?: string;
  is_dsc_event?: boolean | null;
  venue_id?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  location_mode?: "venue" | "online" | "hybrid" | null;
  custom_location_name?: string | null;
  cover_image_url?: string | null;
  cover_image_card_url?: string | null;
  status?: string | null;
  last_verified_at?: string | null;
  verified_by?: string | null;
  source?: string | null;
  host_id?: string | null;
  venue?: {
    id?: string;
    name?: string | null;
    address?: string | null;
    google_maps_url?: string | null;
    website_url?: string | null;
  } | null;
}

export interface SeriesCardProps {
  /** Series entry from groupEventsAsSeriesView */
  series: SeriesEntry<SeriesEvent>;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================
// Helpers
// ============================================================

function getVenueName(event: SeriesEvent): string | null {
  if (event.venue_name) return event.venue_name;
  if (event.venue && typeof event.venue === "object" && event.venue.name) {
    return event.venue.name;
  }
  if (event.custom_location_name) return event.custom_location_name;
  return null;
}

function getVenueForLink(event: SeriesEvent): {
  google_maps_url?: string | null;
  website_url?: string | null;
} | null {
  if (event.venue && typeof event.venue === "object") {
    return {
      google_maps_url: event.venue.google_maps_url,
      website_url: event.venue.website_url,
    };
  }
  return null;
}

function getDetailHref(event: SeriesEvent): string {
  // Prefer slug for SEO-friendly URLs, fallback to id
  const identifier = event.slug || event.id;
  if (event.event_type === "open_mic") {
    return `/open-mics/${identifier}`;
  }
  return `/events/${identifier}`;
}

/**
 * Format date for series card display
 * e.g., "Mon, Jan 13"
 */
function formatDateShort(dateKey: string): string {
  const displayDate = new Date(`${dateKey}T12:00:00Z`);
  return displayDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

// ============================================================
// Default Images (same as HappeningCard)
// ============================================================

const DEFAULT_EVENT_IMAGES: Record<string, string> = {
  open_mic: "/images/event-defaults/open-mic.svg",
  showcase: "/images/event-defaults/showcase.svg",
  song_circle: "/images/event-defaults/song-circle.svg",
  workshop: "/images/event-defaults/workshop.svg",
  gig: "/images/event-defaults/gig.svg",
  kindred_group: "/images/event-defaults/song-circle.svg", // Uses song circle icon (similar community vibe)
  other: "/images/event-defaults/event.svg",
};

function getDefaultImageForType(eventType: string | undefined): string | null {
  if (!eventType) return null;
  return DEFAULT_EVENT_IMAGES[eventType] || DEFAULT_EVENT_IMAGES["other"] || null;
}

// ============================================================
// Chip Component (same style as HappeningCard)
// ============================================================

const Chip = ({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "accent" | "muted" | "recurrence" | "warning" | "success" | "danger";
}) => (
  <span
    className={cn(
      "inline-flex items-center px-2 py-0.5 text-sm font-medium rounded-full border whitespace-nowrap",
      variant === "accent" &&
        "bg-[var(--pill-bg-accent)] text-[var(--pill-fg-on-accent)] border-[var(--color-border-accent)]",
      variant === "recurrence" &&
        "bg-[var(--color-bg-secondary)] text-[var(--pill-fg-on-muted)] border-[var(--color-border-default)]",
      variant === "default" &&
        "bg-[var(--color-accent-muted)] text-[var(--pill-fg-on-neutral)] border-[var(--color-border-default)]",
      variant === "muted" &&
        "bg-[var(--color-bg-tertiary)] text-[var(--pill-fg-on-neutral)] border-[var(--color-border-subtle)]",
      variant === "warning" &&
        "bg-[var(--pill-bg-warning)] text-[var(--pill-fg-warning)] border-[var(--pill-border-warning)]",
      variant === "success" &&
        "bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)] border-[var(--pill-border-success)]",
      variant === "danger" && "bg-red-500/20 text-red-400 border-red-500/30"
    )}
  >
    {children}
  </span>
);

// ============================================================
// Upcoming Dates List Component
// ============================================================

function UpcomingDatesList({
  occurrences,
  startTime,
}: {
  occurrences: ExpandedOccurrence[];
  startTime: string | null;
}) {
  const timeDisplay = formatTimeToAMPM(startTime);

  return (
    <div className="mt-2 pl-4 border-l-2 border-[var(--color-border-default)] space-y-1">
      {occurrences.map((occ) => (
        <div
          key={occ.dateKey}
          className="text-sm text-[var(--color-text-secondary)]"
        >
          <span className="mr-1">•</span>
          {formatDateShort(occ.dateKey)} @ {timeDisplay}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Component
// ============================================================

export function SeriesCard({ series, className }: SeriesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { event, nextOccurrence, upcomingOccurrences, recurrenceSummary, isOneTime, totalUpcomingCount } = series;

  const venueName = getVenueName(event);
  const venueForLink = getVenueForLink(event);
  const detailHref = getDetailHref(event);
  const startTime = formatTimeToAMPM(event.start_time ?? null);
  const isOnlineOnly = event.location_mode === "online";
  const isCustomLocation = !event.venue_id && !!event.custom_location_name;

  // Verification state
  const verificationResult = getPublicVerificationState({
    status: event.status,
    host_id: event.host_id,
    source: event.source,
    last_verified_at: event.last_verified_at,
    verified_by: event.verified_by,
  });
  const verificationState = verificationResult.state;

  // Image logic (same tiers as HappeningCard)
  const cardImageUrl = event.cover_image_card_url;
  const fullPosterUrl = event.cover_image_url;
  const defaultImageUrl = getDefaultImageForType(event.event_type);
  const imageUrl = cardImageUrl || fullPosterUrl || defaultImageUrl;

  // Format next occurrence date
  const nextDateDisplay = nextOccurrence.isConfident
    ? formatDateShort(nextOccurrence.date)
    : "Schedule TBD";

  // Calculate how many more dates to show
  // Skip first occurrence since it's shown as "Next:"
  const expandableOccurrences = upcomingOccurrences.slice(1);
  const hasMoreDates = expandableOccurrences.length > 0;
  const moreCount = totalUpcomingCount - 1; // Subtract the "Next:" date

  // Handle chevron click (stop propagation to prevent navigation)
  const handleChevronClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <article
      className={cn(
        "card-spotlight transition-all duration-200 ease-out",
        "hover:shadow-md hover:border-[var(--color-accent-primary)]/30",
        className
      )}
      data-testid="series-card"
    >
      <Link href={detailHref} className="block">
        <div className="flex gap-3 p-3">
          {/* Thumbnail */}
          <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt=""
                fill
                sizes="80px"
                className="object-cover object-top"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-bg-secondary)] via-[var(--color-accent-muted)] to-[var(--color-bg-tertiary)] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--color-text-tertiary)] opacity-20"
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
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row with badges */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-[var(--color-text-primary)] text-base leading-tight line-clamp-1">
                {event.title}
              </h3>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Chip variant="recurrence">
                  {isOneTime ? "One-time" : recurrenceSummary}
                </Chip>
                {event.is_dsc_event && <Chip variant="accent">DSC</Chip>}
              </div>
            </div>

            {/* Venue */}
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 truncate">
              {isOnlineOnly ? (
                "Online"
              ) : venueName ? (
                <VenueLink
                  name={venueName}
                  venue={isCustomLocation ? null : venueForLink}
                />
              ) : (
                "Location TBD"
              )}
            </p>

            {/* Next date row with expand toggle */}
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-[var(--color-text-primary)]">
                {isOneTime ? (
                  <>
                    {nextDateDisplay} @ {startTime}
                  </>
                ) : (
                  <>
                    <span className="text-[var(--color-text-secondary)]">Next:</span>{" "}
                    {nextDateDisplay} @ {startTime}
                  </>
                )}
              </p>

              {/* Expand toggle - only show for recurring with more dates */}
              {!isOneTime && hasMoreDates && (
                <button
                  onClick={handleChevronClick}
                  className={cn(
                    "flex items-center gap-1 text-sm text-[var(--color-text-tertiary)]",
                    "hover:text-[var(--color-text-primary)] transition-colors"
                  )}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? "Hide dates" : `Show ${moreCount} more dates`}
                >
                  <span className="hidden sm:inline">
                    {isExpanded ? "Hide dates" : `${moreCount} more`}
                  </span>
                  <svg
                    className={cn(
                      "w-4 h-4 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Verification status row */}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {verificationState === "confirmed" && (
                <Chip variant="success">
                  <svg
                    className="w-3 h-3 mr-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmed
                </Chip>
              )}
              {verificationState === "unconfirmed" && (
                <Chip variant="warning">Unconfirmed</Chip>
              )}
              {verificationState === "cancelled" && (
                <Chip variant="danger">Cancelled</Chip>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Expandable upcoming dates */}
      {isExpanded && expandableOccurrences.length > 0 && (
        <div className="px-3 pb-3">
          <UpcomingDatesList
            occurrences={expandableOccurrences}
            startTime={event.start_time ?? null}
          />
        </div>
      )}
    </article>
  );
}

export default SeriesCard;
