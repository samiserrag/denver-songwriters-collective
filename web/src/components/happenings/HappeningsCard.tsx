"use client";

/**
 * HappeningsCard - Wrapper for the unified HappeningCard component
 *
 * This is a thin wrapper that always passes variant="list" for compact
 * happenings page display. All event types use the same unified card.
 *
 * Phase 4.21: Added override and isCancelled props for occurrence overrides.
 */

import type { Event } from "@/types";
import { HappeningCard } from "./HappeningCard";
import type { HappeningEvent } from "./HappeningCard";
import type { NextOccurrenceResult, OccurrenceOverride } from "@/lib/events/nextOccurrence";

type Props = {
  event: Event;
  searchQuery?: string;
  debugDates?: boolean;
  /** Pre-computed occurrence from parent for consistent date handling */
  occurrence?: NextOccurrenceResult;
  /** Canonical today key for consistent date comparisons */
  todayKey?: string;
  /** Phase 4.21: Per-occurrence override (cancellation, time change, notes, flyer) */
  override?: OccurrenceOverride;
  /** Phase 4.21: Whether this occurrence is cancelled */
  isCancelled?: boolean;
  /** Phase 4.81: Pre-resolved venue data for override venue_id */
  overrideVenueData?: {
    name: string;
    slug?: string | null;
    google_maps_url?: string | null;
    website_url?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
};

export function HappeningsCard({
  event,
  searchQuery,
  debugDates,
  occurrence,
  todayKey,
  override,
  isCancelled,
  overrideVenueData,
}: Props) {
  return (
    <HappeningCard
      event={event as unknown as HappeningEvent}
      searchQuery={searchQuery}
      variant="list"
      debugDates={debugDates}
      occurrence={occurrence}
      todayKey={todayKey}
      override={override}
      isCancelled={isCancelled}
      overrideVenueData={overrideVenueData}
    />
  );
}
