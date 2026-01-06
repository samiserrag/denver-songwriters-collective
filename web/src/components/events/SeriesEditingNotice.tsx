"use client";

/**
 * SeriesEditingNotice - Phase 4.22.1
 *
 * Displays series editing context for recurring events:
 * 1. Recurrence summary (read-only)
 * 2. Messaging that edits affect all future occurrences
 * 3. Link to override editor for per-date changes (admin only)
 *
 * Contract: Avoids moderation-queue and urgency/FOMO language.
 */

import Link from "next/link";
import { getRecurrenceSummary } from "@/lib/recurrenceHumanizer";

interface SeriesEditingNoticeProps {
  /** The event being edited */
  event: {
    id: string;
    recurrence_rule?: string | null;
    day_of_week?: string | null;
    event_date?: string | null;
    is_recurring?: boolean | null;
    /** Phase 4.42k C3: series_id links events created as a series */
    series_id?: string | null;
  };
  /** Whether to show the override editor link (admin only) */
  showOverrideLink?: boolean;
  /** Sibling events in the same series (for "Other events in series" section) */
  seriesSiblings?: Array<{
    id: string;
    event_date: string | null;
    title: string;
  }>;
}

export function SeriesEditingNotice({
  event,
  showOverrideLink = false,
  seriesSiblings = [],
}: SeriesEditingNoticeProps) {
  const recurrenceSummary = getRecurrenceSummary(
    event.recurrence_rule,
    event.day_of_week,
    event.event_date
  );

  // Phase 4.42k C3: Also recognize series_id as indicating a recurring/series event
  const isRecurring =
    event.is_recurring ||
    event.recurrence_rule ||
    event.series_id ||
    (event.day_of_week && !event.event_date);

  // Filter out current event from siblings list
  const otherSeriesEvents = seriesSiblings.filter(e => e.id !== event.id);

  return (
    <div className="p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg mb-6">
      {/* Recurrence Summary */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔄</span>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            Recurrence
          </p>
          <p className="text-base text-[var(--color-text-primary)]">
            {recurrenceSummary}
          </p>
        </div>
      </div>

      {/* Series Editing Messaging */}
      {isRecurring ? (
        <div className="border-t border-[var(--color-border-default)] pt-3 mt-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Changes made here apply to{" "}
            <span className="font-medium text-[var(--color-text-primary)]">
              all future occurrences
            </span>{" "}
            of this recurring event.
          </p>

          {showOverrideLink && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-2">
              To cancel or modify a single date, use the{" "}
              <Link
                href={`/dashboard/admin/events/${event.id}/overrides`}
                className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline"
              >
                override editor
              </Link>
              .
            </p>
          )}

          {/* Phase 4.42k C3: Show other events in this series */}
          {otherSeriesEvents.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border-default)]">
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Other events in this series:
              </p>
              <ul className="space-y-1">
                {otherSeriesEvents.slice(0, 5).map((siblingEvent) => (
                  <li key={siblingEvent.id}>
                    <Link
                      href={`/dashboard/my-events/${siblingEvent.id}`}
                      className="text-sm text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
                    >
                      {siblingEvent.event_date
                        ? new Date(siblingEvent.event_date + "T12:00:00Z").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            timeZone: "America/Denver",
                          })
                        : "Date TBD"}{" "}
                      — {siblingEvent.title}
                    </Link>
                  </li>
                ))}
                {otherSeriesEvents.length > 5 && (
                  <li className="text-sm text-[var(--color-text-tertiary)]">
                    +{otherSeriesEvents.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-[var(--color-border-default)] pt-3 mt-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            This is a one-time event scheduled for a specific date.
          </p>
        </div>
      )}
    </div>
  );
}

export default SeriesEditingNotice;
