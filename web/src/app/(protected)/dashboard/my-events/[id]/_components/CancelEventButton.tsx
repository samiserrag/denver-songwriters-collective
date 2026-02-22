"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CancelEventButtonProps {
  eventId: string;
  status: string;
  compact?: boolean;
}

export default function CancelEventButton({
  eventId,
  status,
  compact = false,
}: CancelEventButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Cancel this event? It will stay visible as cancelled, attendees will be notified, and RSVPs/timeslots will be disabled.")) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/my-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel event");
      }
    } catch (err) {
      console.error("Failed to cancel event:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/my-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to uncancel event");
      }
    } catch (err) {
      console.error("Failed to uncancel event:", err);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    if (status === "cancelled") {
      return (
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Uncancel"}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-800 dark:text-red-400 rounded transition-colors disabled:opacity-50"
      >
        {loading ? "..." : "Cancel"}
      </button>
    );
  }

  if (status === "cancelled") {
    return (
      <div>
        <p className="text-[var(--color-text-secondary)] text-sm mb-4">
          This event is currently marked as cancelled and remains visible to attendees.
        </p>
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading}
          className="w-full px-4 py-2 bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded border border-emerald-300 dark:border-emerald-500/30 transition-colors disabled:opacity-50"
        >
          {loading ? "Restoring..." : "Uncancel Event"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        Cancelling marks the event as cancelled, notifies attendees, and keeps it visible on the site.
      </p>
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="w-full px-4 py-2 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 text-red-800 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 rounded border border-red-300 dark:border-red-800 transition-colors disabled:opacity-50"
      >
        {loading ? "Cancelling..." : "Cancel Event"}
      </button>
    </div>
  );
}
