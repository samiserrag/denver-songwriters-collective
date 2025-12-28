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

type Props = {
  event: Event;
  searchQuery?: string;
};

export function HappeningsCard({ event, searchQuery }: Props) {
  return (
    <HappeningCard
      event={event as unknown as HappeningEvent}
      searchQuery={searchQuery}
      variant="list"
    />
  );
}
