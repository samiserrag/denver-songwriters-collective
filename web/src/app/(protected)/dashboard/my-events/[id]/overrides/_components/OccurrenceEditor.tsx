"use client";

/**
 * OccurrenceEditor — Host/Admin occurrence management.
 *
 * Displays a list of occurrences for a recurring event. Each row has:
 * - Date, time, status pill
 * - Quick actions: Cancel, Edit, Revert
 * - "Edit" navigates to EventForm in occurrence mode (future task)
 *
 * For now, provides the same capabilities as the admin override list
 * but accessible to hosts via the API route at /api/my-events/[id]/overrides.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import { formatDateGroupHeader, getTodayDenver } from "@/lib/events/nextOccurrence";
import type { OccurrenceOverride } from "@/lib/events/nextOccurrence";

interface MergedOccurrence {
  dateKey: string;
  isConfident: boolean;
  override: OccurrenceOverride | null;
  isCancelled: boolean;
}

interface BaseEvent {
  id: string;
  slug: string | null;
  title: string;
  start_time: string | null;
  end_time: string | null;
  cover_image_url: string | null;
  venue_id: string | null;
}

interface Props {
  eventId: string;
  baseEvent: BaseEvent;
  occurrences: MergedOccurrence[];
}

export default function OccurrenceEditor({
  eventId,
  baseEvent,
  occurrences,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const todayKey = getTodayDenver();

  const normalOccurrences = occurrences.filter((o) => !o.isCancelled);
  const cancelledOccurrences = occurrences.filter((o) => o.isCancelled);
  const displayOccurrences = showCancelled ? occurrences : normalOccurrences;

  const handleCancel = async (dateKey: string) => {
    setLoading(dateKey);
    try {
      const res = await fetch(`/api/my-events/${eventId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_key: dateKey, status: "cancelled" }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert("Failed to cancel: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Cancel error:", err);
      alert("Failed to cancel occurrence");
    }
    setLoading(null);
    router.refresh();
  };

  const handleRevert = async (dateKey: string) => {
    setLoading(dateKey);
    try {
      const res = await fetch(`/api/my-events/${eventId}/overrides`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_key: dateKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert("Failed to revert: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Revert error:", err);
      alert("Failed to revert override");
    }
    setLoading(null);
    router.refresh();
  };

  const handleRestore = async (dateKey: string) => {
    setLoading(dateKey);
    try {
      const res = await fetch(`/api/my-events/${eventId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_key: dateKey, status: "normal" }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert("Failed to restore: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Restore error:", err);
      alert("Failed to restore occurrence");
    }
    setLoading(null);
    router.refresh();
  };

  if (occurrences.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--color-text-tertiary)]">
        No occurrences found in this time window.
      </div>
    );
  }

  const eventIdentifier = baseEvent.slug || eventId;

  return (
    <>
      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setShowCancelled(!showCancelled)}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            showCancelled
              ? "bg-red-100 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-400"
              : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {cancelledOccurrences.length} cancelled
        </button>
      </div>

      {/* Occurrence List */}
      <div className="space-y-2">
        {displayOccurrences.map((occ) => {
          const isLoading = loading === occ.dateKey;
          const displayTime = occ.override?.override_start_time || baseEvent.start_time;
          const hasOverridePatch = !!(occ.override as Record<string, unknown> | null)?.override_patch;
          const hasTimeOverride = !!occ.override?.override_start_time;
          const hasNotes = !!occ.override?.override_notes;
          const hasFlyerOverride = !!occ.override?.override_cover_image_url;
          const hasAnyModification = hasOverridePatch || hasTimeOverride || hasNotes || hasFlyerOverride;

          return (
            <div
              key={occ.dateKey}
              className={`p-4 rounded-lg border transition-colors ${
                occ.isCancelled
                  ? "bg-red-100 dark:bg-red-500/5 border-red-300 dark:border-red-500/30 opacity-60"
                  : "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)]"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Date & Time */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {formatDateGroupHeader(occ.dateKey, todayKey)}
                    </span>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {occ.dateKey}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
                    <span className="text-[var(--color-text-secondary)]">
                      {formatTimeToAMPM(displayTime)}
                    </span>
                    {hasTimeOverride && (
                      <span className="px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 rounded">
                        Time override
                      </span>
                    )}
                    {hasOverridePatch && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400 rounded">
                        Custom fields
                      </span>
                    )}
                    {hasNotes && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                        Notes
                      </span>
                    )}
                    {hasFlyerOverride && (
                      <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-400 rounded">
                        Custom flyer
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Pill */}
                <div className="flex-shrink-0">
                  {occ.isCancelled ? (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400 rounded-full">
                      CANCELLED
                    </span>
                  ) : hasAnyModification ? (
                    <span className="px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 rounded-full">
                      MODIFIED
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded-full">
                      NORMAL
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/events/${eventIdentifier}?date=${occ.dateKey}`}
                    target="_blank"
                    className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors"
                    title="Preview on live site"
                  >
                    Preview
                  </Link>

                  {occ.isCancelled ? (
                    <button
                      onClick={() => handleRestore(occ.dateKey)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded disabled:opacity-50"
                    >
                      {isLoading ? "..." : "Restore"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCancel(occ.dateKey)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-800 dark:text-red-400 rounded disabled:opacity-50"
                    >
                      {isLoading ? "..." : "Cancel"}
                    </button>
                  )}

                  {/* Edit link — will open EventForm in occurrence mode */}
                  <Link
                    href={`/dashboard/my-events/${eventId}/overrides/${occ.dateKey}`}
                    className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded"
                  >
                    Edit
                  </Link>

                  {(occ.override && !occ.isCancelled) && (
                    <button
                      onClick={() => handleRevert(occ.dateKey)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                      title="Remove all overrides for this date"
                    >
                      Revert
                    </button>
                  )}
                </div>
              </div>

              {/* Notes preview */}
              {occ.override?.override_notes && (
                <p className="mt-2 text-sm text-[var(--color-text-secondary)] italic border-t border-[var(--color-border-default)] pt-2">
                  Note: {occ.override.override_notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
