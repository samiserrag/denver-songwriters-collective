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
import { getPublicVerificationState, shouldShowUnconfirmedBadge } from "@/lib/events/verification";
import {
  type SeriesEntry,
  type EventForOccurrence,
} from "@/lib/events/nextOccurrence";
import { DatePillRow, type DatePillData } from "./DatePillRow";

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
    slug?: string | null;  // Phase ABC4: Add slug for friendly URLs
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

/**
 * Phase 4.58/ABC4: Get venue identifier for internal linking to /venues/[slug|id]
 * Returns slug if available, otherwise ID. Returns null for custom locations and online-only events.
 */
function getVenueIdentifierForLink(event: SeriesEvent): string | null {
  // Prefer venue.slug from joined venue object, then venue.id, finally venue_id
  if (event.venue && typeof event.venue === "object") {
    if (event.venue.slug) return event.venue.slug;
    if (event.venue.id) return event.venue.id;
  }
  if (event.venue_id) {
    return event.venue_id;
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
  jam_session: "/images/event-defaults/gig.svg", // Uses gig icon (music/performance vibe)
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
      variant === "danger" && "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400 border-red-300 dark:border-red-500/30"
    )}
  >
    {children}
  </span>
);


// ============================================================
// Component
// ============================================================

export function SeriesCard({ series, className }: SeriesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { event, nextOccurrence, upcomingOccurrences, recurrenceSummary, isOneTime, totalUpcomingCount } = series;

  const venueName = getVenueName(event);
  const venueIdentifier = getVenueIdentifierForLink(event);
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
  // P0 Fix: Suppress "Unconfirmed" badge for DSC TEST events
  const showUnconfirmedBadge = shouldShowUnconfirmedBadge({
    title: event.title,
    is_dsc_event: event.is_dsc_event,
    status: event.status,
    last_verified_at: event.last_verified_at,
  });

  // Image logic (same tiers as HappeningCard)
  const cardImageUrl = event.cover_image_card_url;
  const fullPosterUrl = event.cover_image_url;
  const defaultImageUrl = getDefaultImageForType(event.event_type);
  const imageUrl = cardImageUrl || fullPosterUrl || defaultImageUrl;

  // Format next occurrence date
  const nextDateDisplay = nextOccurrence.isConfident
    ? formatDateShort(nextOccurrence.date)
    : "Schedule TBD";

  // Build date pill data for DatePillRow
  const eventIdentifier = event.slug || event.id;
  const datePills: DatePillData[] = upcomingOccurrences.map((occ) => ({
    label: formatDateShort(occ.dateKey),
    href: `/events/${eventIdentifier}?date=${occ.dateKey}`,
    dateKey: occ.dateKey,
  }));

  // Handle toggle click
  const handleToggle = () => {
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

            {/* Venue - Phase 4.58/ABC4: Internal link to /venues/[slug|id] when venue exists */}
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 truncate">
              {isOnlineOnly ? (
                "Online"
              ) : venueName ? (
                venueIdentifier && !isCustomLocation ? (
                  // Internal link to venue detail page
                  <Link
                    href={`/venues/${venueIdentifier}`}
                    className="hover:underline text-[var(--color-link)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {venueName}
                  </Link>
                ) : (
                  // Plain text for custom locations (no venue_id)
                  <span>{venueName}</span>
                )
              ) : (
                "Location TBD"
              )}
            </p>

            {/* Date row: one-time events show single date, recurring show pill row */}
            {isOneTime ? (
              <p className="text-sm text-[var(--color-text-primary)] mt-1">
                <Link
                  href={`/events/${eventIdentifier}?date=${nextOccurrence.date}`}
                  className="hover:text-[var(--color-text-accent)] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {nextDateDisplay} @ {startTime}
                </Link>
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-xs text-[var(--color-text-secondary)] mb-1.5">Upcoming dates:</p>
                <DatePillRow
                  dates={datePills}
                  maxVisible={5}
                  totalCount={totalUpcomingCount}
                  isExpanded={isExpanded}
                  onToggle={handleToggle}
                />
              </div>
            )}

            {/* Verification status row */}
            {/* P0 Fix: Use showUnconfirmedBadge to suppress for DSC TEST events */}
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
              {showUnconfirmedBadge && (
                <Chip variant="warning">Unconfirmed</Chip>
              )}
              {verificationState === "cancelled" && (
                <Chip variant="danger">Cancelled</Chip>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

export default SeriesCard;
