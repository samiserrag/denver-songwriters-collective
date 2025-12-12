"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface RSVPButtonProps {
  eventId: string;
  capacity: number | null;
  initialConfirmedCount?: number;
}

interface RSVPData {
  id: string;
  status: "confirmed" | "waitlist" | "cancelled";
  waitlist_position: number | null;
}

export function RSVPButton({
  eventId,
  capacity,
  initialConfirmedCount = 0,
}: RSVPButtonProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [rsvp, setRsvp] = useState<RSVPData | null>(null);
  const [confirmedCount, setConfirmedCount] = useState(initialConfirmedCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const remaining =
    capacity !== null ? Math.max(0, capacity - confirmedCount) : null;
  const isFull = remaining !== null && remaining === 0;

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      if (session) {
        const res = await fetch(`/api/events/${eventId}/rsvp`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status) {
            setRsvp(data);
          }
        }
      }
    };
    init();
  }, [eventId, supabase.auth]);

  const handleRSVP = async () => {
    if (!isLoggedIn) {
      router.push(`/login?redirectTo=/events/${eventId}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to RSVP");
      }

      setRsvp(data);
      if (data.status === "confirmed") {
        setConfirmedCount((prev) => prev + 1);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to RSVP");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your RSVP?")) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel");
      }

      const wasConfirmed = rsvp?.status === "confirmed";
      setRsvp(null);
      if (wasConfirmed) {
        setConfirmedCount((prev) => Math.max(0, prev - 1));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setLoading(false);
    }
  };

  if (isLoggedIn === null) {
    return (
      <div className="animate-pulse">
        <div className="h-12 w-32 bg-neutral-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {capacity !== null && (
        <div className="text-sm">
          {isFull ? (
            <span className="text-amber-400 font-medium">
              Event is full - Waitlist available
            </span>
          ) : (
            <span className="text-neutral-400">
              <span className="text-white font-medium">{remaining}</span> of{" "}
              {capacity} spots remaining
            </span>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {rsvp?.status === "confirmed" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-700 rounded-lg">
            <span className="text-green-400 text-xl">&#10003;</span>
            <div>
              <p className="text-green-300 font-medium">You're going!</p>
              <p className="text-green-400/70 text-xs">We'll see you there</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="text-sm text-neutral-400 hover:text-red-400 transition-colors"
          >
            {loading ? "Cancelling..." : "Cancel RSVP"}
          </button>
        </div>
      ) : rsvp?.status === "waitlist" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-amber-900/30 border border-amber-700 rounded-lg">
            <span className="text-amber-400 text-xl">&#8987;</span>
            <div>
              <p className="text-amber-300 font-medium">
                On waitlist{" "}
                {rsvp.waitlist_position && `(#${rsvp.waitlist_position})`}
              </p>
              <p className="text-amber-400/70 text-xs">
                We'll notify you if a spot opens
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="text-sm text-neutral-400 hover:text-red-400 transition-colors"
          >
            {loading ? "Removing..." : "Leave waitlist"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleRSVP}
          disabled={loading}
          className={`px-6 py-3 font-semibold rounded-lg transition-all disabled:opacity-50 ${
            isFull
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-gold-400 hover:bg-gold-300 text-black"
          }`}
        >
          {loading ? "Processing..." : isFull ? "Join Waitlist" : "RSVP Now"}
        </button>
      )}

      {!isLoggedIn && (
        <p className="text-neutral-500 text-xs">You'll need to log in to RSVP</p>
      )}
    </div>
  );
}
