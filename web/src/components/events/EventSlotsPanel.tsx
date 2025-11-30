"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth/useAuth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DBEventSlot = Database["public"]["Tables"]["event_slots"]["Row"];

interface EventSlotsPanelProps {
  eventId: string;
  slots: DBEventSlot[];
}

type SlotWithState = DBEventSlot;

export function EventSlotsPanel({ eventId, slots }: EventSlotsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  const [localSlots, setLocalSlots] = React.useState<SlotWithState[]>(() => slots);
  const [pendingSlotId, setPendingSlotId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const handleRequireAuth = React.useCallback(() => {
    const redirectTo = pathname || `/events/${eventId}`;
    router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }, [router, pathname, eventId]);

  const handleClaim = async (slotId: string) => {
    if (!user) {
      handleRequireAuth();
      return;
    }

    setError(null);
    setPendingSlotId(slotId);

    const { data, error } = await supabase.rpc("rpc_claim_open_mic_slot", {
      slot_id: slotId,
    });

    setPendingSlotId(null);

    if (error) {
      setError(error.message ?? "Unable to claim slot.");
      return;
    }

    if (data) {
      setLocalSlots((prev) =>
        prev.map((slot) => (slot.id === slotId ? (data as DBEventSlot) : slot))
      );
    }
  };

  const handleUnclaim = async (slotId: string) => {
    if (!user) {
      handleRequireAuth();
      return;
    }

    setError(null);
    setPendingSlotId(slotId);

    const { data, error } = await supabase.rpc("rpc_unclaim_open_mic_slot", {
      slot_id: slotId,
    });

    setPendingSlotId(null);

    if (error) {
      setError(error.message ?? "Unable to release slot.");
      return;
    }

    if (data) {
      setLocalSlots((prev) =>
        prev.map((slot) => (slot.id === slotId ? (data as DBEventSlot) : slot))
      );
    }
  };

  const formatTime = (t: string | null) => {
    if (!t) return "";
    // Expecting "HH:MM:SS" or "HH:MM"
    return t.length >= 5 ? t.slice(0, 5) : t;
  };

  if (!localSlots || localSlots.length === 0) {
    return null;
  }

  return (
    <section className="mt-10 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[length:var(--font-size-heading-md)] font-[var(--font-family-serif)] italic text-[var(--color-gold)]">
          Performance Slots
        </h2>
        {!authLoading && !user && (
          <button
            type="button"
            onClick={handleRequireAuth}
            className="text-sm text-[var(--color-gold)] hover:underline"
          >
            Log in to claim a slot
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {localSlots.map((slot) => {
          const isClaimed = !!slot.performer_id;
          const isMine = user && slot.performer_id === user.id;
          const isPending = pendingSlotId === slot.id;

          return (
            <div
              key={slot.id}
              className={cn(
                "card-base flex items-center justify-between gap-4 px-4 py-4 md:px-5 md:py-5",
                "border border-white/8 bg-white/5",
                "transition-all duration-200",
                "hover:border-[var(--color-gold)]/60 hover:shadow-[var(--shadow-glow-gold-sm)]",
                isMine && "border-[var(--color-gold)] bg-[var(--color-gold)]/5",
                isClaimed && !isMine && "opacity-70"
              )}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-warm-gray-light)]">
                    Slot {slot.slot_index}
                  </span>
                  {isMine && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-gold)]/20 text-[var(--color-gold)]">
                      Your slot
                    </span>
                  )}
                  {isClaimed && !isMine && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/10 text-[var(--color-warm-gray-light)]">
                      Taken
                    </span>
                  )}
                </div>

                <p className="font-medium text-[var(--color-warm-white)]">
                  {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                </p>
                <p className="text-xs text-[var(--color-warm-gray-light)]">
                  First-come, first-served • One slot per performer
                </p>
              </div>

              <div className="flex-shrink-0">
                {isMine ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleUnclaim(slot.id)}
                    className="text-xs"
                  >
                    {isPending ? "Releasing..." : "Release"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isPending || (isClaimed && !isMine)}
                    onClick={() => handleClaim(slot.id)}
                    className="text-xs"
                  >
                    {isClaimed && !isMine
                      ? "Taken"
                      : isPending
                      ? "Claiming..."
                      : "Claim slot"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
