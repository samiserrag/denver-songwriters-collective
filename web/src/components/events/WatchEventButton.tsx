"use client";

import { useState } from "react";

interface WatchEventButtonProps {
  eventId: string;
  initialWatching: boolean;
}

/**
 * Phase 4.51d: Admin-only Watch/Unwatch button for event monitoring
 * When watching, admin receives notifications for RSVPs and comments
 * regardless of whether hosts exist.
 */
export function WatchEventButton({ eventId, initialWatching }: WatchEventButtonProps) {
  const [watching, setWatching] = useState(initialWatching);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const method = watching ? "DELETE" : "POST";
      const res = await fetch(`/api/events/${eventId}/watch`, { method });
      const data = await res.json();
      if (res.ok) {
        setWatching(data.watching);
      } else {
        console.error("Watch toggle failed:", data.error);
      }
    } catch (err) {
      console.error("Failed to toggle watch:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="text-sm text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
      title={watching ? "Stop receiving notifications for this event" : "Receive notifications for this event"}
    >
      {loading ? "..." : watching ? "Unwatch event" : "Watch event"}
    </button>
  );
}
