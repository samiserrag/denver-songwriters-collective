"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RSVPButton } from "./RSVPButton";
import { CancelRSVPModal } from "./CancelRSVPModal";

interface RSVPSectionProps {
  eventId: string;
  eventTitle: string;
  capacity: number | null;
  initialConfirmedCount: number;
  /** Phase ABC6: date_key for per-occurrence RSVP scoping */
  dateKey?: string;
}

export function RSVPSection({
  eventId,
  eventTitle,
  capacity,
  initialConfirmedCount,
  dateKey,
}: RSVPSectionProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [hasRsvp, setHasRsvp] = useState(false);
  const [hasOffer, setHasOffer] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [cancelTriggered, setCancelTriggered] = useState(false);
  const [confirmTriggered, setConfirmTriggered] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  // Phase ABC6: Build API URL with optional date_key
  const buildRsvpUrl = useCallback((base: string) => {
    if (dateKey) {
      return `${base}?date_key=${dateKey}`;
    }
    return base;
  }, [dateKey]);

  // Auto-confirm offer when ?confirm=true is present
  const handleAutoConfirm = useCallback(async () => {
    if (confirmTriggered || confirmLoading) return;
    setConfirmTriggered(true);
    setConfirmLoading(true);
    setConfirmError("");

    try {
      const res = await fetch(buildRsvpUrl(`/api/events/${eventId}/rsvp`), {
        method: "PATCH",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm offer");
      }

      setConfirmSuccess(true);
      setHasRsvp(true);
      setHasOffer(false);
      router.refresh();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Failed to confirm offer");
    } finally {
      setConfirmLoading(false);
    }
  }, [eventId, confirmTriggered, confirmLoading, router, buildRsvpUrl]);

  // Phase ABC6 Fix: Clear RSVP state immediately when dateKey changes
  // This prevents stale state when navigating between occurrences
  useEffect(() => {
    setHasRsvp(false);
    setHasOffer(false);
  }, [dateKey]);

  // Check if user has RSVP and if cancel/confirm param is present
  useEffect(() => {
    const checkRsvpAndParams = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      if (session) {
        // Check if user has an active RSVP
        // Phase ABC6: Include date_key in query
        const res = await fetch(buildRsvpUrl(`/api/events/${eventId}/rsvp`));
        if (res.ok) {
          const data = await res.json();
          const hasActiveRsvp = data && (data.status === "confirmed" || data.status === "waitlist" || data.status === "offered");
          const hasOfferStatus = data && data.status === "offered";
          setHasRsvp(hasActiveRsvp);
          setHasOffer(hasOfferStatus);

          // Auto-open cancel modal if ?cancel=true and user has RSVP
          const cancelParam = searchParams.get("cancel");
          if (cancelParam === "true" && hasActiveRsvp && !cancelTriggered) {
            setShowCancelModal(true);
            setCancelTriggered(true);
          }

          // Auto-confirm if ?confirm=true and user has offer
          const confirmParam = searchParams.get("confirm");
          if (confirmParam === "true" && hasOfferStatus && !confirmTriggered) {
            handleAutoConfirm();
          }
        }
      }
    };

    checkRsvpAndParams();
  }, [eventId, searchParams, supabase.auth, cancelTriggered, confirmTriggered, handleAutoConfirm, buildRsvpUrl]);

  const handleCancelSuccess = () => {
    setHasRsvp(false);
  };

  // Show login prompt if trying to confirm/cancel without being logged in
  const needsLogin = searchParams.get("cancel") === "true" || searchParams.get("confirm") === "true";
  if (needsLogin && isLoggedIn === false) {
    const action = searchParams.get("confirm") === "true" ? "confirm your spot" : "cancel your RSVP";
    const redirectParam = searchParams.get("confirm") === "true" ? "confirm=true" : "cancel=true";
    return (
      <div className="space-y-4">
        <div className="p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700/50 rounded-xl">
          <p className="text-amber-800 dark:text-amber-300 font-medium mb-2">Login Required</p>
          <p className="text-amber-700 dark:text-amber-400/80 text-sm mb-3">
            Please log in to {action}.
          </p>
          <a
            href={`/login?redirectTo=/events/${eventId}?${redirectParam}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] font-medium rounded-lg transition-colors text-sm"
          >
            Log In
          </a>
        </div>
        <RSVPButton
          eventId={eventId}
          capacity={capacity}
          initialConfirmedCount={initialConfirmedCount}
          dateKey={dateKey}
        />
      </div>
    );
  }

  // Show success message after confirming via URL
  if (confirmSuccess) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-emerald-300 font-semibold">Spot Confirmed!</p>
              <p className="text-emerald-400/80 text-sm">Your spot has been secured. We&apos;ll see you there!</p>
            </div>
          </div>
        </div>
        <RSVPButton
          eventId={eventId}
          capacity={capacity}
          initialConfirmedCount={initialConfirmedCount}
          dateKey={dateKey}
        />
      </div>
    );
  }

  // Show error if confirm failed (e.g., offer expired)
  if (confirmError) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700/50 rounded-xl">
          <p className="text-red-800 dark:text-red-300 font-medium mb-1">Could Not Confirm</p>
          <p className="text-red-700 dark:text-red-400/80 text-sm">{confirmError}</p>
        </div>
        <RSVPButton
          eventId={eventId}
          capacity={capacity}
          initialConfirmedCount={initialConfirmedCount}
          dateKey={dateKey}
        />
      </div>
    );
  }

  // Show loading while confirming via URL
  if (confirmLoading) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700/50 rounded-xl animate-pulse">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-700 dark:text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-800 dark:text-amber-300 font-semibold">Confirming Your Spot...</p>
              <p className="text-amber-700 dark:text-amber-400/80 text-sm">Please wait</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show warning if confirm param present but no offer
  if (searchParams.get("confirm") === "true" && isLoggedIn && !hasOffer && confirmTriggered && !confirmSuccess) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-xl">
          <p className="text-[var(--color-text-primary)] font-medium mb-1">No Pending Offer</p>
          <p className="text-[var(--color-text-secondary)] text-sm">
            You don&apos;t have a pending spot offer for this happening. The offer may have expired or been used.
          </p>
        </div>
        <RSVPButton
          eventId={eventId}
          capacity={capacity}
          initialConfirmedCount={initialConfirmedCount}
          dateKey={dateKey}
        />
      </div>
    );
  }

  // Show warning if cancel param present but no RSVP
  if (searchParams.get("cancel") === "true" && isLoggedIn && !hasRsvp && cancelTriggered) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-xl">
          <p className="text-[var(--color-text-primary)] font-medium mb-1">No RSVP Found</p>
          <p className="text-[var(--color-text-secondary)] text-sm">
            You don&apos;t have an active RSVP for this happening. You may have already cancelled.
          </p>
        </div>
        <RSVPButton
          eventId={eventId}
          capacity={capacity}
          initialConfirmedCount={initialConfirmedCount}
          dateKey={dateKey}
        />
      </div>
    );
  }

  return (
    <section id="rsvp" className="space-y-2">
      <RSVPButton
        eventId={eventId}
        capacity={capacity}
        initialConfirmedCount={initialConfirmedCount}
        dateKey={dateKey}
      />
      {/* Phase 4.43: RSVP meaning clarification */}
      <p className="text-xs text-[var(--color-text-secondary)]">
        RSVP means you plan to attend. It is not a performer sign-up.
      </p>
      <CancelRSVPModal
        eventId={eventId}
        eventTitle={eventTitle}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onSuccess={handleCancelSuccess}
        dateKey={dateKey}
      />
    </section>
  );
}
