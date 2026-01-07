"use client";

/**
 * DateJumpControl - Preset-based date jump with dropdown picker
 *
 * Phase 4.19 UX improvements:
 * - Preset dropdown: Today, Tomorrow, This Weekend, Pick a date...
 * - Synchronized Month/Day/Year dropdowns when "Pick a date" selected
 * - Smooth scroll to date headers using existing id="date-YYYY-MM-DD" anchors
 * - Shows warning if date is outside window
 * - Preserves existing URL filters
 *
 * Phase 4.50b: Support past dates
 * - When timeFilter="past", window goes backward from yesterday
 * - Date picker allows selecting dates within past window
 * - Presets adapt to timeFilter context
 */

import * as React from "react";
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

// Preset option types
type PresetValue = "today" | "tomorrow" | "this-weekend" | "pick-a-date";

const PRESET_OPTIONS: { value: PresetValue; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this-weekend", label: "This Weekend" },
  { value: "pick-a-date", label: "Pick a date..." },
];

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
 * Compute target date key for a preset value.
 */
function getPresetTargetDate(
  preset: PresetValue,
  todayKey: string,
  windowEndKey: string
): { dateKey: string | null; outOfWindow: boolean } {
  switch (preset) {
    case "today":
      return { dateKey: todayKey, outOfWindow: false };
    case "tomorrow":
      const tomorrow = addDays(todayKey, 1);
      return { dateKey: tomorrow, outOfWindow: tomorrow > windowEndKey };
    case "this-weekend":
      const weekend = getThisWeekendDate(todayKey);
      if (weekend > windowEndKey) {
        // Try Sunday if Saturday is out of window
        const sunday = addDays(todayKey, 7 - getDayOfWeek(todayKey));
        if (sunday <= windowEndKey) {
          return { dateKey: sunday, outOfWindow: false };
        }
        return { dateKey: weekend, outOfWindow: true };
      }
      return { dateKey: weekend, outOfWindow: false };
    case "pick-a-date":
    default:
      return { dateKey: null, outOfWindow: false };
  }
}

/**
 * Scroll smoothly to a date header if it exists.
 */
function scrollToDateHeader(dateKey: string): boolean {
  const el = document.getElementById(`date-${dateKey}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }
  return false;
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

export function DateJumpControl({
  todayKey,
  windowStartKey,
  windowEndKey,
  timeFilter,
  className,
}: DateJumpControlProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<PresetValue | "">("");
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [warningMessage, setWarningMessage] = React.useState<string | null>(null);

  // Phase 4.50b: Determine if we're in past mode
  const isPastMode = timeFilter === "past";

  // Date picker state - use window bounds instead of today
  const windowStartParsed = parseDateKey(windowStartKey);
  const windowEndParsed = parseDateKey(windowEndKey);

  // Initialize picker to the appropriate default based on mode
  const defaultDate = isPastMode ? windowEndParsed : parseDateKey(todayKey);
  const [pickerYear, setPickerYear] = React.useState(defaultDate.year);
  const [pickerMonth, setPickerMonth] = React.useState(defaultDate.month);
  const [pickerDay, setPickerDay] = React.useState(defaultDate.day);

  // Generate available years (within window)
  const availableYears = React.useMemo(() => {
    const years: number[] = [];
    for (let y = windowStartParsed.year; y <= windowEndParsed.year; y++) {
      years.push(y);
    }
    return years;
  }, [windowStartParsed.year, windowEndParsed.year]);

  // Generate available months for selected year
  const availableMonths = React.useMemo(() => {
    const months: { value: number; label: string }[] = [];
    const startMonth = pickerYear === windowStartParsed.year ? windowStartParsed.month : 0;
    const endMonth = pickerYear === windowEndParsed.year ? windowEndParsed.month : 11;
    for (let m = startMonth; m <= endMonth; m++) {
      months.push({ value: m, label: MONTH_NAMES[m] });
    }
    return months;
  }, [pickerYear, windowStartParsed.year, windowStartParsed.month, windowEndParsed.year, windowEndParsed.month]);

  // Generate available days for selected year/month
  const availableDays = React.useMemo(() => {
    const days: number[] = [];
    const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
    const startDay = (pickerYear === windowStartParsed.year && pickerMonth === windowStartParsed.month)
      ? windowStartParsed.day : 1;
    const endDay = (pickerYear === windowEndParsed.year && pickerMonth === windowEndParsed.month)
      ? windowEndParsed.day : daysInMonth;
    for (let d = startDay; d <= Math.min(endDay, daysInMonth); d++) {
      days.push(d);
    }
    return days;
  }, [pickerYear, pickerMonth, windowStartParsed, windowEndParsed]);

  // Clamp day when month/year changes
  React.useEffect(() => {
    if (!availableDays.includes(pickerDay)) {
      const closestDay = availableDays[availableDays.length - 1] || defaultDate.day;
      setPickerDay(closestDay);
    }
  }, [availableDays, pickerDay, defaultDate.day]);

  // Clamp month when year changes
  React.useEffect(() => {
    const monthValues = availableMonths.map(m => m.value);
    if (!monthValues.includes(pickerMonth)) {
      setPickerMonth(monthValues[0] ?? defaultDate.month);
    }
  }, [availableMonths, pickerMonth, defaultDate.month]);

  // Get day of week label for current picker selection
  const pickerDayOfWeek = React.useMemo(() => {
    const dateKey = formatDateKey(pickerYear, pickerMonth, pickerDay);
    const dow = getDayOfWeek(dateKey);
    return DAY_NAMES[dow];
  }, [pickerYear, pickerMonth, pickerDay]);

  // Handle preset change
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as PresetValue | "";
    setSelectedPreset(value);
    setWarningMessage(null);

    if (!value) {
      setShowDatePicker(false);
      return;
    }

    if (value === "pick-a-date") {
      setShowDatePicker(true);
      return;
    }

    setShowDatePicker(false);

    // Phase 4.50b: Skip presets that don't apply in past mode
    if (isPastMode && (value === "today" || value === "tomorrow" || value === "this-weekend")) {
      setWarningMessage("This preset is for upcoming events. Use the date picker.");
      return;
    }

    const { dateKey, outOfWindow } = getPresetTargetDate(value, todayKey, windowEndKey);

    if (dateKey) {
      if (outOfWindow) {
        setWarningMessage(`Not in current range (${formatDateRange(windowStartKey, windowEndKey)})`);
      } else {
        const found = scrollToDateHeader(dateKey);
        if (!found) {
          setWarningMessage("No events on this date");
        }
      }
    }
  };

  // Handle date picker "Go" button
  const handleDatePickerGo = () => {
    const dateKey = formatDateKey(pickerYear, pickerMonth, pickerDay);
    setWarningMessage(null);

    // Phase 4.50b: Validate against window bounds (not today)
    if (dateKey < windowStartKey || dateKey > windowEndKey) {
      setWarningMessage(`Not in current range (${formatDateRange(windowStartKey, windowEndKey)})`);
      return;
    }

    const found = scrollToDateHeader(dateKey);
    if (!found) {
      setWarningMessage("No events on this date");
    }
  };

  // Handle "Jump to Today" from warning
  const handleJumpToToday = () => {
    setSelectedPreset("today");
    setShowDatePicker(false);
    setWarningMessage(null);
    scrollToDateHeader(todayKey);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
          Jump to:
        </label>

        {/* Preset dropdown */}
        <select
          value={selectedPreset}
          onChange={handlePresetChange}
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg",
            "bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]",
            "text-[var(--color-text-primary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30 focus:border-[var(--color-border-accent)]",
            "transition-colors"
          )}
        >
          <option value="">Select...</option>
          {PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Date picker dropdowns (shown when "Pick a date" selected) */}
        {showDatePicker && (
          <div className="flex items-center gap-1.5">
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
                "hover:opacity-90 transition-opacity"
              )}
            >
              Go
            </button>
          </div>
        )}
      </div>

      {/* Warning message */}
      {warningMessage && (
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <span>{warningMessage}</span>
          <button
            onClick={handleJumpToToday}
            className="underline hover:text-amber-300 transition-colors"
          >
            Jump to Today
          </button>
        </div>
      )}
    </div>
  );
}

export default DateJumpControl;
