"use client";

/**
 * DateJumpControl - Jump to a specific date on /happenings
 *
 * Features:
 * - Date input for selecting a date
 * - Scrolls to the date header if it exists in DOM
 * - Shows warning if date is outside 90-day window
 * - Preserves existing filters
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface DateJumpControlProps {
  /** Today's date key */
  todayKey: string;
  /** End of 90-day window */
  windowEndKey: string;
  /** Additional CSS classes */
  className?: string;
}

export function DateJumpControl({
  todayKey,
  windowEndKey,
  className,
}: DateJumpControlProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = React.useState("");
  const [showOutOfWindow, setShowOutOfWindow] = React.useState(false);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setSelectedDate(date);

    if (!date) {
      setShowOutOfWindow(false);
      return;
    }

    // Check if date is within window
    if (date < todayKey || date > windowEndKey) {
      setShowOutOfWindow(true);
      return;
    }

    setShowOutOfWindow(false);

    // Try to scroll to the date header
    const dateElement = document.getElementById(`date-${date}`);
    if (dateElement) {
      // Offset for sticky header (64px nav + some padding)
      const headerOffset = 80;
      const elementPosition = dateElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    } else {
      // Date not in current view - update URL to preserve for page reload
      const params = new URLSearchParams(searchParams.toString());
      params.set("jumpTo", date);
      router.push(`/happenings?${params.toString()}`, { scroll: false });
    }
  };

  const handleClear = () => {
    setSelectedDate("");
    setShowOutOfWindow(false);

    // Remove jumpTo from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("jumpTo");
    const newUrl = params.toString() ? `/happenings?${params.toString()}` : "/happenings";
    router.push(newUrl, { scroll: false });
  };

  // Format date range for display
  const formatDateRange = () => {
    const startDate = new Date(`${todayKey}T12:00:00Z`);
    const endDate = new Date(`${windowEndKey}T12:00:00Z`);

    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });

    return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <label className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
        Jump to date:
      </label>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          min={todayKey}
          max={windowEndKey}
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg",
            "bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]",
            "text-[var(--color-text-primary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30 focus:border-[var(--color-border-accent)]",
            "transition-colors"
          )}
        />

        {selectedDate && (
          <button
            onClick={handleClear}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Clear date selection"
          >
            ✕
          </button>
        )}
      </div>

      <span className="text-xs text-[var(--color-text-tertiary)]">
        ({formatDateRange()})
      </span>

      {showOutOfWindow && (
        <span className="text-xs text-amber-400">
          Date is outside 90-day window
        </span>
      )}
    </div>
  );
}

export default DateJumpControl;
