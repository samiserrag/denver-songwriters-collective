"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatTimeRemaining } from "@/lib/waitlistOfferClient";

interface RSVPButtonProps {
  eventId: string;
  capacity: number | null;
  initialConfirmedCount?: number;
}

interface RSVPData {
  id: string;
  status: "confirmed" | "waitlist" | "cancelled" | "offered";
  waitlist_position: number | null;
  offer_expires_at: string | null;
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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
        // Show success animation
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to RSVP");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    setError("");
    setShowCancelConfirm(false);

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

  const handleConfirmOffer = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "PATCH",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm");
      }

      setRsvp(data);
      setConfirmedCount((prev) => prev + 1);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm offer");
    } finally {
      setLoading(false);
    }
  };

  if (isLoggedIn === null) {
    return (
      <div className="animate-pulse">
        <div className="h-12 w-32 bg-[var(--color-bg-tertiary)] rounded-lg"></div>
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
            <span className="text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-primary)] font-medium">{remaining}</span> of{" "}
              {capacity} spots remaining
            </span>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {rsvp?.status === "confirmed" ? (
        <div className="space-y-2">
          <div
            className={`flex items-center gap-3 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-xl transition-all duration-300 ${
              showSuccess ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[var(--color-background)]" : ""
            }`}
          >
            <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center ${
              showSuccess ? "animate-bounce" : ""
            }`}>
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-emerald-300 font-semibold">You&apos;re going!</p>
              <p className="text-emerald-400/70 text-sm">We&apos;ll see you there</p>
            </div>
          </div>

          {showSuccess && (
            <p className="text-emerald-400 text-sm animate-fade-in">
              ✨ RSVP confirmed! Check your email for details.
            </p>
          )}

          {showCancelConfirm ? (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
              <p className="text-red-300 text-sm flex-1">Cancel your RSVP?</p>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-[var(--color-text-primary)] rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Yes"}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={loading}
                className="px-3 py-1 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-md transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={loading}
              className="text-sm text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
            >
              Cancel RSVP
            </button>
          )}
        </div>
      ) : rsvp?.status === "offered" ? (
        <div className="space-y-3">
          <div className="p-4 bg-amber-900/40 border-2 border-amber-500/60 rounded-xl animate-pulse-slow">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-amber-300 font-semibold">A Spot is Available!</p>
                <p className="text-amber-400/80 text-sm">
                  Confirm within{" "}
                  <span className="font-semibold">{formatTimeRemaining(rsvp.offer_expires_at)}</span>
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirmOffer}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-[var(--color-text-primary)] font-semibold rounded-xl transition-all disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Confirming...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Confirm My Spot
              </>
            )}
          </button>

          {showCancelConfirm ? (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
              <p className="text-red-300 text-sm flex-1">Decline this offer?</p>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-[var(--color-text-primary)] rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Yes"}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={loading}
                className="px-3 py-1 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-md transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={loading}
              className="text-sm text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
            >
              Decline offer
            </button>
          )}
        </div>
      ) : rsvp?.status === "waitlist" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-4 bg-amber-900/30 border border-amber-700/50 rounded-xl">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-300 font-semibold">
                On waitlist{" "}
                {rsvp.waitlist_position && (
                  <span className="text-amber-400/80 font-normal">(#{rsvp.waitlist_position})</span>
                )}
              </p>
              <p className="text-amber-400/70 text-sm">
                We&apos;ll notify you if a spot opens
              </p>
            </div>
          </div>

          {showCancelConfirm ? (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
              <p className="text-red-300 text-sm flex-1">Leave the waitlist?</p>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-[var(--color-text-primary)] rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Yes"}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={loading}
                className="px-3 py-1 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-md transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={loading}
              className="text-sm text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
            >
              Leave waitlist
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleRSVP}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all disabled:opacity-50 shadow-sm ${
            isFull
              ? "bg-amber-600 hover:bg-amber-500 text-[var(--color-text-primary)]"
              : "bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)]"
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </>
          ) : isFull ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Join Waitlist
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              RSVP Now
            </>
          )}
        </button>
      )}

      {!isLoggedIn && (
        <p className="text-[var(--color-text-tertiary)] text-xs">You&apos;ll need to log in to RSVP</p>
      )}
    </div>
  );
}
