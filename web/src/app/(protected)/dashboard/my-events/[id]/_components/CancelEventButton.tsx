"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CancelEventButtonProps {
  eventId: string;
}

export default function CancelEventButton({ eventId }: CancelEventButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this event? All RSVPed attendees will be notified.")) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/my-events/${eventId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        router.push("/dashboard/my-events");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to cancel event:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        Cancelling the event will notify all RSVPed attendees and remove it from public listings.
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
