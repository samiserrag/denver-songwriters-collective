"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui";

interface Performer {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface TimeslotClaim {
  id: string;
  status: string;
  member: Performer | null;
}

interface Timeslot {
  id: string;
  slot_index: number;
  start_offset_minutes: number;
  duration_minutes: number;
  claim: TimeslotClaim | null;
}

interface EventInfo {
  id: string;
  title: string;
  venue_name: string | null;
  start_time: string | null;
  event_date: string | null;
}

interface LineupState {
  current_slot_index: number | null;
  is_live: boolean;
}

function formatSlotTime(startTime: string | null, offsetMinutes: number, durationMinutes: number): string {
  if (!startTime) return "";

  const [hours, minutes] = startTime.split(":").map(Number);
  const startMinutes = hours * 60 + minutes + offsetMinutes;
  const endMinutes = startMinutes + durationMinutes;

  const formatTime = (totalMins: number) => {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  return `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;
}

export default function LineupControlPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [event, setEvent] = React.useState<EventInfo | null>(null);
  const [timeslots, setTimeslots] = React.useState<Timeslot[]>([]);
  const [lineupState, setLineupState] = React.useState<LineupState>({ current_slot_index: null, is_live: false });
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [isAuthorized, setIsAuthorized] = React.useState(false);

  // Check authorization (admin or event host)
  React.useEffect(() => {
    async function checkAuth() {
      if (!user) return;

      // Check if admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "admin") {
        setIsAuthorized(true);
        return;
      }

      // Check if event host via host_id on event
      const { data: eventData } = await supabase
        .from("events")
        .select("host_id")
        .eq("id", eventId)
        .single();

      if (eventData?.host_id === user.id) {
        setIsAuthorized(true);
        return;
      }

      // Also check event_hosts table for co-hosts
      const { data: hostEntry } = await supabase
        .from("event_hosts")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      if (hostEntry) {
        setIsAuthorized(true);
      }
    }

    if (user) checkAuth();
  }, [user, eventId, supabase]);

  // Fetch event data
  const fetchData = React.useCallback(async () => {
    // Fetch event info
    const { data: eventData } = await supabase
      .from("events")
      .select("id, title, venue_name, start_time, event_date")
      .eq("id", eventId)
      .single();

    if (eventData) setEvent(eventData);

    // Fetch timeslots with claims
    const { data: slots } = await supabase
      .from("event_timeslots")
      .select("id, slot_index, start_offset_minutes, duration_minutes")
      .eq("event_id", eventId)
      .order("slot_index", { ascending: true });

    if (slots && slots.length > 0) {
      type SlotRow = { id: string; slot_index: number; start_offset_minutes: number; duration_minutes: number };
      const slotIds = (slots as SlotRow[]).map((s) => s.id);

      const { data: claims } = await supabase
        .from("timeslot_claims")
        .select(`
          id, timeslot_id, status,
          member:profiles!timeslot_claims_member_id_fkey(id, full_name, avatar_url)
        `)
        .in("timeslot_id", slotIds)
        .in("status", ["confirmed", "performed"]);

      type ClaimRow = { id: string; timeslot_id: string; status: string; member: Performer | null };
      const claimsBySlot = new Map<string, TimeslotClaim>();
      ((claims || []) as ClaimRow[]).forEach((claim) => {
        claimsBySlot.set(claim.timeslot_id, {
          id: claim.id,
          status: claim.status,
          member: claim.member,
        });
      });

      const slotsWithClaims = (slots as SlotRow[]).map((slot) => ({
        ...slot,
        claim: claimsBySlot.get(slot.id) || null,
      }));

      setTimeslots(slotsWithClaims);
    }

    // Fetch lineup state
    const { data: state } = await supabase
      .from("event_lineup_state")
      .select("current_slot_index, is_live")
      .eq("event_id", eventId)
      .single();

    if (state) {
      setLineupState(state);
    }

    setLoading(false);
  }, [eventId, supabase]);

  React.useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateLineupState = async (newState: Partial<LineupState>) => {
    setUpdating(true);

    // Upsert lineup state
    const { error } = await supabase
      .from("event_lineup_state")
      .upsert({
        event_id: eventId,
        ...lineupState,
        ...newState,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "event_id",
      });

    if (error) {
      console.error("Failed to update lineup state:", error);
      alert("Failed to update: " + error.message);
    } else {
      setLineupState((prev) => ({ ...prev, ...newState }));
    }

    setUpdating(false);
  };

  const goLive = () => updateLineupState({ is_live: true, current_slot_index: lineupState.current_slot_index ?? 0 });
  const stopLive = () => updateLineupState({ is_live: false });
  const nextPerformer = () => {
    const next = (lineupState.current_slot_index ?? -1) + 1;
    if (next < timeslots.length) {
      updateLineupState({ current_slot_index: next });
    }
  };
  const prevPerformer = () => {
    const prev = (lineupState.current_slot_index ?? 1) - 1;
    if (prev >= 0) {
      updateLineupState({ current_slot_index: prev });
    }
  };
  const setCurrentSlot = (index: number) => updateLineupState({ current_slot_index: index });
  const resetLineup = () => updateLineupState({ current_slot_index: 0, is_live: false });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="text-[var(--color-text-accent)] text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-8">
        <p className="text-[var(--color-text-secondary)] mb-4">Please log in to access lineup controls.</p>
        <Link href={`/login?redirectTo=/events/${eventId}/lineup`} className="text-[var(--color-text-accent)] hover:underline">
          Log in
        </Link>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-8">
        <p className="text-red-400 mb-4">Access denied. Only event hosts and admins can control the lineup.</p>
        <Link href={`/events/${eventId}`} className="text-[var(--color-text-accent)] hover:underline">
          Back to event
        </Link>
      </div>
    );
  }

  const currentSlot = timeslots.find((s) => s.slot_index === lineupState.current_slot_index);
  const nextSlot = timeslots.find((s) => s.slot_index === (lineupState.current_slot_index ?? -1) + 1);

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href={`/events/${eventId}`}
              className="text-sm text-[var(--color-text-accent)] hover:underline mb-2 inline-block"
            >
              &larr; Back to event
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
              Lineup Control
            </h1>
            <p className="text-[var(--color-text-secondary)]">{event?.title}</p>
            {event?.event_date && (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {new Date(event.event_date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "America/Denver",
                })}
              </p>
            )}
          </div>
          <Link
            href={`/events/${eventId}/display`}
            target="_blank"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium text-sm"
          >
            📺 Open TV Display
          </Link>
        </div>

        {/* Live Status Control */}
        <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Event Status</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {lineupState.is_live
                  ? "Event is LIVE - TV display is showing current performer"
                  : "Event is not live - TV display shows 'Not started yet'"}
              </p>
            </div>
            <div className="flex gap-3">
              {lineupState.is_live ? (
                <Button variant="outline" onClick={stopLive} disabled={updating}>
                  Stop Event
                </Button>
              ) : (
                <Button variant="primary" onClick={goLive} disabled={updating}>
                  Go Live
                </Button>
              )}
              <Button variant="outline" onClick={resetLineup} disabled={updating}>
                Reset
              </Button>
            </div>
          </div>

          {lineupState.is_live && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-red-400 font-semibold">LIVE</span>
              </div>
              <p className="text-[var(--color-text-primary)] text-lg font-medium">
                Now Playing: {currentSlot?.claim?.member?.full_name || "Intermission"}
              </p>
              {nextSlot?.claim?.member && (
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                  Up Next: {nextSlot.claim.member.full_name}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Quick Controls</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={prevPerformer}
              disabled={updating || (lineupState.current_slot_index ?? 0) <= 0}
              className="text-lg px-6"
            >
              &larr; Previous
            </Button>
            <Button
              variant="primary"
              onClick={nextPerformer}
              disabled={updating || (lineupState.current_slot_index ?? -1) >= timeslots.length - 1}
              className="text-lg px-6"
            >
              Next &rarr;
            </Button>
          </div>
        </div>

        {/* Full Lineup */}
        <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Full Lineup</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
            Click on a slot to jump to that performer
          </p>

          <div className="space-y-2">
            {timeslots.map((slot) => {
              const isCurrent = slot.slot_index === lineupState.current_slot_index;
              const isPast = slot.slot_index < (lineupState.current_slot_index ?? 0);

              return (
                <button
                  key={slot.id}
                  onClick={() => setCurrentSlot(slot.slot_index)}
                  disabled={updating}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                    isCurrent
                      ? "bg-[var(--color-accent-primary)]/20 border-[var(--color-accent-primary)] ring-2 ring-[var(--color-accent-primary)]/50"
                      : isPast
                      ? "bg-[var(--color-bg-tertiary)]/30 border-[var(--color-border-default)] opacity-60"
                      : "bg-[var(--color-bg-tertiary)]/50 border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCurrent
                      ? "bg-[var(--color-accent-primary)] text-black"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                  }`}>
                    {slot.slot_index + 1}
                  </div>

                  {slot.claim?.member ? (
                    <div className="flex items-center gap-3 flex-1">
                      {slot.claim.member.avatar_url ? (
                        <img
                          src={slot.claim.member.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                          <span className="text-[var(--color-text-accent)]">
                            {slot.claim.member.full_name?.[0] || "?"}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className={`font-medium ${isCurrent ? "text-[var(--color-text-accent)]" : "text-[var(--color-text-primary)]"}`}>
                          {slot.claim.member.full_name || "Anonymous"}
                        </p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {formatSlotTime(event?.start_time || null, slot.start_offset_minutes, slot.duration_minutes)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="text-[var(--color-text-tertiary)]">Open Slot</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {formatSlotTime(event?.start_time || null, slot.start_offset_minutes, slot.duration_minutes)}
                      </p>
                    </div>
                  )}

                  {isCurrent && lineupState.is_live && (
                    <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                      NOW
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
