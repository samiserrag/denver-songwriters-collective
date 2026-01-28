"use client";

import * as React from "react";
import Link from "next/link";

interface LineupControlSectionProps {
  eventId: string;
  eventSlug: string | null;
  isRecurring: boolean;
  availableDates: string[];
  nextOccurrenceDate: string | null;
}

/**
 * Lineup Control section for dashboard/my-events/[id] page.
 *
 * Phase 4.99: Provides discoverable entry point to lineup control.
 * DSC UX Principles §6: Anchored Navigation Is Mandatory.
 */
export default function LineupControlSection({
  eventId,
  eventSlug,
  isRecurring,
  availableDates,
  nextOccurrenceDate,
}: LineupControlSectionProps) {
  const [selectedDate, setSelectedDate] = React.useState<string>(
    nextOccurrenceDate || availableDates[0] || ""
  );
  const [copied, setCopied] = React.useState(false);

  const eventIdentifier = eventSlug || eventId;

  // Build lineup URL with date param
  const lineupUrl = selectedDate
    ? `/events/${eventIdentifier}/lineup?date=${selectedDate}`
    : `/events/${eventIdentifier}/lineup`;

  // Build display URL
  const displayUrl = selectedDate
    ? `/events/${eventIdentifier}/display?date=${selectedDate}`
    : `/events/${eventIdentifier}/display`;

  const fullDisplayUrl = typeof window !== "undefined"
    ? `${window.location.origin}${displayUrl}`
    : displayUrl;

  const handleCopyDisplayUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullDisplayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatDateOption = (dateKey: string): string => {
    return new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });
  };

  return (
    <section className="p-6 bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-500/30 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎛️</span>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Lineup Control</h2>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Manage the live lineup and control what&apos;s displayed on TV/projector.
      </p>

      {/* Date selector for recurring events */}
      {isRecurring && availableDates.length > 1 && (
        <div className="mb-4">
          <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">
            Select occurrence date:
          </label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded px-3 py-2 text-[var(--color-text-primary)]"
          >
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {formatDateOption(date)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Controlling date display */}
      {selectedDate && (
        <div className="mb-4 px-3 py-2 bg-[var(--color-bg-tertiary)] rounded-lg">
          <span className="text-xs text-[var(--color-text-tertiary)]">Controlling lineup for:</span>
          <p className="font-medium text-[var(--color-text-accent)]">
            {new Date(selectedDate + "T12:00:00Z").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "America/Denver",
            })}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        <Link
          href={lineupUrl}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Control Lineup
        </Link>

        <Link
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Open TV Display
          <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>

      {/* Copyable display URL */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border-default)]">
        <label className="block text-xs text-[var(--color-text-tertiary)] mb-2">
          TV Display URL (copy for projector):
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={fullDisplayUrl}
            className="flex-1 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded px-2 py-1.5 text-[var(--color-text-secondary)] font-mono"
          />
          <button
            onClick={handleCopyDisplayUrl}
            className="px-3 py-1.5 text-xs bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] font-medium transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
          Opens in a new tab for projector / TV
        </p>
      </div>
    </section>
  );
}
