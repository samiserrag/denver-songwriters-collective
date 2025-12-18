"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

// Inline types until database.types.ts is regenerated
interface Timeslot {
  id: string;
  event_id: string;
  slot_index: number;
  start_offset_minutes: number | null;
  duration_minutes: number;
  created_at: string | null;
}

interface TimeslotClaim {
  id: string;
  timeslot_id: string;
  member_id: string | null;
  guest_name: string | null;
  status: "confirmed" | "offered" | "waitlist" | "cancelled" | "no_show" | "performed";
  offer_expires_at: string | null;
  waitlist_position: number | null;
  claimed_at: string | null;
  // Joined profile data
  member?: {
    id: string;
    full_name: string | null;
  };
}

interface TimeslotWithClaim extends Timeslot {
  claim?: TimeslotClaim | null;
}

interface TimeslotSectionProps {
  eventId: string;
  eventStartTime: string | null;
  totalSlots: number;
  slotDuration: number;
}

export function TimeslotSection({
  eventId,
  eventStartTime,
  totalSlots,
  slotDuration,
}: TimeslotSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [timeslots, setTimeslots] = React.useState<TimeslotWithClaim[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pendingSlotId, setPendingSlotId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch timeslots and claims
  React.useEffect(() => {
    async function fetchTimeslots() {
      setLoading(true);

      // Fetch timeslots for this event
      // Note: Using type assertion until database.types.ts is regenerated with event_timeslots table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: slots, error: slotsError } = await (supabase as any)
        .from("event_timeslots")
        .select("*")
        .eq("event_id", eventId)
        .order("slot_index", { ascending: true }) as { data: Timeslot[] | null; error: Error | null };

      if (slotsError) {
        console.error("Error fetching timeslots:", slotsError);
        setLoading(false);
        return;
      }

      if (!slots || slots.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch claims for these timeslots
      const slotIds = slots.map((s: Timeslot) => s.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: claims, error: claimsError } = await (supabase as any)
        .from("timeslot_claims")
        .select(`
          *,
          member:profiles!timeslot_claims_member_id_fkey(id, full_name)
        `)
        .in("timeslot_id", slotIds)
        .not("status", "in", "(cancelled,no_show)") as { data: TimeslotClaim[] | null; error: Error | null };

      if (claimsError) {
        console.error("Error fetching claims:", claimsError);
      }

      // Map claims to their slots
      const claimsBySlot = new Map<string, TimeslotClaim>();
      (claims || []).forEach((claim: TimeslotClaim) => {
        // Only track confirmed claims for display (not waitlist)
        if (claim.status === "confirmed" || claim.status === "performed") {
          claimsBySlot.set(claim.timeslot_id, claim);
        }
      });

      const slotsWithClaims: TimeslotWithClaim[] = slots.map(slot => ({
        ...slot,
        claim: claimsBySlot.get(slot.id) || null,
      }));

      setTimeslots(slotsWithClaims);
      setLoading(false);
    }

    fetchTimeslots();
  }, [eventId, supabase]);

  const handleRequireAuth = React.useCallback(() => {
    const redirectTo = pathname || `/events/${eventId}`;
    router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }, [router, pathname, eventId]);

  const handleClaim = async (timeslotId: string) => {
    if (!user) {
      handleRequireAuth();
      return;
    }

    setError(null);
    setPendingSlotId(timeslotId);

    // Check if slot is already claimed
    const slot = timeslots.find(s => s.id === timeslotId);
    if (slot?.claim && slot.claim.status === "confirmed") {
      setError("This slot is already taken.");
      setPendingSlotId(null);
      return;
    }

    // Insert a new claim
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newClaim, error: claimError } = await (supabase as any)
      .from("timeslot_claims")
      .insert({
        timeslot_id: timeslotId,
        member_id: user.id,
        status: "confirmed",
      })
      .select(`
        *,
        member:profiles!timeslot_claims_member_id_fkey(id, full_name)
      `)
      .single() as { data: TimeslotClaim | null; error: { code?: string; message?: string } | null };

    setPendingSlotId(null);

    if (claimError) {
      if (claimError.code === "23505") {
        setError("This slot was just claimed by someone else.");
      } else {
        setError(claimError.message || "Unable to claim slot.");
      }
      return;
    }

    // Update local state
    setTimeslots(prev =>
      prev.map(slot =>
        slot.id === timeslotId
          ? { ...slot, claim: newClaim as TimeslotClaim }
          : slot
      )
    );
  };

  const handleUnclaim = async (timeslotId: string) => {
    if (!user) return;

    setError(null);
    setPendingSlotId(timeslotId);

    const slot = timeslots.find(s => s.id === timeslotId);
    if (!slot?.claim) {
      setPendingSlotId(null);
      return;
    }

    // Update claim status to cancelled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("timeslot_claims")
      .update({ status: "cancelled" })
      .eq("id", slot.claim.id)
      .eq("member_id", user.id) as { error: { message?: string } | null };

    setPendingSlotId(null);

    if (updateError) {
      setError(updateError.message || "Unable to release slot.");
      return;
    }

    // Update local state
    setTimeslots(prev =>
      prev.map(s =>
        s.id === timeslotId ? { ...s, claim: null } : s
      )
    );
  };

  // Calculate slot time from offset
  const formatSlotTime = (slot: TimeslotWithClaim) => {
    if (!eventStartTime || slot.start_offset_minutes === null) {
      return `Slot ${slot.slot_index + 1}`;
    }

    // Parse event start time (HH:MM or HH:MM:SS)
    const [hours, minutes] = eventStartTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes + slot.start_offset_minutes;
    const endMinutes = startMinutes + slot.duration_minutes;

    const formatTime = (totalMins: number) => {
      const h = Math.floor(totalMins / 60) % 24;
      const m = totalMins % 60;
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
    };

    return `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)]">
          Performance Slots
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: Math.min(totalSlots, 6) }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse h-20 bg-[var(--color-bg-tertiary)] rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (timeslots.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-default)]">
        <p className="text-[var(--color-text-secondary)] text-sm">
          Performance slots will be available soon.
        </p>
      </div>
    );
  }

  const userHasSlot = timeslots.some(
    s => s.claim?.member_id === user?.id && s.claim?.status === "confirmed"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)]">
          Performance Slots
        </h2>
        {!authLoading && !user && (
          <button
            type="button"
            onClick={handleRequireAuth}
            className="text-sm text-[var(--color-text-accent)] hover:underline"
          >
            Log in to claim a slot
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {userHasSlot && (
        <p className="text-sm text-[var(--color-text-accent)]">
          You have a slot! See below for your time.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {timeslots.map((slot) => {
          const isClaimed = slot.claim?.status === "confirmed" || slot.claim?.status === "performed";
          const isMine = user && slot.claim?.member_id === user.id;
          const isPending = pendingSlotId === slot.id;

          return (
            <div
              key={slot.id}
              className={cn(
                "flex items-center justify-between gap-4 p-4 rounded-lg border transition-all",
                "bg-[var(--color-bg-secondary)] border-[var(--color-border-default)]",
                isMine && "border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10",
                isClaimed && !isMine && "opacity-60"
              )}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                    Slot {slot.slot_index + 1}
                  </span>
                  {isMine && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)]">
                      Your slot
                    </span>
                  )}
                  {isClaimed && !isMine && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                      Taken
                    </span>
                  )}
                </div>

                <p className="font-medium text-[var(--color-text-primary)]">
                  {formatSlotTime(slot)}
                </p>

                {isClaimed && slot.claim?.member?.full_name && (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {isMine ? "You" : slot.claim.member.full_name}
                  </p>
                )}
              </div>

              <div className="flex-shrink-0">
                {isMine ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleUnclaim(slot.id)}
                  >
                    {isPending ? "..." : "Release"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isPending || (isClaimed && !isMine) || userHasSlot}
                    onClick={() => handleClaim(slot.id)}
                  >
                    {isClaimed
                      ? "Taken"
                      : userHasSlot
                      ? "1 per person"
                      : isPending
                      ? "..."
                      : "Claim"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)]">
        {slotDuration} minutes per performer. One slot per person. First-come, first-served.
      </p>
    </div>
  );
}
