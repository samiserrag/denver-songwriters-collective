"use client";

/**
 * OccurrenceOverrideList - Phase 4.22.2
 *
 * Displays a list of occurrences for a recurring event with override controls.
 * Admins can cancel, edit time/flyer/notes, or clear overrides for each date.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import { formatDateGroupHeader, getTodayDenver } from "@/lib/events/nextOccurrence";
import type { OccurrenceOverride } from "@/lib/events/nextOccurrence";
import OccurrenceOverrideModal from "./OccurrenceOverrideModal";

interface MergedOccurrence {
  dateKey: string;
  isConfident: boolean;
  override: OccurrenceOverride | null;
  isCancelled: boolean;
}

interface Props {
  eventId: string;
  eventSlug: string | null;
  eventTitle: string;
  baseStartTime: string | null;
  baseCoverImageUrl: string | null;
  occurrences: MergedOccurrence[];
}

export default function OccurrenceOverrideList({
  eventId,
  eventSlug,
  eventTitle,
  baseStartTime,
  baseCoverImageUrl,
  occurrences,
}: Props) {
  // Phase ABC5: Build preview URL using slug (preferred) or id
  const eventIdentifier = eventSlug || eventId;
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<MergedOccurrence | null>(null);

  const todayKey = getTodayDenver();

  const handleQuickCancel = async (dateKey: string) => {
    setLoading(dateKey);
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.from("occurrence_overrides").upsert(
      {
        event_id: eventId,
        date_key: dateKey,
        status: "cancelled",
      },
      { onConflict: "event_id,date_key" }
    );

    if (error) {
      console.error("Failed to cancel occurrence:", error);
      alert("Failed to cancel occurrence: " + error.message);
    }

    setLoading(null);
    router.refresh();
  };

  const handleClearOverride = async (dateKey: string) => {
    setLoading(dateKey);
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase
      .from("occurrence_overrides")
      .delete()
      .eq("event_id", eventId)
      .eq("date_key", dateKey);

    if (error) {
      console.error("Failed to clear override:", error);
      alert("Failed to clear override: " + error.message);
    }

    setLoading(null);
    router.refresh();
  };

  const handleSaveOverride = async (data: {
    status: "normal" | "cancelled";
    override_start_time: string | null;
    override_cover_image_url: string | null;
    override_notes: string | null;
  }) => {
    if (!editingOccurrence) return;

    const dateKey = editingOccurrence.dateKey;
    setLoading(dateKey);
    const supabase = createSupabaseBrowserClient();

    // If all fields are empty and status is normal, delete the override
    const isEmpty =
      data.status === "normal" &&
      !data.override_start_time &&
      !data.override_cover_image_url &&
      !data.override_notes;

    if (isEmpty) {
      // Delete override if it exists
      await supabase
        .from("occurrence_overrides")
        .delete()
        .eq("event_id", eventId)
        .eq("date_key", dateKey);
    } else {
      // Upsert the override
      const { error } = await supabase.from("occurrence_overrides").upsert(
        {
          event_id: eventId,
          date_key: dateKey,
          status: data.status,
          override_start_time: data.override_start_time || null,
          override_cover_image_url: data.override_cover_image_url || null,
          override_notes: data.override_notes || null,
        },
        { onConflict: "event_id,date_key" }
      );

      if (error) {
        console.error("Failed to save override:", error);
        alert("Failed to save override: " + error.message);
        setLoading(null);
        return;
      }
    }

    setLoading(null);
    setEditingOccurrence(null);
    router.refresh();
  };

  if (occurrences.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--color-text-tertiary)]">
        No occurrences found in the next 90 days.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {occurrences.map((occ) => {
          const isLoading = loading === occ.dateKey;
          const displayTime = occ.override?.override_start_time || baseStartTime;
          const hasTimeOverride = !!occ.override?.override_start_time;
          const hasNotes = !!occ.override?.override_notes;
          const hasFlyerOverride = !!occ.override?.override_cover_image_url;
          const hasAnyOverride = occ.override && !occ.isCancelled;

          return (
            <div
              key={occ.dateKey}
              className={`p-4 rounded-lg border transition-colors ${
                occ.isCancelled
                  ? "bg-red-500/5 border-red-500/30 opacity-60"
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
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    <span className="text-[var(--color-text-secondary)]">
                      {formatTimeToAMPM(displayTime)}
                    </span>
                    {hasTimeOverride && (
                      <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded">
                        Time override
                      </span>
                    )}
                    {hasNotes && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                        Has notes
                      </span>
                    )}
                    {hasFlyerOverride && (
                      <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
                        Custom flyer
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Pill */}
                <div className="flex-shrink-0">
                  {occ.isCancelled ? (
                    <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">
                      CANCELLED
                    </span>
                  ) : hasAnyOverride ? (
                    <span className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
                      MODIFIED
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                      NORMAL
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Phase ABC5: Preview link to see occurrence on public site */}
                  <Link
                    href={`/events/${eventIdentifier}?date=${occ.dateKey}`}
                    target="_blank"
                    className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors"
                    title="Preview on live site"
                  >
                    Preview
                  </Link>
                  {!occ.isCancelled && (
                    <button
                      onClick={() => handleQuickCancel(occ.dateKey)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded disabled:opacity-50"
                    >
                      {isLoading ? "..." : "Cancel"}
                    </button>
                  )}
                  <button
                    onClick={() => setEditingOccurrence(occ)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded disabled:opacity-50"
                  >
                    Edit
                  </button>
                  {occ.override && (
                    <button
                      onClick={() => handleClearOverride(occ.dateKey)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                    >
                      Clear
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

      {/* Edit Modal */}
      {editingOccurrence && (
        <OccurrenceOverrideModal
          dateKey={editingOccurrence.dateKey}
          eventTitle={eventTitle}
          baseStartTime={baseStartTime}
          baseCoverImageUrl={baseCoverImageUrl}
          existingOverride={editingOccurrence.override}
          onSave={handleSaveOverride}
          onClose={() => setEditingOccurrence(null)}
          isLoading={loading === editingOccurrence.dateKey}
        />
      )}
    </>
  );
}
