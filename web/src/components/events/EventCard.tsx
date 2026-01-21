"use client";

/**
 * @deprecated This component is deprecated. Use HappeningCard from @/components/happenings/HappeningCard instead.
 * Kept for backward compatibility during migration. Will be removed in a future version.
 */

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";
import { ImagePlaceholder } from "@/components/ui";
import { VenueLink } from "@/components/venue/VenueLink";

const CATEGORY_COLORS: Record<string, string> = {
  "comedy": "bg-pink-900/40 text-pink-300",
  "poetry": "bg-purple-900/40 text-purple-300",
  "all-acts": "bg-yellow-900/40 text-yellow-300",
};

interface EventCardProps {
  event: Event;
  onClick?: () => void;
  className?: string;
  /** Compact mode: smaller card with reduced padding and text */
  compact?: boolean;
  /** Display variant: "grid" for card layout, "list" for compact row layout */
  variant?: "grid" | "list";
}

function getDateInitials(date: string | null | undefined): string {
  if (!date) return "LIVE";
  const d = new Date(date + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return "LIVE";
  // Use explicit timezone to prevent server/client hydration mismatch
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  }).toUpperCase();
}

// Format time from HH:MM:SS (24h) to h:MM AM/PM
function formatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;
  const hour = parseInt(match[1], 10);
  const minute = match[2];
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${hour12}:${minute} ${ampm}`;
}

export function EventCard({ event, onClick, className, compact = false, variant = "grid" }: EventCardProps) {
  const dateLabel = getDateInitials(event.event_date);
  const startTimeFormatted = formatTime(event.start_time);
  const endTimeFormatted = formatTime(event.end_time);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const CardWrapper = onClick ? "div" : Link;
  // Prefer slug for SEO-friendly URLs, fallback to id for backward compatibility
  const eventHref = `/events/${event.slug || event.id}`;
  const wrapperProps = onClick
    ? { onClick: handleClick, role: "button", tabIndex: 0, className: "block h-full group cursor-pointer focus-visible:outline-none" }
    : { href: eventHref, className: "block h-full group focus-visible:outline-none" };

  // Ensure venue renders as a simple string (name) for UI components
  const venueDisplay: string = typeof event.venue === "object" && event.venue && "name" in event.venue
    ? (event.venue as any).name ?? ""
    : (typeof event.venue === "string" ? event.venue : "") ?? "";

  // Phase 4.52: Extract venue URLs for VenueLink component
  const venueForLink = typeof event.venue === "object" && event.venue
    ? {
        google_maps_url: (event.venue as any).google_maps_url ?? null,
        website_url: (event.venue as any).website_url ?? (event.venue as any).website ?? null,
      }
    : null;

  // Get location display (address or location field)
  const locationDisplay = event.location || event.venue_address ||
    (typeof event.venue === "object" && event.venue && "address" in event.venue
      ? (event.venue as any).address
      : null);

  // Calculate remaining capacity
  const spotsRemaining = event.capacity != null && event.rsvp_count != null
    ? Math.max(0, event.capacity - event.rsvp_count)
    : null;

  return (
    <CardWrapper
      {...(wrapperProps as any)}
    >
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "transition-shadow transition-colors duration-200 ease-out",
          "hover:shadow-md hover:border-[var(--color-accent-primary)]/30",
          "group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)]",
          className
        )}
      >
        {/* Image Section - hidden in list variant for compact display */}
        {variant === "grid" && (
          <div className={cn("relative overflow-hidden", "aspect-[4/3]")}>
            {event.imageUrl ? (
              <Image
                src={event.imageUrl}
                alt={event.title}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover object-top"
              />
            ) : (
              <ImagePlaceholder
                initials={dateLabel}
                className={cn("w-full h-full", compact ? "text-xl" : "text-3xl")}
              />
            )}

            {/* Date badge */}
            <div className={cn(
              "absolute rounded-full bg-[var(--color-bg-inverse)]/70 font-medium tracking-[0.18em] text-[var(--color-accent-primary)] uppercase backdrop-blur-sm",
              compact ? "left-2 top-2 px-2 py-0.5 text-sm" : "left-4 top-4 px-3 py-1 text-sm"
            )}>
              {dateLabel}
            </div>
          </div>
        )}

        {/* Content Section */}
        <div
          data-testid="dsc-event-card"
          className={cn(
            variant === "list" ? "p-3 space-y-1" : (compact ? "p-3 space-y-1.5" : "p-5 space-y-3"),
            variant === "list" ? "text-left" : "text-center"
          )}
        >
          {/* List variant: inline date badge */}
          {variant === "list" && (
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-inverse)]/70 font-medium tracking-[0.18em] text-[var(--color-accent-primary)] uppercase text-xs">
                {dateLabel}
              </span>
            </div>
          )}
          <h3
            className={cn(
              "font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight line-clamp-2",
              compact ? "text-base" : "text-lg md:text-xl"
            )}
          >
            {event.title}
          </h3>

          {event.category && (
            <span
              className={cn(
                "inline-block px-2 py-0.5 rounded tracking-wide",
                compact ? "text-sm" : "text-sm",
                CATEGORY_COLORS[event.category] || ""
              )}
            >
              {event.category}
            </span>
          )}

          {/* Time display - formatted AM/PM */}
          {(startTimeFormatted || event.time) && (
            <div className={cn(
              "text-[var(--color-text-secondary)]",
              compact ? "text-base" : "text-base"
            )}>
              {startTimeFormatted ? (
                <>
                  {startTimeFormatted}
                  {endTimeFormatted && ` - ${endTimeFormatted}`}
                </>
              ) : (
                event.time
              )}
            </div>
          )}

          {/* Venue name */}
          {venueDisplay && (
            <div className={cn(
              "text-[var(--color-text-primary)] font-medium line-clamp-1",
              compact ? "text-base" : "text-lg"
            )}>
              <VenueLink name={venueDisplay} venue={venueForLink} />
            </div>
          )}

          {/* Location/Address */}
          {locationDisplay && (
            <div className={cn(
              "text-[var(--color-text-secondary)] line-clamp-1",
              compact ? "text-base" : "text-base"
            )}>
              {locationDisplay}
            </div>
          )}

          {/* Capacity / Spots remaining - only for DSC events with capacity */}
          {event.is_dsc_event && event.capacity != null && (
            <div className={cn(
              "flex items-center justify-center gap-1.5",
              compact ? "text-sm" : "text-sm"
            )}>
              {spotsRemaining === 0 ? (
                <span className="px-2 py-0.5 rounded tracking-wide bg-amber-500/20 text-amber-400 font-medium">
                  Full
                </span>
              ) : spotsRemaining != null ? (
                <span className="px-2 py-0.5 rounded tracking-wide bg-emerald-500/20 text-emerald-400">
                  {spotsRemaining} {spotsRemaining === 1 ? "spot" : "spots"} left
                </span>
              ) : (
                <span className="text-[var(--color-text-secondary)]">
                  {event.rsvp_count || 0} going
                </span>
              )}
            </div>
          )}

          {!compact && event.description && (
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 text-left mx-auto max-w-prose">
              {event.description}
            </p>
          )}
        </div>
      </article>
    </CardWrapper>
  );
}
