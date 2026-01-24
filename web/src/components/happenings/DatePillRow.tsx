"use client";

/**
 * DatePillRow - Shared component for rendering date pills with expand/collapse
 *
 * Used by:
 * - SeriesCard (venue detail, happenings series view)
 * - Event detail page recurrence section
 *
 * Features:
 * - Shows maxVisible pills (default 5) when collapsed
 * - "+X more" button to expand/collapse
 * - Pills are accessible <Link> elements
 * - Toggle is accessible <button> element
 */

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DatePillData {
  /** Display label, e.g., "Tue, Jan 13" */
  label: string;
  /** Navigation href, e.g., "/events/foo?date=2026-01-13" */
  href: string;
  /** Date key for selection comparison, e.g., "2026-01-13" */
  dateKey: string;
  /** Whether this pill represents a rescheduled occurrence */
  isRescheduled?: boolean;
}

export interface DatePillRowProps {
  /** Array of date pill data */
  dates: DatePillData[];
  /** Currently selected date key (for highlighting) */
  selectedDateKey?: string;
  /** Maximum pills to show when collapsed (default: 5) */
  maxVisible?: number;
  /** Total count for "+X more" label (default: dates.length) */
  totalCount?: number;
  /** Whether the list is expanded */
  isExpanded: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Optional class name for container */
  className?: string;
}

export function DatePillRow({
  dates,
  selectedDateKey,
  maxVisible = 5,
  totalCount,
  isExpanded,
  onToggle,
  className,
}: DatePillRowProps) {
  const effectiveTotalCount = totalCount ?? dates.length;
  const visibleDates = isExpanded ? dates : dates.slice(0, maxVisible);
  const hiddenCount = effectiveTotalCount - maxVisible;
  const showToggle = effectiveTotalCount > maxVisible;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {visibleDates.map((date) => {
        const isSelected = date.dateKey === selectedDateKey;
        return (
          <Link
            key={date.dateKey}
            href={date.href}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              isSelected
                ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                : date.isRescheduled
                  ? "bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]"
            )}
            onClick={(e) => e.stopPropagation()}
            title={date.isRescheduled ? "Rescheduled" : undefined}
          >
            {date.isRescheduled && <span className="mr-1">↻</span>}
            {date.label}
          </Link>
        );
      })}

      {showToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium",
            "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
            "hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/50"
          )}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Hide dates" : `Show ${hiddenCount} more dates`}
        >
          <span>{isExpanded ? "Hide dates" : `+${hiddenCount} more`}</span>
          <svg
            className={cn(
              "w-4 h-4 transition-transform",
              isExpanded && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default DatePillRow;
