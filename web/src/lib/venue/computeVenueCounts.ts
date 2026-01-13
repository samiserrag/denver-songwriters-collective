/**
 * Compute venue event counts for /venues list page.
 *
 * Uses the SAME logic as venue detail page:
 * - De-duplication by title (keep most complete record)
 * - groupEventsAsSeriesView() for occurrence expansion
 * - 90-day window (matches detail page)
 *
 * This ensures counts on /venues cards match what users see on /venues/[slug].
 */

import {
  getTodayDenver,
  addDaysDenver,
  groupEventsAsSeriesView,
  type EventForOccurrence,
} from "@/lib/events/nextOccurrence";

/** Minimal event fields needed for count computation */
export interface EventForCounts extends EventForOccurrence {
  id: string;
  venue_id: string | null;
  title: string;
}

/** Counts per venue for display */
export interface VenueEventCounts {
  /** Number of recurring series (after de-duplication) */
  seriesCount: number;
  /** Total upcoming occurrences across all recurring series */
  seriesUpcomingTotal: number;
  /** Number of one-time events */
  oneoffCount: number;
}

/**
 * Score event by data completeness for de-duplication.
 * Higher score = more complete = preferred.
 * Must match the scoring in venues/[id]/page.tsx
 */
function scoreEventCompleteness(event: EventForCounts): number {
  return (event.recurrence_rule ? 2 : 0) + (event.start_time ? 1 : 0);
}

/**
 * De-duplicate events by title within a venue.
 * Keeps the event with the most complete data.
 * Must match the logic in venues/[id]/page.tsx
 */
function deduplicateEventsByTitle<T extends EventForCounts>(events: T[]): T[] {
  return Array.from(
    events.reduce((map, event) => {
      const key = event.title.toLowerCase().trim();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, event);
      } else if (scoreEventCompleteness(event) > scoreEventCompleteness(existing)) {
        map.set(key, event);
      }
      return map;
    }, new Map<string, T>()).values()
  );
}

/**
 * Compute series/oneoff counts for all venues from a list of events.
 *
 * Performance: O(1) query assumed (caller fetches all events).
 * Processing: O(E) where E = total events, then O(V) venue groupings.
 *
 * Window: Uses 90-day window to match venue detail page.
 *
 * @param events - All events with venue_id (from single query)
 * @returns Map of venue_id -> VenueEventCounts
 */
export function computeVenueCountsFromEvents<T extends EventForCounts>(
  events: T[]
): Map<string, VenueEventCounts> {
  const today = getTodayDenver();
  const windowEnd = addDaysDenver(today, 90); // Same as venue detail page

  // Group events by venue_id
  const eventsByVenue = new Map<string, T[]>();
  for (const event of events) {
    if (!event.venue_id) continue;
    const venueEvents = eventsByVenue.get(event.venue_id) || [];
    venueEvents.push(event);
    eventsByVenue.set(event.venue_id, venueEvents);
  }

  // Compute counts per venue
  const countsMap = new Map<string, VenueEventCounts>();

  for (const [venueId, venueEvents] of eventsByVenue) {
    // De-duplicate by title (same logic as venue detail page)
    const dedupedEvents = deduplicateEventsByTitle(venueEvents);

    // Group as series view (same as venue detail page)
    // Note: We skip override fetching for performance - overrides only affect
    // individual occurrence display, not counts for the list page
    const { series } = groupEventsAsSeriesView(dedupedEvents, {
      startKey: today,
      endKey: windowEnd,
    });

    // Separate recurring vs one-time
    const recurringSeries = series.filter((s) => !s.isOneTime);
    const oneTimeSeries = series.filter((s) => s.isOneTime);

    // Compute totals
    const seriesUpcomingTotal = recurringSeries.reduce(
      (sum, s) => sum + s.totalUpcomingCount,
      0
    );

    countsMap.set(venueId, {
      seriesCount: recurringSeries.length,
      seriesUpcomingTotal,
      oneoffCount: oneTimeSeries.length,
    });
  }

  return countsMap;
}

/**
 * Format venue counts for display badge.
 *
 * Examples:
 * - "1 series • 12 upcoming"
 * - "2 series • 8 upcoming • 3 one-offs"
 * - "2 upcoming" (one-offs only)
 * - "No upcoming"
 */
export function formatVenueCountsBadge(counts: VenueEventCounts): string {
  const { seriesCount, seriesUpcomingTotal, oneoffCount } = counts;

  if (seriesCount === 0 && oneoffCount === 0) {
    return "No upcoming";
  }

  if (seriesCount > 0 && oneoffCount === 0) {
    const seriesLabel = seriesCount === 1 ? "1 series" : `${seriesCount} series`;
    return `${seriesLabel} • ${seriesUpcomingTotal} upcoming`;
  }

  if (seriesCount === 0 && oneoffCount > 0) {
    return oneoffCount === 1 ? "1 upcoming" : `${oneoffCount} upcoming`;
  }

  // Both present
  const seriesLabel = seriesCount === 1 ? "1 series" : `${seriesCount} series`;
  const oneoffLabel = oneoffCount === 1 ? "1 one-off" : `${oneoffCount} one-offs`;
  return `${seriesLabel} • ${seriesUpcomingTotal} upcoming • ${oneoffLabel}`;
}
