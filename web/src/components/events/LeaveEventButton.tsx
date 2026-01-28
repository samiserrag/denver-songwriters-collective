"use client";

/**
 * LeaveEventButton
 *
 * Allows hosts and co-hosts to step down from an event.
 * Two-step confirmation pattern: first click shows confirm/cancel buttons.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  eventId: string;
  eventTitle: string;
  userRole: "host" | "cohost";
  userId: string;
  /** If true, shows a warning that the event will become unhosted */
  isSoleHost?: boolean;
}

export function LeaveEventButton({
  eventId,
  eventTitle,
  userRole,
  userId,
  isSoleHost = false,
}: Props) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to leave event");
        setIsLoading(false);
        return;
      }

      // Redirect to my-events dashboard after successful leave
      router.push("/dashboard/my-events");
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Leave event error:", err);
      setIsLoading(false);
    }
  };

  const roleLabel = userRole === "host" ? "host" : "co-host";

  if (isConfirming) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg space-y-3">
        <p className="text-sm text-red-800 dark:text-red-300">
          Are you sure you want to leave &ldquo;{eventTitle}&rdquo; as {roleLabel}?
        </p>
        {isSoleHost && userRole === "host" && (
          <p className="text-sm text-red-800 dark:text-red-300 font-medium">
            ⚠️ You are the only host. The event will become unhosted and appear as unclaimed.
          </p>
        )}
        {!isSoleHost && userRole === "host" && (
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Another host will be automatically promoted to primary host.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLeave}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
          >
            {isLoading ? "Leaving..." : "Yes, Leave Event"}
          </button>
          <button
            onClick={() => {
              setIsConfirming(false);
              setError(null);
            }}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsConfirming(true)}
      className="w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg transition-colors"
    >
      Leave Event
    </button>
  );
}
