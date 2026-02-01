"use client";

import { useState } from "react";

/**
 * Format a date key for short display.
 * E.g., "2026-01-18" -> "Sat, Jan 18"
 */
function formatDateKeyShort(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

interface OccurrenceSelectorProps {
  availableDates: string[];
  initialDateKey?: string;
  onDateChange: (dateKey: string) => void;
}

/**
 * Phase 5.13: Unified occurrence date selector for series management
 *
 * For recurring events, hosts need to manage RSVPs and performer signups
 * on a per-occurrence basis. This selector provides a single control
 * that syncs across all management panels.
 */
export default function OccurrenceSelector({
  availableDates,
  initialDateKey,
  onDateChange,
}: OccurrenceSelectorProps) {
  const [selectedDate, setSelectedDate] = useState(initialDateKey || availableDates[0] || "");

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    onDateChange(newDate);
  };

  if (availableDates.length <= 1) {
    // Single occurrence or no dates - no selector needed
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
        📅 Managing occurrence:
      </label>
      <select
        value={selectedDate}
        onChange={(e) => handleDateChange(e.target.value)}
        className="w-full text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded px-3 py-2 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
      >
        {availableDates.map((date) => (
          <option key={date} value={date}>
            {formatDateKeyShort(date)}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
        Attendees and signups below are for this specific date.
      </p>
    </div>
  );
}
