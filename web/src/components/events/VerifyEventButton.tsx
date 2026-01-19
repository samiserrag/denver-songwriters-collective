"use client";

/**
 * VerifyEventButton - Admin/Host control to confirm an event is real and happening
 *
 * Uses the bulk-verify API endpoint (which works for single events too).
 * Shows confirmation badge when event is verified.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

interface VerifyEventButtonProps {
  eventId: string;
  isVerified: boolean;
  lastVerifiedAt?: string | null;
}

export function VerifyEventButton({
  eventId,
  isVerified,
  lastVerifiedAt,
}: VerifyEventButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/ops/events/bulk-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: [eventId],
          action: "verify",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to verify event");
      }

      // Refresh the page to show updated verification status
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify event");
    } finally {
      setLoading(false);
    }
  };

  const handleUnverify = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/ops/events/bulk-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIds: [eventId],
          action: "unverify",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unverify event");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unverify event");
    } finally {
      setLoading(false);
    }
  };

  // Format last verified date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="px-3 py-2 text-sm bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {isVerified ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-600 rounded-lg text-sm font-medium">
            <Check className="w-4 h-4" />
            Verified
            {lastVerifiedAt && (
              <span className="text-emerald-500/70 ml-1">
                ({formatDate(lastVerifiedAt)})
              </span>
            )}
          </span>
          <button
            onClick={handleUnverify}
            disabled={loading}
            className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Remove verification"
            )}
          </button>
        </div>
      ) : (
        <button
          onClick={handleVerify}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Confirm this happening
        </button>
      )}
    </div>
  );
}
