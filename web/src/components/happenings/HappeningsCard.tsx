"use client";

/**
 * HappeningsCard - Delegating wrapper for event cards
 *
 * Renders the appropriate existing card based on event type.
 * Does NOT merge card logic - delegates to existing components.
 */

import type { Event } from "@/types";
import RootEventCard from "@/components/EventCard";
import { EventCard as DscEventCard } from "@/components/events/EventCard";

type Props = {
  event: Event;
  searchQuery?: string;
};

export function HappeningsCard({ event, searchQuery }: Props) {
  if (event.event_type === "open_mic") {
    return <RootEventCard event={event as any} searchQuery={searchQuery} />;
  }

  return <DscEventCard event={event as any} />;
}
