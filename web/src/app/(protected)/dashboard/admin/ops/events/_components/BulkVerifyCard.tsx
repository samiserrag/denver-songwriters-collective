"use client";

/**
 * Bulk Verify Card
 *
 * UI for bulk verify/unverify operations on events.
 * Allows admin to paste event IDs and verify/unverify them in bulk.
 */

import { useState } from "react";

export default function BulkVerifyCard() {
  const [eventIds, setEventIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    action: string;
    updated: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBulkAction = async (action: "verify" | "unverify") => {
    // Parse event IDs from textarea (one per line or comma-separated)
    const ids = eventIds
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (ids.length === 0) {
      setError("Please enter at least one event ID");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/ops/events/bulk-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: ids, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Bulk action failed");
      }

      setResult(data);
      setEventIds(""); // Clear input on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setLoading(false);
    }
  };

  const parsedCount = eventIds
    .split(/[\n,]/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0).length;

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
        Bulk Verify / Unverify
      </h2>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        Paste event IDs (one per line or comma-separated) to verify or unverify
        them in bulk. Verification sets <code>last_verified_at</code> and{" "}
        <code>verified_by</code>; unverify clears them.
      </p>

      <div className="space-y-4">
        {/* Event IDs Input */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            Event IDs {parsedCount > 0 && `(${parsedCount} detected)`}
          </label>
          <textarea
            value={eventIds}
            onChange={(e) => setEventIds(e.target.value)}
            placeholder="123e4567-e89b-12d3-a456-426614174000&#10;223e4567-e89b-12d3-a456-426614174000&#10;..."
            rows={5}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm font-mono"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleBulkAction("verify")}
            disabled={loading || parsedCount === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-medium disabled:opacity-50"
          >
            {loading ? "Processing..." : `Verify ${parsedCount || ""} Events`}
          </button>
          <button
            onClick={() => handleBulkAction("unverify")}
            disabled={loading || parsedCount === 0}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-white font-medium disabled:opacity-50"
          >
            {loading ? "Processing..." : `Unverify ${parsedCount || ""} Events`}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded">
          <p className="text-green-400 font-medium">
            {result.action === "verify" ? "Verified" : "Unverified"}{" "}
            {result.updated} events
          </p>
        </div>
      )}
    </div>
  );
}
