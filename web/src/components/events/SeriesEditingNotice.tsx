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
  };
  /** Whether to show the override editor link (admin only) */
  showOverrideLink?: boolean;
}

export function SeriesEditingNotice({
  event,
  showOverrideLink = false,
}: SeriesEditingNoticeProps) {
  const recurrenceSummary = getRecurrenceSummary(
    event.recurrence_rule,
    event.day_of_week,
    event.event_date
  );

  const isRecurring =
    event.is_recurring ||
    event.recurrence_rule ||
    (event.day_of_week && !event.event_date);

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
