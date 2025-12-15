"use client";

import * as React from "react";
import { EventCard } from "./EventCard";
import type { Event } from "@/types";

interface EventGridProps {
  events: Event[];
  onSelect?: (event: Event) => void;
  className?: string;
}

export function EventGrid({ events, onSelect, className }: EventGridProps) {
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
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onClick={() => onSelect?.(event)}
          />
        ))}
      </div>
    </div>
  );
}
