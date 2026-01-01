"use client";

/**
 * DateSection - Collapsible date group for happenings
 *
 * Phase 4.20: Improved collapse UX
 * - Obvious chevron toggle with rotation animation
 * - Full-width clickable header button (not just chevron)
 * - cursor-pointer + hover feedback for discoverability
 * - Collapse/expand hint text on hover
 * - State is in-memory only (resets on navigation)
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface DateSectionProps {
  /** Date key (YYYY-MM-DD) for the anchor ID */
  dateKey: string;
  /** Formatted header text (e.g., "Tonight - Wed, Jan 15") */
  headerText: string;
  /** Number of events in this section */
  eventCount: number;
  /** Whether this section is "Schedule unknown" style */
  isUnknown?: boolean;
  /** Children (the event cards grid) */
  children: React.ReactNode;
  /** Description text for unknown section */
  description?: string;
}

function ChevronIcon({ className, isExpanded }: { className?: string; isExpanded: boolean }) {
  return (
    <svg
      className={cn(
        "w-5 h-5 transition-transform duration-200 ease-out",
        isExpanded ? "rotate-0" : "-rotate-90",
        className
      )}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
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
  children,
  description,
}: DateSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <section id={`date-${dateKey}`} className="relative">
      {/* Sticky date header with collapse toggle */}
      <div
        className="sticky top-[120px] z-20 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-b border-[var(--color-border-default)]"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center gap-2 text-left group cursor-pointer",
            "rounded-md -mx-2 px-2 py-1",
            "hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
          )}
          aria-expanded={isExpanded}
          aria-controls={`events-${dateKey}`}
          title={isExpanded ? "Click to collapse" : "Click to expand"}
        >
          <ChevronIcon
            isExpanded={isExpanded}
            className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent-primary)] transition-colors"
          />
          <h2 className="text-lg md:text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2 flex-1">
            <span
              className={cn(
                "w-1 h-5 rounded-full",
                isUnknown ? "bg-amber-500" : "bg-[var(--color-accent-primary)]"
              )}
              aria-hidden="true"
            />
            {headerText}
            <span className="text-sm font-normal text-[var(--color-text-secondary)]">
              ({eventCount})
            </span>
          </h2>
        </button>
        {description && isExpanded && (
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1 ml-7">
            {description}
          </p>
        )}
      </div>

      {/* Event cards grid (collapsible) - compact gaps for density */}
      <div
        id={`events-${dateKey}`}
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3 pt-2 pb-3",
          "transition-all duration-200",
          !isExpanded && "hidden"
        )}
      >
        {children}
      </div>
    </section>
  );
}

export default DateSection;
