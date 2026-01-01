"use client";

/**
 * HappeningsCard - Wrapper for the unified HappeningCard component
 *
 * This is a thin wrapper that always passes variant="list" for compact
 * happenings page display. All event types use the same unified card.
 */

import type { Event } from "@/types";
import { HappeningCard } from "./HappeningCard";
import type { HappeningEvent } from "./HappeningCard";
import type { NextOccurrenceResult } from "@/lib/events/nextOccurrence";

type Props = {
  event: Event;
  searchQuery?: string;
  debugDates?: boolean;
  /** Pre-computed occurrence from parent for consistent date handling */
  occurrence?: NextOccurrenceResult;
  /** Canonical today key for consistent date comparisons */
  todayKey?: string;
};

export function HappeningsCard({ event, searchQuery, debugDates, occurrence, todayKey }: Props) {
  return (
    <HappeningCard
      event={event as unknown as HappeningEvent}
      searchQuery={searchQuery}
      variant="list"
      debugDates={debugDates}
      occurrence={occurrence}
      todayKey={todayKey}
    />
  );
}
