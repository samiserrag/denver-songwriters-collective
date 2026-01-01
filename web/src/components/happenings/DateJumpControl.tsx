"use client";

/**
 * DateJumpControl - Preset buttons + date picker for jumping to dates
 *
 * Phase 4.20 UX corrections:
 * - Preset BUTTONS (not dropdown): Today, Tomorrow, This Weekend
 * - Separate "Pick a date" control with Month/Day/Year pickers
 * - Deterministic scrolling with sticky header offset calculation
 * - Shows friendly message if date has no events
 * - Rolling 90-day window range display
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface DateJumpControlProps {
  /** Today's date key (YYYY-MM-DD in Denver timezone) */
  todayKey: string;
  /** End of 90-day window (YYYY-MM-DD) */
  windowEndKey: string;
  /** Additional CSS classes */
  className?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Parse a YYYY-MM-DD date key into components.
 * Uses noon UTC to avoid timezone issues.
 */
function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month: month - 1, day }; // month is 0-indexed
}

/**
 * Format components back to YYYY-MM-DD date key.
 */
function formatDateKey(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Get day of week index (0=Sun, 6=Sat) for a date key.
 */
function getDayOfWeek(dateKey: string): number {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.getUTCDay();
}

/**
 * Add days to a date key using UTC math.
 */
function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return formatDateKey(year, month, day);
}

/**
 * Get the number of days in a month.
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Get the upcoming Saturday from todayKey.
 * If today is Sat/Sun, returns today.
 */
function getThisWeekendDate(todayKey: string): string {
  const dow = getDayOfWeek(todayKey);
  // 0=Sun, 6=Sat
  if (dow === 6) return todayKey; // Saturday
  if (dow === 0) return todayKey; // Sunday
  // Mon-Fri: jump to Saturday
  const daysToSat = 6 - dow;
  return addDays(todayKey, daysToSat);
}

/**
 * Format date range for display.
 */
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

/**
 * Calculate the total sticky offset (nav + sticky controls).
 * Header is h-16 (64px), StickyControls adds variable height.
 * We measure dynamically to be safe.
 */
function getStickyOffsetPx(): number {
  // Base header height (h-16 = 64px)
  let offset = 64;

  // Try to find the StickyControls wrapper and add its height
  // StickyControls has the class "sticky top-16"
  const stickyControls = document.querySelector('[class*="sticky"][class*="top-16"]');
  if (stickyControls) {
    offset += stickyControls.getBoundingClientRect().height;
  }

  // Add a small buffer to avoid "touching"
  return offset + 8;
}

/**
 * Scroll to a date header with proper offset for sticky elements.
 * Returns true if the element was found, false otherwise.
 */
function scrollToDateHeader(dateKey: string): boolean {
  const el = document.getElementById(`date-${dateKey}`);
  if (!el) {
    return false;
  }

  const offset = getStickyOffsetPx();
  const y = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: y, behavior: "smooth" });
  return true;
}

export function DateJumpControl({
  todayKey,
  windowEndKey,
  className,
}: DateJumpControlProps) {
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; type: "warning" | "info" } | null>(null);

  // Date picker state
  const todayParsed = parseDateKey(todayKey);
  const windowEndParsed = parseDateKey(windowEndKey);

  const [pickerYear, setPickerYear] = React.useState(todayParsed.year);
  const [pickerMonth, setPickerMonth] = React.useState(todayParsed.month);
  const [pickerDay, setPickerDay] = React.useState(todayParsed.day);

  // Rolling window range display
  const windowRangeLabel = formatDateRange(todayKey, windowEndKey);

  // Generate available years (within window)
  const availableYears = React.useMemo(() => {
    const years: number[] = [];
    for (let y = todayParsed.year; y <= windowEndParsed.year; y++) {
      years.push(y);
    }
    return years;
  }, [todayParsed.year, windowEndParsed.year]);

  // Generate available months for selected year
  const availableMonths = React.useMemo(() => {
    const months: { value: number; label: string }[] = [];
    const startMonth = pickerYear === todayParsed.year ? todayParsed.month : 0;
    const endMonth = pickerYear === windowEndParsed.year ? windowEndParsed.month : 11;
    for (let m = startMonth; m <= endMonth; m++) {
      months.push({ value: m, label: MONTH_NAMES[m] });
    }
    return months;
  }, [pickerYear, todayParsed.year, todayParsed.month, windowEndParsed.year, windowEndParsed.month]);

  // Generate available days for selected year/month
  const availableDays = React.useMemo(() => {
    const days: number[] = [];
    const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
    const startDay = (pickerYear === todayParsed.year && pickerMonth === todayParsed.month)
      ? todayParsed.day : 1;
    const endDay = (pickerYear === windowEndParsed.year && pickerMonth === windowEndParsed.month)
      ? windowEndParsed.day : daysInMonth;
    for (let d = startDay; d <= Math.min(endDay, daysInMonth); d++) {
      days.push(d);
    }
    return days;
  }, [pickerYear, pickerMonth, todayParsed, windowEndParsed]);

  // Clamp day when month/year changes
  React.useEffect(() => {
    if (!availableDays.includes(pickerDay)) {
      const closestDay = availableDays[availableDays.length - 1] || todayParsed.day;
      setPickerDay(closestDay);
    }
  }, [availableDays, pickerDay, todayParsed.day]);

  // Clamp month when year changes
  React.useEffect(() => {
    const monthValues = availableMonths.map(m => m.value);
    if (!monthValues.includes(pickerMonth)) {
      setPickerMonth(monthValues[0] ?? todayParsed.month);
    }
  }, [availableMonths, pickerMonth, todayParsed.month]);

  // Get day of week label for current picker selection
  const pickerDayOfWeek = React.useMemo(() => {
    const dateKey = formatDateKey(pickerYear, pickerMonth, pickerDay);
    const dow = getDayOfWeek(dateKey);
    return DAY_NAMES[dow];
  }, [pickerYear, pickerMonth, pickerDay]);

  // Handle preset button clicks
  const handlePresetClick = (preset: "today" | "tomorrow" | "this-weekend") => {
    setMessage(null);
    setShowDatePicker(false);

    let targetDate: string;
    switch (preset) {
      case "today":
        targetDate = todayKey;
        break;
      case "tomorrow":
        targetDate = addDays(todayKey, 1);
        if (targetDate > windowEndKey) {
          setMessage({ text: `Tomorrow is outside the ${windowRangeLabel} range.`, type: "warning" });
          return;
        }
        break;
      case "this-weekend":
        targetDate = getThisWeekendDate(todayKey);
        if (targetDate > windowEndKey) {
          setMessage({ text: `This weekend is outside the ${windowRangeLabel} range.`, type: "warning" });
          return;
        }
        break;
    }

    const found = scrollToDateHeader(targetDate);
    if (!found) {
      const dateFormatted = new Date(`${targetDate}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      setMessage({ text: `No events on ${dateFormatted} within the next 90 days.`, type: "info" });
    }
  };

  // Handle date picker "Go" button
  const handleDatePickerGo = () => {
    const dateKey = formatDateKey(pickerYear, pickerMonth, pickerDay);
    setMessage(null);

    if (dateKey < todayKey || dateKey > windowEndKey) {
      setMessage({ text: `Date is outside the ${windowRangeLabel} range.`, type: "warning" });
      return;
    }

    const found = scrollToDateHeader(dateKey);
    if (!found) {
      const dateFormatted = new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      setMessage({ text: `No events on ${dateFormatted} within the next 90 days.`, type: "info" });
    }
  };

  // Toggle date picker visibility
  const toggleDatePicker = () => {
    setShowDatePicker(!showDatePicker);
    setMessage(null);
  };

  // Common button styles
  const buttonBase = cn(
    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
    "border border-[var(--color-border-default)]",
    "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]",
    "hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-accent)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30"
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Row 1: Preset buttons + Pick a date toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
          Jump to:
        </span>

        {/* Preset buttons */}
        <button
          onClick={() => handlePresetClick("today")}
          className={buttonBase}
        >
          Today
        </button>
        <button
          onClick={() => handlePresetClick("tomorrow")}
          className={buttonBase}
        >
          Tomorrow
        </button>
        <button
          onClick={() => handlePresetClick("this-weekend")}
          className={buttonBase}
        >
          This Weekend
        </button>

        {/* Pick a date toggle */}
        <button
          onClick={toggleDatePicker}
          className={cn(
            buttonBase,
            showDatePicker && "bg-[var(--color-accent-muted)] border-[var(--color-border-accent)]"
          )}
        >
          {showDatePicker ? "Hide Picker" : "Pick a date"}
        </button>
      </div>

      {/* Row 2: Date picker dropdowns (shown when toggled) */}
      {showDatePicker && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Month */}
          <select
            value={pickerMonth}
            onChange={(e) => setPickerMonth(Number(e.target.value))}
            className={cn(
              "px-2 py-1.5 text-sm rounded-lg",
              "bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]",
              "text-[var(--color-text-primary)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30"
            )}
          >
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Day */}
          <select
            value={pickerDay}
            onChange={(e) => setPickerDay(Number(e.target.value))}
            className={cn(
              "px-2 py-1.5 text-sm rounded-lg",
              "bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]",
              "text-[var(--color-text-primary)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30"
            )}
          >
            {availableDays.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Year */}
          <select
            value={pickerYear}
            onChange={(e) => setPickerYear(Number(e.target.value))}
            className={cn(
              "px-2 py-1.5 text-sm rounded-lg",
              "bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]",
              "text-[var(--color-text-primary)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30"
            )}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Day of week indicator */}
          <span className="text-sm text-[var(--color-text-secondary)] font-medium">
            ({pickerDayOfWeek})
          </span>

          {/* Go button */}
          <button
            onClick={handleDatePickerGo}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg",
              "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]",
              "hover:opacity-90 transition-opacity",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/50"
            )}
          >
            Go
          </button>

          {/* Range hint */}
          <span className="text-xs text-[var(--color-text-tertiary)]">
            ({windowRangeLabel})
          </span>
        </div>
      )}

      {/* Message display */}
      {message && (
        <div className={cn(
          "flex items-center gap-2 text-sm",
          message.type === "warning" ? "text-amber-400" : "text-[var(--color-text-secondary)]"
        )}>
          <span>{message.text}</span>
          <button
            onClick={() => handlePresetClick("today")}
            className="underline hover:text-[var(--color-text-primary)] transition-colors"
          >
            Jump to Today
          </button>
        </div>
      )}
    </div>
  );
}

export default DateJumpControl;
