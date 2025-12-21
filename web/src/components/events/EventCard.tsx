"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";
import { ImagePlaceholder } from "@/components/ui";

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
}

function getDateInitials(date: string | null | undefined): string {
  if (!date) return "LIVE";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "LIVE";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

export function EventCard({ event, onClick, className, compact = false }: EventCardProps) {
  const dateLabel = getDateInitials(event.date);
  const startTimeFormatted = formatTime(event.start_time);
  const endTimeFormatted = formatTime(event.end_time);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const CardWrapper = onClick ? "div" : Link;
  const wrapperProps = onClick
    ? { onClick: handleClick, role: "button", tabIndex: 0 }
    : { href: `/events/${event.id}` };

  // Ensure venue renders as a simple string (name) for UI components
  const venueDisplay: string = typeof event.venue === "object" && event.venue && "name" in event.venue
    ? (event.venue as any).name ?? ""
    : (typeof event.venue === "string" ? event.venue : "") ?? "";

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
      className={cn("block h-full group", onClick && "cursor-pointer")}
    >
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "hover:-translate-y-1",
          className
        )}
      >
        {/* Image Section - 4:3 for consistent display */}
        <div className={cn("relative overflow-hidden", "aspect-[4/3]")}>
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
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

        {/* Content Section */}
        <div className={cn(compact ? "p-3 space-y-1.5" : "p-5 space-y-3", "text-center")}>
          <h3
            className={cn(
              "font-[var(--font-family-serif)] text-[var(--color-text-primary)] tracking-tight line-clamp-2",
              compact ? "text-base" : "text-[length:var(--font-size-heading-sm)]"
            )}
          >
            {event.title}
          </h3>

          {event.category && (
            <span
              className={cn(
                "inline-block px-2 py-0.5 rounded",
                compact ? "text-sm" : "text-base",
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
              compact ? "text-sm" : "text-base"
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
              {venueDisplay}
            </div>
          )}

          {/* Location/Address */}
          {locationDisplay && (
            <div className={cn(
              "text-[var(--color-text-secondary)] line-clamp-1",
              compact ? "text-sm" : "text-base"
            )}>
              {locationDisplay}
            </div>
          )}

          {/* Capacity / Spots remaining - only for DSC events with capacity */}
          {event.is_dsc_event && event.capacity != null && (
            <div className={cn(
              "flex items-center justify-center gap-1.5",
              compact ? "text-sm" : "text-base"
            )}>
              {spotsRemaining === 0 ? (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                  Full
                </span>
              ) : spotsRemaining != null ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
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
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] line-clamp-2 text-left">
              {event.description}
            </p>
          )}
        </div>
      </article>
    </CardWrapper>
  );
}
