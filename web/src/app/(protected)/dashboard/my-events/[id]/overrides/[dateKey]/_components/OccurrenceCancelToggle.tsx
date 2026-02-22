"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OccurrenceCancelToggleProps {
  eventId: string;
  dateKey: string;
  isCancelled: boolean;
}

export default function OccurrenceCancelToggle({
  eventId,
  dateKey,
  isCancelled,
}: OccurrenceCancelToggleProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!isCancelled) {
      const confirmed = confirm(
        "Cancel this occurrence? Attending people for this date will be notified. The event series stays visible."
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/my-events/${eventId}/overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_key: dateKey,
          status: isCancelled ? "normal" : "cancelled",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update occurrence status");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to toggle occurrence status:", error);
      alert("Failed to update occurrence status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={
        isCancelled
          ? "px-3 py-1.5 text-sm bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded transition-colors disabled:opacity-50"
          : "px-3 py-1.5 text-sm bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-800 dark:text-red-400 rounded transition-colors disabled:opacity-50"
      }
    >
      {loading ? "..." : isCancelled ? "Uncancel Occurrence" : "Cancel Occurrence"}
    </button>
  );
}
