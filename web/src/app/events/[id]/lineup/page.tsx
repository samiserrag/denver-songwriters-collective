"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui";
import { expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";

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
  is_recurring: boolean;
  day_of_week: string | null;
  recurrence_rule: string | null;
}

interface LineupState {
  now_playing_timeslot_id: string | null;
  updated_at: string | null;
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
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [event, setEvent] = React.useState<EventInfo | null>(null);
  const [timeslots, setTimeslots] = React.useState<Timeslot[]>([]);
  const [lineupState, setLineupState] = React.useState<LineupState>({ now_playing_timeslot_id: null, updated_at: null });
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [isAuthorized, setIsAuthorized] = React.useState(false);

  // Phase ABC7: Track the effective date_key for this occurrence
  const [effectiveDateKey, setEffectiveDateKey] = React.useState<string | null>(null);
  const [availableDates, setAvailableDates] = React.useState<string[]>([]);

  // Get date from URL param
  const urlDate = searchParams.get("date");

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
    // Fetch event info with recurrence fields for date_key computation
    const { data: eventData } = await supabase
      .from("events")
      .select("id, title, venue_name, start_time, event_date, is_recurring, day_of_week, recurrence_rule")
      .eq("id", eventId)
      .single();

    if (!eventData) {
      setLoading(false);
      return;
    }

    setEvent(eventData);

    // Phase ABC7: Compute effective date_key for this occurrence
    let dateKey: string;
    const dates: string[] = [];

    if (eventData.is_recurring) {
      // For recurring events, expand occurrences and find valid date
      const occurrences = expandOccurrencesForEvent({
        event_date: eventData.event_date,
        day_of_week: eventData.day_of_week,
        recurrence_rule: eventData.recurrence_rule,
      });
      occurrences.forEach(occ => dates.push(occ.dateKey));

      if (urlDate && dates.includes(urlDate)) {
        // Use URL-provided date if valid
        dateKey = urlDate;
      } else if (dates.length > 0) {
        // Default to next upcoming occurrence
        dateKey = dates[0];
      } else {
        // Fallback to today if no occurrences (edge case)
        dateKey = new Date().toISOString().split("T")[0];
      }
    } else {
      // One-time event: date_key is the event_date
      dateKey = eventData.event_date || new Date().toISOString().split("T")[0];
      dates.push(dateKey);
    }

    setEffectiveDateKey(dateKey);
    setAvailableDates(dates);

    // Phase ABC7: Fetch timeslots filtered by (event_id, date_key)
    const { data: slots } = await supabase
      .from("event_timeslots")
      .select("id, slot_index, start_offset_minutes, duration_minutes")
      .eq("event_id", eventId)
      .eq("date_key", dateKey)
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

    // Phase ABC7: Fetch lineup state filtered by (event_id, date_key)
    const { data: state } = await supabase
      .from("event_lineup_state")
      .select("now_playing_timeslot_id, updated_at")
      .eq("event_id", eventId)
      .eq("date_key", dateKey)
      .maybeSingle();

    if (state) {
      setLineupState(state);
    } else {
      // Reset to default if no state for this date
      setLineupState({ now_playing_timeslot_id: null, updated_at: null });
    }

    setLoading(false);
  }, [eventId, supabase, urlDate]);

  React.useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Phase ABC7: Update lineup state with date_key for per-occurrence control
  const updateLineupState = async (newTimeslotId: string | null) => {
    if (!effectiveDateKey) return;

    setUpdating(true);

    // Phase ABC7: Upsert lineup state with (event_id, date_key) composite key
    const { error } = await supabase
      .from("event_lineup_state")
      .upsert({
        event_id: eventId,
        date_key: effectiveDateKey,
        now_playing_timeslot_id: newTimeslotId,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      }, {
        onConflict: "event_id,date_key",
      });

    if (error) {
      console.error("Failed to update lineup state:", error);
      alert("Failed to update: " + error.message);
    } else {
      setLineupState({ now_playing_timeslot_id: newTimeslotId, updated_at: new Date().toISOString() });
    }

    setUpdating(false);
  };

  // Helper to get current slot index from timeslot ID
  const currentSlotIndex = React.useMemo(() => {
    if (!lineupState.now_playing_timeslot_id) return -1;
    const idx = timeslots.findIndex(s => s.id === lineupState.now_playing_timeslot_id);
    return idx;
  }, [lineupState.now_playing_timeslot_id, timeslots]);

  // Determine if event is "live" (has a current performer set)
  const isLive = lineupState.now_playing_timeslot_id !== null;

  const goLive = () => {
    // Start with first slot
    const firstSlot = timeslots[0];
    if (firstSlot) {
      updateLineupState(firstSlot.id);
    }
  };

  const stopLive = () => updateLineupState(null);

  const nextPerformer = () => {
    const nextIdx = currentSlotIndex + 1;
    if (nextIdx < timeslots.length) {
      updateLineupState(timeslots[nextIdx].id);
    }
  };

  const prevPerformer = () => {
    const prevIdx = currentSlotIndex - 1;
    if (prevIdx >= 0) {
      updateLineupState(timeslots[prevIdx].id);
    }
  };

  const setCurrentSlot = (slotId: string) => updateLineupState(slotId);

  const resetLineup = () => updateLineupState(null);

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

  // Current and next slot based on timeslot ID lookup
  const currentSlot = currentSlotIndex >= 0 ? timeslots[currentSlotIndex] : null;
  const nextSlot = currentSlotIndex >= 0 && currentSlotIndex + 1 < timeslots.length
    ? timeslots[currentSlotIndex + 1]
    : null;

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href={`/events/${eventId}${effectiveDateKey ? `?date=${effectiveDateKey}` : ""}`}
              className="text-sm text-[var(--color-text-accent)] hover:underline mb-2 inline-block"
            >
              &larr; Back to event
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
              Lineup Control
            </h1>
            <p className="text-[var(--color-text-secondary)]">{event?.title}</p>
            {/* Phase ABC7: Show effective date for this occurrence */}
            {effectiveDateKey && (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "America/Denver",
                })}
              </p>
            )}
            {/* Phase ABC7: Date selector for recurring events */}
            {event?.is_recurring && availableDates.length > 1 && (
              <div className="mt-2">
                <label className="text-xs text-[var(--color-text-tertiary)] mr-2">Select date:</label>
                <select
                  value={effectiveDateKey || ""}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    window.location.href = `/events/${eventId}/lineup?date=${newDate}`;
                  }}
                  className="text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded px-2 py-1 text-[var(--color-text-primary)]"
                >
                  {availableDates.map((date) => (
                    <option key={date} value={date}>
                      {new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "America/Denver",
                      })}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {/* Phase ABC7: TV display link includes date_key */}
          <Link
            href={`/events/${eventId}/display${effectiveDateKey ? `?date=${effectiveDateKey}` : ""}`}
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
                {isLive
                  ? "Event is LIVE - TV display is showing current performer"
                  : "Event is not live - TV display shows 'Not started yet'"}
              </p>
            </div>
            <div className="flex gap-3">
              {isLive ? (
                <Button variant="outline" onClick={stopLive} disabled={updating}>
                  Stop Event
                </Button>
              ) : (
                <Button variant="primary" onClick={goLive} disabled={updating || timeslots.length === 0}>
                  Go Live
                </Button>
              )}
              <Button variant="outline" onClick={resetLineup} disabled={updating}>
                Reset
              </Button>
            </div>
          </div>

          {isLive && (
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
              disabled={updating || currentSlotIndex <= 0}
              className="text-lg px-6"
            >
              &larr; Previous
            </Button>
            <Button
              variant="primary"
              onClick={nextPerformer}
              disabled={updating || currentSlotIndex >= timeslots.length - 1}
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

          {timeslots.length === 0 && (
            <p className="text-[var(--color-text-tertiary)] italic">
              No performer slots configured for this date.
            </p>
          )}

          <div className="space-y-2">
            {timeslots.map((slot, idx) => {
              const isCurrent = slot.id === lineupState.now_playing_timeslot_id;
              const isPast = idx < currentSlotIndex;

              return (
                <button
                  key={slot.id}
                  onClick={() => setCurrentSlot(slot.id)}
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
                        <Image
                          src={slot.claim.member.avatar_url}
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-full object-cover"
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

                  {isCurrent && isLive && (
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
