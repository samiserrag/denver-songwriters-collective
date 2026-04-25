"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface DateJumpControlProps {
  /** Today's date key (YYYY-MM-DD in Denver timezone) */
  todayKey: string;
  /** Start of the current window (YYYY-MM-DD) */
  windowStartKey: string;
  /** End of the current window (YYYY-MM-DD) */
  windowEndKey: string;
  /** Current time filter (upcoming/past/all) */
  timeFilter: string;
  /** Additional CSS classes */
  className?: string;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRange(startKey: string, endKey: string): string {
  const start = new Date(`${startKey}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function formatDateForPill(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function DateJumpControl({
  todayKey,
  windowStartKey,
  windowEndKey,
  timeFilter,
  className,
}: DateJumpControlProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPastMode = timeFilter === "past";
  const tomorrowKey = React.useMemo(() => addDays(todayKey, 1), [todayKey]);
  const activeDate = searchParams.get("date") || "";
  const activeDateKey = isDateKey(activeDate) ? activeDate : "";
  const [warningMessage, setWarningMessage] = React.useState<string | null>(null);
  const [pickerDate, setPickerDate] = React.useState(
    activeDateKey || (isPastMode ? windowEndKey : todayKey)
  );

  React.useEffect(() => {
    setPickerDate(activeDateKey || (isPastMode ? windowEndKey : todayKey));
  }, [activeDateKey, isPastMode, windowEndKey, todayKey]);

  const navigateWithDate = React.useCallback((dateKey?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (dateKey) {
      params.set("date", dateKey);
    } else {
      params.delete("date");
    }
    const query = params.toString();
    router.push(query ? `/happenings?${query}` : "/happenings", { scroll: false });
  }, [router, searchParams]);

  const setDateFilter = React.useCallback((dateKey: string) => {
    if (!isDateKey(dateKey)) {
      setWarningMessage("Please choose a valid date.");
      return;
    }
    if (dateKey < windowStartKey || dateKey > windowEndKey) {
      setWarningMessage(`Not in current range (${formatDateRange(windowStartKey, windowEndKey)})`);
      return;
    }
    setWarningMessage(null);
    navigateWithDate(dateKey);
  }, [navigateWithDate, windowEndKey, windowStartKey]);

  const handleToday = () => {
    if (isPastMode) {
      setWarningMessage("Today/Tomorrow filters are unavailable in Past mode.");
      return;
    }
    setDateFilter(todayKey);
  };

  const handleTomorrow = () => {
    if (isPastMode) {
      setWarningMessage("Today/Tomorrow filters are unavailable in Past mode.");
      return;
    }
    setDateFilter(tomorrowKey);
  };

  const handleJumpToDate = () => {
    setDateFilter(pickerDate);
  };

  const clearDateFilter = () => {
    setWarningMessage(null);
    navigateWithDate(undefined);
  };

  const baseButtonClass =
    "px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors";

  const activeButtonClass =
    "bg-[var(--color-accent-primary)]/15 border-[var(--color-border-accent)] text-[var(--color-text-primary)]";

  const inactiveButtonClass =
    "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)]";

  const disabledButtonClass = "opacity-50 cursor-not-allowed hover:border-[var(--color-border-default)] hover:text-[var(--color-text-secondary)]";

  return (
    <div className={cn(
      "rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3 sm:p-4 space-y-3",
      className
    )}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Date Filter</p>
          <p className="text-sm text-[var(--color-text-tertiary)]">Use quick jumps or choose a specific day.</p>
        </div>
        {activeDateKey && (
          <span className="inline-flex items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-sm text-[var(--color-text-secondary)]">
            Active: {formatDateForPill(activeDateKey)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={handleToday}
          disabled={isPastMode}
          className={cn(
            baseButtonClass,
            activeDateKey === todayKey ? activeButtonClass : inactiveButtonClass,
            isPastMode && disabledButtonClass
          )}
        >
          Today
        </button>

        <button
          type="button"
          onClick={handleTomorrow}
          disabled={isPastMode}
          className={cn(
            baseButtonClass,
            activeDateKey === tomorrowKey ? activeButtonClass : inactiveButtonClass,
            isPastMode && disabledButtonClass
          )}
        >
          Tomorrow
        </button>

        {activeDateKey && (
          <button
            type="button"
            onClick={clearDateFilter}
            className={cn(
              baseButtonClass,
              "col-span-2 sm:col-auto bg-transparent border-[var(--color-border-default)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <label className="col-span-2 text-sm text-[var(--color-text-secondary)]">
          Jump to date
        </label>
        <input
          type="date"
          value={pickerDate}
          min={windowStartKey}
          max={windowEndKey}
          onChange={(e) => {
            setPickerDate(e.target.value);
            setWarningMessage(null);
          }}
          className={cn(
            "h-10 px-2.5 text-sm rounded-lg",
            "bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]",
            "text-[var(--color-text-primary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30 focus:border-[var(--color-border-accent)]"
          )}
        />
        <button
          type="button"
          onClick={handleJumpToDate}
          className={cn(
            baseButtonClass,
            "h-10",
            inactiveButtonClass
          )}
        >
          Apply
        </button>
      </div>

      {warningMessage && (
        <p className="text-sm text-amber-400">
          {warningMessage}
        </p>
      )}
    </div>
  );
}

export default DateJumpControl;
