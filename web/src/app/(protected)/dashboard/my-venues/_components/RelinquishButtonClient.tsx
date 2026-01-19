"use client";

/**
 * RelinquishButtonClient - ABC8
 *
 * Client component for relinquishing venue access.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  venueId: string;
  venueName: string;
  role: string;
}

export function RelinquishButtonClient({
  venueId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for confirmation dialog
  venueName,
  role,
}: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRelinquish = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/my-venues/${venueId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to relinquish access");
        setIsLoading(false);
        return;
      }

      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Relinquish error:", err);
    } finally {
      setIsLoading(false);
      setIsConfirming(false);
    }
  };

  if (isConfirming) {
    return (
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-xs text-red-800 dark:text-red-400">{error}</span>
        )}
        <button
          onClick={handleRelinquish}
          disabled={isLoading}
          className="px-2 py-1 text-xs bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-800 dark:text-red-400 rounded disabled:opacity-50"
        >
          {isLoading ? "..." : "Confirm"}
        </button>
        <button
          onClick={() => {
            setIsConfirming(false);
            setError(null);
          }}
          disabled={isLoading}
          className="px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:text-red-800 dark:hover:text-red-400 transition-colors"
      title={role === "owner" ? "Relinquish ownership" : "Leave venue"}
    >
      {role === "owner" ? "Relinquish" : "Leave"}
    </button>
  );
}
