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

export function EventCard({ event, onClick, className, compact = false }: EventCardProps) {
  const dateLabel = getDateInitials(event.date);

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
        {/* Image Section */}
        <div className={cn("relative overflow-hidden", compact ? "aspect-[3/2]" : "aspect-[4/3]")}>
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <ImagePlaceholder
              initials={dateLabel}
              className={cn("w-full h-full", compact ? "text-xl" : "text-3xl")}
            />
          )}

          {/* Gradient overlay - for text readability over images */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--color-bg-primary)]/75 via-[var(--color-bg-primary)]/20 to-transparent" />

          {/* Date badge */}
          <div className={cn(
            "absolute rounded-full bg-[var(--color-bg-inverse)]/70 font-medium tracking-[0.18em] text-[var(--color-accent-primary)] uppercase backdrop-blur-sm",
            compact ? "left-2 top-2 px-2 py-0.5 text-[10px]" : "left-4 top-4 px-3 py-1 text-xs"
          )}>
            {dateLabel}
          </div>
        </div>

        {/* Content Section */}
        <div className={cn(compact ? "p-3 space-y-1.5" : "p-5 space-y-3")}>
          <h3
            className={cn(
              "font-[var(--font-family-serif)] text-[var(--color-text-primary)] tracking-tight line-clamp-2",
              compact ? "text-sm" : "text-[length:var(--font-size-heading-sm)]"
            )}
          >
            {event.title}
          </h3>

          {event.category && (
            <span
              className={cn(
                "px-2 py-0.5 rounded",
                compact ? "text-[10px]" : "text-xs",
                CATEGORY_COLORS[event.category] || ""
              )}
            >
              {event.category}
            </span>
          )}

          <div className={cn(
            "uppercase tracking-[0.18em] text-[var(--color-text-secondary)]",
            compact ? "text-[10px]" : "text-xs"
          )}>
            {event.time}
          </div>

          <div className={cn(
            "text-[var(--color-text-secondary)] line-clamp-1",
            compact ? "text-xs" : "text-[length:var(--font-size-body-sm)]"
          )}>
            {venueDisplay}
          </div>

          {!compact && event.description && (
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-text-secondary)] line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </article>
    </CardWrapper>
  );
}
