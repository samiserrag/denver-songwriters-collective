"use client";

/**
 * OccurrenceOverrideModal - Phase 4.22.2
 *
 * Modal for editing a single occurrence's override fields:
 * - status (normal/cancelled)
 * - override_start_time
 * - override_cover_image_url
 * - override_notes
 */

import { useState } from "react";
import { formatDateGroupHeader, getTodayDenver } from "@/lib/events/nextOccurrence";
import { formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import type { OccurrenceOverride } from "@/lib/events/nextOccurrence";

// Generate time options from 6:00 AM to 11:30 PM in 30-minute increments
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let hour = 6; hour <= 23; hour++) {
  for (const minute of [0, 30]) {
    if (hour === 23 && minute === 30) continue;
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? "PM" : "AM";
    const label = `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
    const value = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
    TIME_OPTIONS.push({ value, label });
  }
}

interface Props {
  dateKey: string;
  eventTitle: string;
  baseStartTime: string | null;
  baseCoverImageUrl: string | null;
  existingOverride: OccurrenceOverride | null;
  onSave: (data: {
    status: "normal" | "cancelled";
    override_start_time: string | null;
    override_cover_image_url: string | null;
    override_notes: string | null;
  }) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

export default function OccurrenceOverrideModal({
  dateKey,
  eventTitle,
  baseStartTime,
  baseCoverImageUrl,
  existingOverride,
  onSave,
  onClose,
  isLoading,
}: Props) {
  const [status, setStatus] = useState<"normal" | "cancelled">(
    existingOverride?.status || "normal"
  );
  const [overrideTime, setOverrideTime] = useState(
    existingOverride?.override_start_time || ""
  );
  const [overrideFlyerUrl, setOverrideFlyerUrl] = useState(
    existingOverride?.override_cover_image_url || ""
  );
  const [overrideNotes, setOverrideNotes] = useState(
    existingOverride?.override_notes || ""
  );

  const todayKey = getTodayDenver();
  const dateDisplay = formatDateGroupHeader(dateKey, todayKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      status,
      override_start_time: overrideTime || null,
      override_cover_image_url: overrideFlyerUrl || null,
      override_notes: overrideNotes || null,
    });
  };

  // Simple URL validation
  const isValidUrl = (url: string) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const flyerUrlValid = isValidUrl(overrideFlyerUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border-default)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Edit Override
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {eventTitle} — {dateDisplay} ({dateKey})
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Status
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="normal"
                  checked={status === "normal"}
                  onChange={() => setStatus("normal")}
                  className="w-4 h-4 accent-[var(--color-accent-primary)]"
                />
                <span className="text-[var(--color-text-primary)]">Normal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="cancelled"
                  checked={status === "cancelled"}
                  onChange={() => setStatus("cancelled")}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-red-400">Cancelled</span>
              </label>
            </div>
          </div>

          {/* Override Time */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Override Start Time
              <span className="text-[var(--color-text-tertiary)] font-normal ml-2">
                (Base: {formatTimeToAMPM(baseStartTime)})
              </span>
            </label>
            <select
              value={overrideTime}
              onChange={(e) => setOverrideTime(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)]"
            >
              <option value="">Use base time</option>
              {TIME_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Override Flyer URL */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Override Flyer URL
              {baseCoverImageUrl && (
                <span className="text-[var(--color-text-tertiary)] font-normal ml-2">
                  (Has base flyer)
                </span>
              )}
            </label>
            <input
              type="url"
              value={overrideFlyerUrl}
              onChange={(e) => setOverrideFlyerUrl(e.target.value)}
              placeholder="https://example.com/special-flyer.jpg"
              className={`w-full px-3 py-2 bg-[var(--color-bg-input)] border rounded text-[var(--color-text-primary)] ${
                flyerUrlValid
                  ? "border-[var(--color-border-input)]"
                  : "border-red-500"
              }`}
            />
            {!flyerUrlValid && (
              <p className="text-xs text-red-400 mt-1">
                Please enter a valid URL
              </p>
            )}
          </div>

          {/* Override Notes */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Override Notes
            </label>
            <textarea
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
              placeholder="Special guest tonight, different location, etc."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] resize-none"
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Shown as a &quot;Note&quot; chip on the event card when present.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-default)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !flyerUrlValid}
              className="px-4 py-2 text-sm bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save Override"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
