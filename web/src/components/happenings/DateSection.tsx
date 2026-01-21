"use client";

/**
 * DateSection - Collapsible date group for happenings
 *
 * Phase 4.19: Per-date collapse toggle
 * - Each date header gets a chevron to collapse/expand its events
 * - State is in-memory only (resets on navigation)
 *
 * Phase 4.23: Cancelled disclosure for Today/Tomorrow
 * - When showCancelled=1 and this is Today/Tomorrow, cancelled occurrences
 *   are shown in a collapsed disclosure row after active events
 * - Other dates remain unchanged
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { CancelledDisclosureRow } from "./CancelledDisclosureRow";

interface DateSectionProps {
  /** Date key (YYYY-MM-DD) for the anchor ID */
  dateKey: string;
  /** Formatted header text (e.g., "Tonight - Wed, Jan 15") */
  headerText: string;
  /** Number of events in this section */
  eventCount: number;
  /** Whether this section is "Schedule unknown" style */
  isUnknown?: boolean;
  /** Whether this section is "Cancelled" style (Phase 4.21) */
  isCancelled?: boolean;
  /** Children (the event cards grid) */
  children: React.ReactNode;
  /** Description text for unknown section */
  description?: string;
  /** Cancelled occurrences for this date (Phase 4.23 - Today/Tomorrow only) */
  cancelledChildren?: React.ReactNode;
  /** Count of cancelled occurrences for disclosure row */
  cancelledCount?: number;
}

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

export function DateSection({
  dateKey,
  headerText,
  eventCount,
  isUnknown = false,
  isCancelled = false,
  children,
  description,
  cancelledChildren,
  cancelledCount = 0,
}: DateSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [cancelledExpanded, setCancelledExpanded] = React.useState(false);

  return (
    <section id={`date-${dateKey}`} className="relative">
      {/* Sticky date header with collapse toggle */}
      <div
        className="sticky top-[120px] z-20 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-[var(--color-accent-primary)] border-b border-[var(--color-accent-primary)]"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 text-left group"
          aria-expanded={isExpanded}
          aria-controls={`events-${dateKey}`}
        >
          <ChevronIcon
            isExpanded={isExpanded}
            className="text-[var(--color-text-on-accent)] group-hover:text-[var(--color-text-on-accent)]"
          />
          <h2 className="text-lg md:text-xl font-bold text-[var(--color-text-on-accent)] flex items-center gap-2 flex-1">
            <span
              className={cn(
                "w-1 h-5 rounded-full",
                isCancelled && "bg-red-200",
                !isCancelled && isUnknown && "bg-amber-200",
                !isCancelled && !isUnknown && "bg-[var(--color-text-on-accent)]"
              )}
              aria-hidden="true"
            />
            {headerText}
            <span className="text-sm font-normal text-[var(--color-text-on-accent)]/80">
              ({eventCount})
            </span>
          </h2>
        </button>
        {description && isExpanded && (
          <p className="text-sm text-[var(--color-text-on-accent)]/70 mt-1 ml-7">
            {description}
          </p>
        )}
      </div>

      {/* Event cards grid (collapsible) */}
      <div
        id={`events-${dateKey}`}
        className={cn(
          "pt-3 pb-4",
          "transition-all duration-200",
          !isExpanded && "hidden"
        )}
      >
        {/* Active occurrences grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {children}
        </div>

        {/* Phase 4.23: Cancelled disclosure for Today/Tomorrow */}
        {cancelledCount > 0 && cancelledChildren && (
          <CancelledDisclosureRow
            count={cancelledCount}
            isExpanded={cancelledExpanded}
            onToggle={() => setCancelledExpanded(!cancelledExpanded)}
          >
            {cancelledChildren}
          </CancelledDisclosureRow>
        )}
      </div>
    </section>
  );
}

export default DateSection;
