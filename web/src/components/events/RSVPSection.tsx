"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RSVPButton } from "./RSVPButton";
import { CancelRSVPModal } from "./CancelRSVPModal";

interface RSVPSectionProps {
  eventId: string;
  eventTitle: string;
  capacity: number | null;
  initialConfirmedCount: number;
}

export function RSVPSection({
  eventId,
  eventTitle,
  capacity,
  initialConfirmedCount,
}: RSVPSectionProps) {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [hasRsvp, setHasRsvp] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [cancelTriggered, setCancelTriggered] = useState(false);

  // Check if user has RSVP and if cancel param is present
  useEffect(() => {
    const checkRsvpAndCancelParam = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      if (session) {
        // Check if user has an active RSVP
        const res = await fetch(`/api/events/${eventId}/rsvp`);
        if (res.ok) {
          const data = await res.json();
          const hasActiveRsvp = data && (data.status === "confirmed" || data.status === "waitlist");
          setHasRsvp(hasActiveRsvp);

          // Auto-open cancel modal if ?cancel=true and user has RSVP
          const cancelParam = searchParams.get("cancel");
          if (cancelParam === "true" && hasActiveRsvp && !cancelTriggered) {
            setShowCancelModal(true);
            setCancelTriggered(true);
          }
        }
      }
    };

    checkRsvpAndCancelParam();
  }, [eventId, searchParams, supabase.auth, cancelTriggered]);

  const handleCancelSuccess = () => {
    setHasRsvp(false);
  };

  // Show warning if trying to cancel without being logged in
  if (searchParams.get("cancel") === "true" && isLoggedIn === false) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-amber-900/30 border border-amber-700/50 rounded-xl">
          <p className="text-amber-300 font-medium mb-2">Login Required</p>
          <p className="text-amber-400/80 text-sm mb-3">
            Please log in to cancel your RSVP.
          </p>
          <a
            href={`/login?redirectTo=/events/${eventId}?cancel=true`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-medium rounded-lg transition-colors text-sm"
          >
            Log In
          </a>
        </div>
        <RSVPButton
          eventId={eventId}
          capacity={capacity}
          initialConfirmedCount={initialConfirmedCount}
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
            You don&apos;t have an active RSVP for this event. You may have already cancelled.
          </p>
        </div>
        <RSVPButton
          eventId={eventId}
          capacity={capacity}
          initialConfirmedCount={initialConfirmedCount}
        />
      </div>
    );
  }

  return (
    <>
      <RSVPButton
        eventId={eventId}
        capacity={capacity}
        initialConfirmedCount={initialConfirmedCount}
      />
      <CancelRSVPModal
        eventId={eventId}
        eventTitle={eventTitle}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onSuccess={handleCancelSuccess}
      />
    </>
  );
}
