"use client";

import * as React from "react";
import { EventCard } from "./EventCard";
import type { Event } from "@/types";

interface EventGridProps {
  events: Event[];
  onSelect?: (event: Event) => void;
  className?: string;
  /** Compact mode: smaller cards, more columns */
  compact?: boolean;
}

export function EventGrid({ events, onSelect, className, compact = false }: EventGridProps) {
  if (!events.length) {
    return (
      <div className="text-center text-[var(--color-text-secondary)] py-16">
        No upcoming events.
      </div>
    );
  }

  return (
    <div
      className={className}
      role="list"
      aria-label="Event list"
    >
      <div className={compact
        ? "grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        : "grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
      }>
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onClick={onSelect ? () => onSelect(event) : undefined}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
