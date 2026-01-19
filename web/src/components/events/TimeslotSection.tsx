"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";
import { GuestTimeslotClaimForm } from "./GuestTimeslotClaimForm";

type DBTimeslot = Database["public"]["Tables"]["event_timeslots"]["Row"];
type DBTimeslotClaim = Database["public"]["Tables"]["timeslot_claims"]["Row"];

interface TimeslotClaim extends DBTimeslotClaim {
  // Joined profile data
  member?: {
    id: string;
    slug: string | null;
    full_name: string | null;
  } | null;
}

interface TimeslotWithClaim extends DBTimeslot {
  claim?: TimeslotClaim | null;
}

interface TimeslotSectionProps {
  eventId: string;
  eventStartTime: string | null;
  totalSlots: number;
  slotDuration: number;
  /** When true, prevents claiming (for cancelled/past/draft events) */
  disabled?: boolean;
  /** Phase ABC6: date_key for per-occurrence timeslot scoping */
  dateKey?: string;
}

export function TimeslotSection({
  eventId,
  eventStartTime,
  totalSlots,
  slotDuration,
  disabled = false,
  dateKey,
}: TimeslotSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [timeslots, setTimeslots] = React.useState<TimeslotWithClaim[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pendingSlotId, setPendingSlotId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [guestClaimingSlotId, setGuestClaimingSlotId] = React.useState<string | null>(null);

  // Fetch timeslots and claims
  React.useEffect(() => {
    async function fetchTimeslots() {
      setLoading(true);

      // Fetch timeslots for this event
      // Phase ABC6: Filter by date_key when provided for per-occurrence scoping
      let query = supabase
        .from("event_timeslots")
        .select("*")
        .eq("event_id", eventId);

      if (dateKey) {
        query = query.eq("date_key", dateKey);
      }

      const { data: slots, error: slotsError } = await query.order("slot_index", { ascending: true });

      if (slotsError) {
        console.error("Error fetching timeslots:", slotsError);
        setLoading(false);
        return;
      }

      if (!slots || slots.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch claims for these timeslots (including guest claims)
      const slotIds = slots.map((s: DBTimeslot) => s.id);
      const { data: claims, error: claimsError } = await supabase
        .from("timeslot_claims")
        .select(`
          *,
          member:profiles!timeslot_claims_member_id_fkey(id, slug, full_name)
        `)
        .in("timeslot_id", slotIds)
        .not("status", "in", "(cancelled,no_show)");

      if (claimsError) {
        console.error("Error fetching claims:", claimsError);
      }

      // Map claims to their slots
      const claimsBySlot = new Map<string, TimeslotClaim>();
      ((claims || []) as TimeslotClaim[]).forEach(claim => {
        // Only track confirmed claims for display (not waitlist)
        if (claim.status === "confirmed" || claim.status === "performed") {
          claimsBySlot.set(claim.timeslot_id, claim);
        }
      });

      const slotsWithClaims: TimeslotWithClaim[] = (slots as DBTimeslot[]).map(slot => ({
        ...slot,
        claim: claimsBySlot.get(slot.id) || null,
      }));

      setTimeslots(slotsWithClaims);
      setLoading(false);
    }

    fetchTimeslots();
  }, [eventId, supabase, dateKey]);

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
    const { data: newClaim, error: claimError } = await supabase
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
      .single();

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
    const { error: updateError } = await supabase
      .from("timeslot_claims")
      .update({ status: "cancelled" })
      .eq("id", slot.claim.id)
      .eq("member_id", user.id);

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

  const claimedCount = timeslots.filter(s => s.claim?.status === "confirmed").length;
  const openCount = timeslots.length - claimedCount;

  return (
    <section id="lineup" className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-[var(--font-family-serif)] text-2xl text-[var(--color-text-primary)]">
          Tonight&apos;s Lineup
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {claimedCount} performer{claimedCount !== 1 ? "s" : ""} signed up
          {openCount > 0 && ` • ${openCount} slot${openCount !== 1 ? "s" : ""} available`}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-800 dark:text-red-500 bg-red-100 dark:bg-red-500/10 px-3 py-2 rounded-lg text-center">{error}</p>
      )}

      {userHasSlot && (
        <div className="flex items-center justify-center gap-2 text-[var(--color-text-accent)] bg-[var(--color-accent-primary)]/10 px-4 py-2 rounded-lg">
          <span>🎤</span>
          <p className="font-medium">You&apos;re on the lineup!</p>
        </div>
      )}

      {/* Open slots CTA - show once at top if there are open slots and user doesn't have one */}
      {openCount > 0 && !userHasSlot && !authLoading && !guestClaimingSlotId && (
        <div className="text-center py-3 px-4 rounded-lg border-2 border-dashed border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/5">
          <p className="text-lg font-medium text-[var(--color-text-primary)]">
            Want to perform? Claim a slot below!
          </p>
        </div>
      )}

      {/* Slots grid - compact layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {timeslots.map((slot) => {
          const isClaimed = slot.claim?.status === "confirmed" || slot.claim?.status === "performed";
          const isMine = user && slot.claim?.member_id === user.id;
          const isPending = pendingSlotId === slot.id;

          // Check if this is a guest claim (no member, but has guest_name)
          const isGuestClaim = isClaimed && !slot.claim?.member_id && slot.claim?.guest_name;
          const displayName = slot.claim?.member?.full_name || slot.claim?.guest_name;

          // Claimed slots - celebrate the performer
          if (isClaimed && displayName) {
            return (
              <div
                key={slot.id}
                className={cn(
                  "rounded-lg border p-3 text-center transition-all",
                  isMine
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10"
                    : "border-[var(--color-border-accent)]/50 bg-[var(--color-bg-surface)]"
                )}
              >
                {/* Time - prominent */}
                <p className="text-lg font-bold text-[var(--color-text-accent)] mb-1">
                  {formatSlotTime(slot).split(" - ")[0]}
                </p>

                {/* Performer name */}
                {isMine ? (
                  <div>
                    <p className="text-base font-semibold text-[var(--color-text-accent)] font-[var(--font-family-serif)] italic">
                      You!
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleUnclaim(slot.id)}
                      className="mt-2 text-xs"
                    >
                      {isPending ? "..." : "Release"}
                    </Button>
                  </div>
                ) : isGuestClaim ? (
                  // Guest claim - show name with (guest) label, no link
                  <p className="text-base font-semibold text-[var(--color-text-accent)] font-[var(--font-family-serif)] italic">
                    {displayName}
                    <span className="text-xs font-normal text-[var(--color-text-tertiary)]"> (guest)</span>
                  </p>
                ) : slot.claim?.member ? (
                  <Link
                    href={`/songwriters/${slot.claim.member.slug || slot.claim.member.id}`}
                    className="group block"
                  >
                    <p className="text-base font-semibold text-[var(--color-text-accent)] font-[var(--font-family-serif)] italic group-hover:underline">
                      {displayName}
                    </p>
                  </Link>
                ) : null}
              </div>
            );
          }

          // Open slots - simple and compact
          const isGuestClaiming = guestClaimingSlotId === slot.id;

          return (
            <div
              key={slot.id}
              className={cn(
                "rounded-lg border p-3 text-center transition-all",
                isGuestClaiming
                  ? "border-[var(--color-accent-primary)] bg-[var(--color-bg-surface)]"
                  : "border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]/30 hover:border-[var(--color-accent-primary)]/50 hover:bg-[var(--color-bg-secondary)]",
                userHasSlot && !isGuestClaiming && "opacity-40"
              )}
            >
              {isGuestClaiming ? (
                <GuestTimeslotClaimForm
                  eventId={eventId}
                  timeslotId={slot.id}
                  slotLabel={formatSlotTime(slot).split(" - ")[0]}
                  onClaimSuccess={() => {
                    setGuestClaimingSlotId(null);
                    // Refetch timeslots to show the new claim
                    window.location.reload();
                  }}
                  onCancel={() => setGuestClaimingSlotId(null)}
                  dateKey={dateKey}
                />
              ) : (
                <>
                  {/* Time - prominent */}
                  <p className="text-lg font-bold text-[var(--color-text-secondary)] mb-2">
                    {formatSlotTime(slot).split(" - ")[0]}
                  </p>

                  {/* Claim button */}
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={disabled || isPending || userHasSlot}
                    onClick={() => {
                      if (user) {
                        handleClaim(slot.id);
                      } else {
                        // Show guest claim form instead of redirecting to login
                        setGuestClaimingSlotId(slot.id);
                      }
                    }}
                    className="w-full text-xs"
                  >
                    {isPending ? "..." : disabled ? "Unavailable" : "Claim"}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)] text-center">
        {slotDuration} min each • First come, first served
      </p>
    </section>
  );
}
