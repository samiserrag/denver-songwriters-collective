"use client";

/**
 * SeriesView - Phase 4.54 Series View Container
 *
 * Displays events grouped as series (one row per recurring event).
 * Alternative to timeline view (grouped by date).
 *
 * Features:
 * - One row per event (series)
 * - Grouped by day of week with sticky headers (Phase 4.57)
 * - Sorted by next occurrence date within each day
 * - Expand/collapse upcoming dates
 * - One-time events appear as individual rows
 */

import * as React from "react";
import { cn } from "@/lib/utils";
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
// Day Order (Sunday = 0 for consistency)
// ============================================================

const DAY_ORDER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Get the day order index, starting from today
 * This ensures "today's day" appears first in the list
 */
function getDayOrderFromToday(dayName: string | null | undefined): number {
  if (!dayName) return 999; // Unknown days go to end
  const normalizedDay = dayName.toLowerCase().trim();
  const dayIndex = DAY_ORDER[normalizedDay];
  if (dayIndex === undefined) return 999;

  // Get today's day index
  const today = new Date();
  const todayIndex = today.getDay(); // 0 = Sunday

  // Calculate relative position from today
  // Days today or later in the week come first, earlier days come after
  return (dayIndex - todayIndex + 7) % 7;
}

/**
 * Format day name for display
 */
function formatDayName(dayName: string): string {
  // Capitalize first letter
  return dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();
}

// ============================================================
// Chevron Icon
// ============================================================

function ChevronIcon({ className, isExpanded }: { className?: string; isExpanded: boolean }) {
  return (
    <svg
      className={cn(
        "w-5 h-5 transition-transform duration-200",
        isExpanded ? "rotate-0" : "-rotate-90",
        className
      )}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ============================================================
// Day Section Component
// ============================================================

interface DaySectionProps {
  dayName: string;
  seriesEntries: SeriesEntry<SeriesEvent>[];
  isUnknown?: boolean;
}

function DaySection({ dayName, seriesEntries, isUnknown = false }: DaySectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const sectionId = isUnknown ? "unknown" : dayName.toLowerCase();

  return (
    <section id={`day-${sectionId}`} className="relative">
      {/* Sticky day header with collapse toggle */}
      <div
        className="sticky top-[120px] z-20 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border-default)]"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 text-left group"
          aria-expanded={isExpanded}
          aria-controls={`series-${sectionId}`}
        >
          <ChevronIcon
            isExpanded={isExpanded}
            className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
          />
          <h2 className="text-lg md:text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2 flex-1">
            <span
              className={cn(
                "w-1 h-5 rounded-full",
                isUnknown ? "bg-amber-500" : "bg-[var(--color-accent-primary)]"
              )}
              aria-hidden="true"
            />
            {isUnknown ? "Schedule Unknown" : `${formatDayName(dayName)}s`}
            <span className="text-sm font-normal text-[var(--color-text-secondary)]">
              ({seriesEntries.length})
            </span>
          </h2>
        </button>
        {isUnknown && isExpanded && (
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1 ml-7">
            These happenings have incomplete schedule information
          </p>
        )}
      </div>

      {/* Series cards (collapsible) */}
      <div
        id={`series-${sectionId}`}
        className={cn(
          "pt-3 pb-4 space-y-3",
          "transition-all duration-200",
          !isExpanded && "hidden"
        )}
      >
        {seriesEntries.map((seriesEntry) => (
          <SeriesCard
            key={seriesEntry.event.id}
            series={seriesEntry}
          />
        ))}
      </div>
    </section>
  );
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

  // Group series by day_of_week (must be called before early returns)
  const seriesByDay = React.useMemo(() => {
    const groups = new Map<string, SeriesEntry<SeriesEvent>[]>();

    for (const seriesEntry of result.series) {
      const dayOfWeek = seriesEntry.event.day_of_week;
      // Use "one-time" for events without a recurring day
      const key = dayOfWeek?.toLowerCase().trim() || "one-time";

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(seriesEntry);
    }

    // Sort groups by day order (starting from today)
    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
      return getDayOrderFromToday(a) - getDayOrderFromToday(b);
    });

    return sortedEntries;
  }, [result.series]);

  // Create unknown events as series entries for DaySection (must be called before early returns)
  const unknownSeriesEntries: SeriesEntry<SeriesEvent>[] = React.useMemo(() => {
    return result.unknownEvents.map((event) => ({
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
    }));
  }, [result.unknownEvents]);

  // Early return for empty state
  if (result.series.length === 0 && result.unknownEvents.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-secondary)]">
        <p>No events found.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Series grouped by day of week */}
      {seriesByDay.map(([dayName, seriesEntries]) => (
        <DaySection
          key={dayName}
          dayName={dayName}
          seriesEntries={seriesEntries}
        />
      ))}

      {/* Unknown schedule events */}
      {unknownSeriesEntries.length > 0 && (
        <DaySection
          dayName="unknown"
          seriesEntries={unknownSeriesEntries}
          isUnknown
        />
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
