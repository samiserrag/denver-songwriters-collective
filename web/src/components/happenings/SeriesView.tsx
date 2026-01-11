"use client";

/**
 * SeriesView - Phase 4.54 Series View Container
 *
 * Displays events grouped as series (one row per recurring event).
 * Alternative to timeline view (grouped by date).
 *
 * Features:
 * - One row per event (series)
 * - Sorted by next occurrence date
 * - Expand/collapse upcoming dates
 * - One-time events appear as individual rows
 */

import * as React from "react";
import { SeriesCard, type SeriesEvent } from "./SeriesCard";
import {
  groupEventsAsSeriesView,
  type ExpansionOptions,
  type OccurrenceOverride,
  type SeriesEntry,
} from "@/lib/events/nextOccurrence";

// Re-export SeriesEvent for consumers
export type { SeriesEvent } from "./SeriesCard";

// ============================================================
// Types
// ============================================================

export interface SeriesViewProps {
  /** Events to display in series view */
  events: SeriesEvent[];
  /** Occurrence overrides map (eventId::dateKey -> override) */
  overrideMap?: Map<string, OccurrenceOverride>;
  /** Window start key (YYYY-MM-DD) */
  startKey?: string;
  /** Window end key (YYYY-MM-DD) */
  endKey?: string;
  /** Additional CSS classes */
  className?: string;
}

export interface SeriesViewResult {
  /** Series entries */
  series: SeriesEntry<SeriesEvent>[];
  /** Events with unknown schedules */
  unknownEvents: SeriesEvent[];
  /** Processing metrics */
  metrics: {
    eventsProcessed: number;
    wasCapped: boolean;
  };
}

// ============================================================
// Component
// ============================================================

export function SeriesView({
  events,
  overrideMap,
  startKey,
  endKey,
  className,
}: SeriesViewProps) {
  // Group events as series
  const options: ExpansionOptions | undefined =
    startKey || endKey || overrideMap
      ? {
          startKey,
          endKey,
          overrideMap,
        }
      : undefined;

  const result = groupEventsAsSeriesView(events, options);

  if (result.series.length === 0 && result.unknownEvents.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-secondary)]">
        <p>No events found.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Main series list */}
      {result.series.length > 0 && (
        <div className="space-y-3">
          {result.series.map((seriesEntry) => (
            <SeriesCard
              key={seriesEntry.event.id}
              series={seriesEntry}
            />
          ))}
        </div>
      )}

      {/* Unknown schedule events */}
      {result.unknownEvents.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
            Schedule Unknown
          </h3>
          <div className="space-y-3">
            {result.unknownEvents.map((event) => (
              <SeriesCard
                key={event.id}
                series={{
                  event,
                  nextOccurrence: {
                    date: "",
                    isToday: false,
                    isTomorrow: false,
                    isConfident: false,
                  },
                  upcomingOccurrences: [],
                  recurrenceSummary: "Schedule Unknown",
                  isOneTime: true,
                  totalUpcomingCount: 0,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Metrics for debugging (hidden by default) */}
      {process.env.NODE_ENV === "development" && result.metrics.wasCapped && (
        <div className="mt-4 text-xs text-amber-500">
          ⚠️ Results capped at {result.metrics.eventsProcessed} events
        </div>
      )}
    </div>
  );
}

export default SeriesView;
