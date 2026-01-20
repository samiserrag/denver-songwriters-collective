import type { SeriesEntry } from "@/lib/events/nextOccurrence";

/**
 * Split hosted happenings into upcoming and past.
 *
 * A series is "upcoming" if it has at least one future occurrence.
 * A series is "past" if it has no future occurrences.
 *
 * @param series - Array of SeriesEntry from groupEventsAsSeriesView
 * @returns Object with upcoming and past arrays, both capped at maxPerSection
 */
export function splitHostedHappenings<T extends SeriesEntry>(
  series: T[],
  maxPerSection: number = 3
): {
  upcoming: T[];
  past: T[];
  hasMoreUpcoming: boolean;
  hasMorePast: boolean;
  totalUpcoming: number;
  totalPast: number;
} {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const entry of series) {
    // A series is "upcoming" if it has at least one future occurrence
    if (entry.upcomingOccurrences.length > 0) {
      upcoming.push(entry);
    } else {
      past.push(entry);
    }
  }

  return {
    upcoming: upcoming.slice(0, maxPerSection),
    past: past.slice(0, maxPerSection),
    hasMoreUpcoming: upcoming.length > maxPerSection,
    hasMorePast: past.length > maxPerSection,
    totalUpcoming: upcoming.length,
    totalPast: past.length,
  };
}
