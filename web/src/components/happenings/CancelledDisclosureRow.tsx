"use client";

/**
 * CancelledDisclosureRow - Collapsible row for cancelled occurrences
 *
 * Phase 4.23: Only shown for Today/Tomorrow date sections when showCancelled=1.
 * - Default: collapsed "Cancelled (n)" row
 * - Expandable to reveal cancelled HappeningCards
 * - Keyboard accessible with aria-expanded
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface CancelledDisclosureRowProps {
  /** Number of cancelled occurrences */
  count: number;
  /** Whether the disclosure is expanded */
  isExpanded: boolean;
  /** Callback when expand/collapse is toggled */
  onToggle: () => void;
  /** The cancelled event cards to render when expanded */
  children: React.ReactNode;
  /** Optional className */
  className?: string;
}

function ChevronIcon({ className, isExpanded }: { className?: string; isExpanded: boolean }) {
  return (
    <svg
      className={cn(
        "w-4 h-4 transition-transform duration-200",
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

export function CancelledDisclosureRow({
  count,
  isExpanded,
  onToggle,
  children,
  className,
}: CancelledDisclosureRowProps) {
  const disclosureId = React.useId();

  if (count === 0) {
    return null;
  }

  return (
    <div className={cn("mt-4", className)}>
      {/* Disclosure row */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={disclosureId}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
          "text-sm text-[var(--color-text-secondary)]",
          "bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]",
          "hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)]",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)]"
        )}
      >
        <ChevronIcon
          isExpanded={isExpanded}
          className="text-[var(--color-text-tertiary)]"
        />
        <span className="flex items-center gap-2">
          <span
            className="w-1 h-3 rounded-full bg-red-500"
            aria-hidden="true"
          />
          Cancelled ({count})
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div
          id={disclosureId}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pt-3"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default CancelledDisclosureRow;
