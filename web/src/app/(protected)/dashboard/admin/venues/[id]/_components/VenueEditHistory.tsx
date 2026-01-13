"use client";

/**
 * VenueEditHistory - ABC10a
 *
 * Displays audit log history of venue edits with revert capability.
 * Admin-only component.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AuditLogContext {
  action: string;
  actorId: string;
  actorRole: string;
  venueId: string;
  venueName?: string;
  updatedFields: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  reason?: string;
  revertedLogId?: string;
}

interface AuditLogEntry {
  id: string;
  created_at: string | null;
  context: AuditLogContext;
  user_id: string | null;
}

interface ProfileInfo {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface VenueEditHistoryProps {
  logs: AuditLogEntry[];
  profiles: ProfileInfo[];
  venueId: string;
  venueName: string;
}

export default function VenueEditHistory({
  logs,
  profiles,
  venueId,
  venueName,
}: VenueEditHistoryProps) {
  const router = useRouter();
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "(empty)";
    if (typeof value === "string") {
      if (value.length > 50) return value.substring(0, 50) + "...";
      return value || "(empty)";
    }
    return String(value);
  };

  const handleRevert = async (logId: string) => {
    if (!confirm(`Revert this edit? This will restore the previous values for ${venueName}.`)) {
      return;
    }

    setRevertingId(logId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/venues/${venueId}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_id: logId,
          reason: "Admin revert via Edit History UI",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to revert");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setRevertingId(null);
    }
  };

  if (logs.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          No edit history available for this venue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {logs.map((log) => {
        const { context } = log;
        const actor = log.user_id ? profileMap.get(log.user_id) : null;
        const isRevert = context.action === "venue_edit_reverted";
        const canRevert = !isRevert; // Can only revert edits, not reverts

        return (
          <div
            key={log.id}
            className={`p-4 rounded-lg border ${
              isRevert
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      isRevert
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                    }`}
                  >
                    {isRevert ? "Reverted" : "Edited"}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    by {actor?.full_name || actor?.email || "Unknown"} ({context.actorRole})
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  {log.created_at ? formatDate(log.created_at) : "Unknown date"}
                </p>
                {context.reason && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 italic">
                    &quot;{context.reason}&quot;
                  </p>
                )}
              </div>

              {canRevert && (
                <button
                  onClick={() => handleRevert(log.id)}
                  disabled={revertingId === log.id}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {revertingId === log.id ? "Reverting..." : "Revert"}
                </button>
              )}
            </div>

            {/* Changed Fields */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                Changed Fields
              </p>
              <div className="space-y-1">
                {context.updatedFields.map((field) => (
                  <div
                    key={field}
                    className="grid grid-cols-[120px_1fr_1fr] gap-2 text-sm"
                  >
                    <span className="font-medium text-[var(--color-text-secondary)]">
                      {field.replace(/_/g, " ")}
                    </span>
                    <span className="text-red-400 line-through">
                      {formatValue(context.previousValues[field])}
                    </span>
                    <span className="text-emerald-400">
                      {formatValue(context.newValues[field])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
