"use client";

import * as React from "react";
import { HappeningCard } from "@/components/happenings/HappeningCard";
import type { HappeningEvent } from "@/components/happenings/HappeningCard";
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
      <div className="text-center text-[var(--color-text-secondary)] py-8">
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
        : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      }>
        {events.map((event) => (
          <HappeningCard
            key={event.id}
            event={event as unknown as HappeningEvent}
            onClick={onSelect ? () => onSelect(event) : undefined}
            variant="grid"
          />
        ))}
      </div>
    </div>
  );
}
