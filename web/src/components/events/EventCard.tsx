"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";
import { ImagePlaceholder } from "@/components/ui";

interface EventCardProps {
  event: Event;
  onClick?: () => void;
  className?: string;
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

export function EventCard({ event, onClick, className }: EventCardProps) {
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
          "h-full overflow-hidden rounded-3xl border border-white/10",
          "bg-[radial-gradient(circle_at_top,_rgba(255,216,106,0.12),_rgba(6,15,44,1))]",
          "shadow-[0_0_40px_rgba(0,0,0,0.55)]",
          "transition-all duration-300",
          "hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(255,216,106,0.25)]",
          "hover:border-[var(--color-gold)]/30",
          className
        )}
      >
        {/* Image Section */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <ImagePlaceholder
              initials={dateLabel}
              className="w-full h-full text-3xl"
            />
          )}

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          {/* Date badge */}
          <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-medium tracking-[0.18em] text-[var(--color-gold-400)] uppercase backdrop-blur-sm">
            {dateLabel}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-3">
          <h3
            className="text-[length:var(--font-size-heading-sm)] font-[var(--font-family-serif)] text-[var(--color-warm-white)] tracking-tight line-clamp-2"
          >
            {event.title}
          </h3>

          <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-warm-gray)]">
            {event.date} • {event.time}
          </div>

          <div className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray-light)]">
            {venueDisplay}
            {event.location && ` — ${event.location}`}
          </div>

          {event.description && (
            <p className="text-[length:var(--font-size-body-sm)] text-[var(--color-warm-gray)] line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </article>
    </CardWrapper>
  );
}
