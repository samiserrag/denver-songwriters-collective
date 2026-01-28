"use client";

import * as React from "react";

interface LineupDatePickerProps {
  eventTitle: string;
  availableDates: string[];
  onSelectDate: (date: string) => void;
}

/**
 * Modal/card for requiring explicit date selection before controlling lineup.
 *
 * Phase 4.99: Prevents silent defaulting to wrong occurrence date.
 * DSC UX Principles §3: Rolling Windows Must Be Explained.
 */
export function LineupDatePicker({
  eventTitle,
  availableDates,
  onSelectDate,
}: LineupDatePickerProps) {
  const formatDateOption = (dateKey: string): string => {
    return new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Denver",
    });
  };

  const formatDateShort = (dateKey: string): string => {
    return new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });
  };

  // Determine which date is "today" or closest upcoming
  const today = new Date().toISOString().split("T")[0];
  const upcomingDates = availableDates.filter(d => d >= today);
  const pastDates = availableDates.filter(d => d < today).reverse(); // Most recent first

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] p-6 shadow-lg">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📅</div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            Select Date to Control
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            <span className="font-medium">{eventTitle}</span> is a recurring event.
          </p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Choose which occurrence you want to control.
          </p>
        </div>

        {/* Upcoming dates (preferred) */}
        {upcomingDates.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
              Upcoming
            </h2>
            <div className="space-y-2">
              {upcomingDates.slice(0, 6).map((date, idx) => (
                <button
                  key={date}
                  onClick={() => onSelectDate(date)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    idx === 0
                      ? "bg-[var(--color-accent-primary)]/10 border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/20"
                      : "bg-[var(--color-bg-tertiary)] border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${idx === 0 ? "text-[var(--color-text-accent)]" : "text-[var(--color-text-primary)]"}`}>
                      {formatDateShort(date)}
                    </span>
                    {idx === 0 && date === today && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                        Tonight
                      </span>
                    )}
                    {idx === 0 && date !== today && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] font-medium">
                        Next up
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {formatDateOption(date)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Past dates (collapsed by default) */}
        {pastDates.length > 0 && (
          <details className="group">
            <summary className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-2 cursor-pointer hover:text-[var(--color-text-secondary)] list-none flex items-center gap-2">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Past dates ({pastDates.length})
            </summary>
            <div className="space-y-2 mt-2">
              {pastDates.slice(0, 4).map((date) => (
                <button
                  key={date}
                  onClick={() => onSelectDate(date)}
                  className="w-full p-3 rounded-lg border bg-[var(--color-bg-tertiary)]/50 border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] text-left transition-all opacity-60 hover:opacity-100"
                >
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    {formatDateShort(date)}
                  </span>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {formatDateOption(date)}
                  </p>
                </button>
              ))}
            </div>
          </details>
        )}

        {availableDates.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-tertiary)]">
            No scheduled occurrences found.
          </div>
        )}
      </div>
    </div>
  );
}
