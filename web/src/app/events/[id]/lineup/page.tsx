"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LineupStateBanner } from "@/components/events/LineupStateBanner";
import { LineupDatePicker } from "@/components/events/LineupDatePicker";
import { expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";

/**
 * Phase 4.100.2: Check if string is a valid UUID
 * Used to determine whether to query by id (UUID) or slug
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

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
  slug: string | null;
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

/**
 * Lineup Control Page for hosts/admins to manage live event lineup.
 *
 * Phase 4.99: UX Hardening
 * - Explicit date selection required for recurring events (no silent default)
 * - Connection health indicator via LineupStateBanner
 * - Confirmation dialogs for destructive actions (Stop Event, Reset)
 * - Co-host authorization requires status='accepted'
 *
 * DSC UX Principles: §3 (Rolling Windows), §6 (Anchored Navigation), §7 (UX Friction)
 */
export default function LineupControlPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Phase 4.100.2: Rename to routeParam - may be UUID or slug
  const routeParam = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  // Phase 4.100.2: Resolved UUID after fetching event (used for all subsequent queries)
  const [eventUuid, setEventUuid] = React.useState<string | null>(null);

  const [event, setEvent] = React.useState<EventInfo | null>(null);
  const [timeslots, setTimeslots] = React.useState<Timeslot[]>([]);
  const [lineupState, setLineupState] = React.useState<LineupState>({ now_playing_timeslot_id: null, updated_at: null });
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [isAuthorized, setIsAuthorized] = React.useState(false);

  // Phase 4.99: Connection health tracking
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<"connected" | "disconnected" | "reconnecting">("connected");
  const [failureCount, setFailureCount] = React.useState(0);

  // Phase 4.100: Reliability polish
  const [showRecovered, setShowRecovered] = React.useState(false);
  const wasDisconnectedRef = React.useRef(false);
  const recoveredTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 4.99: Confirmation dialogs
  const [showStopConfirm, setShowStopConfirm] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  // Phase ABC7: Track the effective date_key for this occurrence
  const [effectiveDateKey, setEffectiveDateKey] = React.useState<string | null>(null);
  const [availableDates, setAvailableDates] = React.useState<string[]>([]);

  // Phase 4.99: Show date picker modal when date is required but not provided
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [needsDateSelection, setNeedsDateSelection] = React.useState(false);

  // Get date from URL param
  const urlDate = searchParams.get("date");

  // Phase 4.99: Copyable display URL state
  const [copied, setCopied] = React.useState(false);

  // Check authorization (admin or event host)
  // Phase 4.100.2: Only runs after eventUuid is resolved
  React.useEffect(() => {
    async function checkAuth() {
      if (!user || !eventUuid) return;

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
        .eq("id", eventUuid)
        .single();

      if (eventData?.host_id === user.id) {
        setIsAuthorized(true);
        return;
      }

      // Phase 4.99 F11: Also check event_hosts table for co-hosts
      // SECURITY FIX: Only accept hosts with invitation_status = 'accepted'
      const { data: hostEntry } = await supabase
        .from("event_hosts")
        .select("id")
        .eq("event_id", eventUuid)
        .eq("user_id", user.id)
        .eq("invitation_status", "accepted")
        .single();

      if (hostEntry) {
        setIsAuthorized(true);
      }
    }

    if (user && eventUuid) checkAuth();
  }, [user, eventUuid, supabase]);

  // Fetch event data
  const fetchData = React.useCallback(async () => {
    try {
      // Phase 4.100.2: Conditionally query by UUID or slug
      // Fetch event info with recurrence fields for date_key computation
      const eventQuery = supabase
        .from("events")
        .select("id, title, slug, venue_name, start_time, event_date, is_recurring, day_of_week, recurrence_rule");

      const { data: eventData, error: eventError } = isUUID(routeParam)
        ? await eventQuery.eq("id", routeParam).single()
        : await eventQuery.eq("slug", routeParam).single();

      if (eventError) throw eventError;

      if (!eventData) {
        setLoading(false);
        return;
      }

      // Phase 4.100.2: Store the resolved UUID for all subsequent queries
      const resolvedUuid = eventData.id;
      setEventUuid(resolvedUuid);
      setEvent(eventData);

      // Phase ABC7: Compute effective date_key for this occurrence
      let dateKey: string | null = null;
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
        } else if (dates.length > 1 && !urlDate) {
          // Phase 4.99 B3: NO SILENT DEFAULT for recurring events
          // If no date provided and multiple dates exist, require explicit selection
          setAvailableDates(dates);
          setNeedsDateSelection(true);
          setShowDatePicker(true);
          setLoading(false);
          return;
        } else if (dates.length === 1) {
          // Single upcoming occurrence - use it
          dateKey = dates[0];
        } else if (dates.length === 0) {
          // Fallback to today if no occurrences (edge case)
          dateKey = new Date().toISOString().split("T")[0];
        }
      } else {
        // One-time event: date_key is the event_date
        const oneTimeDate = eventData.event_date || new Date().toISOString().split("T")[0];
        dateKey = oneTimeDate;
        dates.push(oneTimeDate);
      }

      setEffectiveDateKey(dateKey);
      setAvailableDates(dates);
      setNeedsDateSelection(false);

      if (!dateKey) {
        setLoading(false);
        return;
      }

      // Phase ABC7: Fetch timeslots filtered by (event_id, date_key)
      // Phase 4.100.2: Use resolvedUuid instead of routeParam
      const { data: slots, error: slotsError } = await supabase
        .from("event_timeslots")
        .select("id, slot_index, start_offset_minutes, duration_minutes")
        .eq("event_id", resolvedUuid)
        .eq("date_key", dateKey)
        .order("slot_index", { ascending: true });

      if (slotsError) throw slotsError;

      if (slots && slots.length > 0) {
        type SlotRow = { id: string; slot_index: number; start_offset_minutes: number; duration_minutes: number };
        const slotIds = (slots as SlotRow[]).map((s) => s.id);

        const { data: claims, error: claimsError } = await supabase
          .from("timeslot_claims")
          .select(`
            id, timeslot_id, status,
            member:profiles!timeslot_claims_member_id_fkey(id, full_name, avatar_url)
          `)
          .in("timeslot_id", slotIds)
          .in("status", ["confirmed", "performed"]);

        if (claimsError) throw claimsError;

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
      } else {
        setTimeslots([]);
      }

      // Phase ABC7: Fetch lineup state filtered by (event_id, date_key)
      // Phase 4.100.2: Use resolvedUuid instead of routeParam
      const { data: state, error: stateError } = await supabase
        .from("event_lineup_state")
        .select("now_playing_timeslot_id, updated_at")
        .eq("event_id", resolvedUuid)
        .eq("date_key", dateKey)
        .maybeSingle();

      if (stateError) throw stateError;

      if (state) {
        setLineupState(state);
      } else {
        // Reset to default if no state for this date
        setLineupState({ now_playing_timeslot_id: null, updated_at: null });
      }

      // Phase 4.99: Update connection health
      setLastUpdated(new Date());
      setFailureCount(0);

      // Phase 4.100: Show "Connection restored" banner when recovering from disconnected
      if (wasDisconnectedRef.current) {
        setShowRecovered(true);
        wasDisconnectedRef.current = false;
        // Clear any existing timeout
        if (recoveredTimeoutRef.current) {
          clearTimeout(recoveredTimeoutRef.current);
        }
        // Auto-hide after 5 seconds
        recoveredTimeoutRef.current = setTimeout(() => {
          setShowRecovered(false);
        }, 5000);
      }

      setConnectionStatus("connected");
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch lineup data:", error);
      // Phase 4.99: Track failures for connection health
      setFailureCount(prev => prev + 1);
      if (failureCount >= 2) {
        setConnectionStatus("disconnected");
        // Phase 4.100: Track that we were disconnected for recovery banner
        wasDisconnectedRef.current = true;
      } else {
        setConnectionStatus("reconnecting");
      }
      setLoading(false);
    }
  }, [routeParam, supabase, urlDate, failureCount]);

  React.useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Phase 4.100: Immediate refresh on visibility/focus with debounce
  React.useEffect(() => {
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    const debouncedFetch = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        fetchData();
      }, 50); // 50ms debounce to prevent double-fetch
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        debouncedFetch();
      }
    };

    const handleFocus = () => {
      debouncedFetch();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [fetchData]);

  // Phase 4.100: Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (recoveredTimeoutRef.current) {
        clearTimeout(recoveredTimeoutRef.current);
      }
    };
  }, []);

  // Phase ABC7: Update lineup state with date_key for per-occurrence control
  // Phase 4.100.2: Use eventUuid instead of routeParam for upsert
  const updateLineupState = async (newTimeslotId: string | null) => {
    if (!effectiveDateKey || !eventUuid) return;

    setUpdating(true);

    // Phase ABC7: Upsert lineup state with (event_id, date_key) composite key
    const { error } = await supabase
      .from("event_lineup_state")
      .upsert({
        event_id: eventUuid,
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
      setLastUpdated(new Date());
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

  // Phase 4.99: Stop with confirmation
  const handleStopClick = () => setShowStopConfirm(true);
  const confirmStop = () => {
    updateLineupState(null);
    setShowStopConfirm(false);
  };

  // Phase 4.99: Reset with confirmation
  const handleResetClick = () => setShowResetConfirm(true);
  const confirmReset = () => {
    updateLineupState(null);
    setShowResetConfirm(false);
  };

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

  // Phase 4.99: Handle date selection from picker
  // Phase 4.100.2: Use routeParam (preserves slug if originally accessed via slug)
  const handleDateSelect = (date: string) => {
    setShowDatePicker(false);
    router.push(`/events/${routeParam}/lineup?date=${date}`);
  };

  // Phase 4.99: Build display URL
  // Phase 4.100.2: Use event slug if available, otherwise routeParam
  const eventIdentifier = event?.slug || routeParam;
  const displayUrl = effectiveDateKey
    ? `/events/${eventIdentifier}/display?date=${effectiveDateKey}`
    : `/events/${eventIdentifier}/display`;
  const fullDisplayUrl = typeof window !== "undefined"
    ? `${window.location.origin}${displayUrl}`
    : displayUrl;

  const handleCopyDisplayUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullDisplayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Phase 4.99: Date picker modal for recurring events without date param
  if (needsDateSelection && showDatePicker && event) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
        <LineupDatePicker
          eventTitle={event.title}
          availableDates={availableDates}
          onSelectDate={handleDateSelect}
        />
      </div>
    );
  }

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
        <Link href={`/login?redirectTo=/events/${routeParam}/lineup`} className="text-[var(--color-text-accent)] hover:underline">
          Log in
        </Link>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-8">
        <p className="text-red-400 mb-4">Access denied. Only event hosts and admins can control the lineup.</p>
        <Link href={`/events/${routeParam}`} className="text-[var(--color-text-accent)] hover:underline">
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
      {/* Phase 4.99: Connection status banner */}
      <LineupStateBanner
        lastUpdated={lastUpdated}
        connectionStatus={connectionStatus}
        variant="prominent"
        showRecovered={showRecovered}
      />

      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href={`/events/${eventIdentifier}${effectiveDateKey ? `?date=${effectiveDateKey}` : ""}`}
              className="text-sm text-[var(--color-text-accent)] hover:underline mb-2 inline-block"
            >
              &larr; Back to event
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
              Lineup Control
            </h1>
            <p className="text-[var(--color-text-secondary)]">{event?.title}</p>
            {/* Phase 4.99 B4: Show effective date for this occurrence prominently */}
            {effectiveDateKey && (
              <div className="mt-2 px-3 py-2 bg-[var(--color-accent-primary)]/10 border border-[var(--color-accent-primary)]/30 rounded-lg inline-block">
                <span className="text-xs text-[var(--color-text-tertiary)]">Controlling lineup for:</span>
                <p className="font-semibold text-[var(--color-text-accent)]">
                  {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "America/Denver",
                  })}
                </p>
              </div>
            )}
            {/* Phase ABC7: Date selector for recurring events */}
            {/* Phase 4.100.2: Use routeParam to preserve slug in URL */}
            {event?.is_recurring && availableDates.length > 1 && (
              <div className="mt-3">
                <label className="text-xs text-[var(--color-text-tertiary)] mr-2">Change date:</label>
                <select
                  value={effectiveDateKey || ""}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    router.push(`/events/${routeParam}/lineup?date=${newDate}`);
                  }}
                  className="text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded px-3 py-1.5 text-[var(--color-text-primary)]"
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
          {/* Phase 4.99 C5: TV display link with target="_blank" */}
          <Link
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium text-sm inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Open TV Display
            <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>

        {/* Phase 4.99 C6: Copyable display URL */}
        <div className="mb-6 p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
          <label className="block text-xs text-[var(--color-text-tertiary)] mb-2">
            TV Display URL (copy for projector):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={fullDisplayUrl}
              className="flex-1 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded px-3 py-2 text-[var(--color-text-secondary)] font-mono"
            />
            <button
              onClick={handleCopyDisplayUrl}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] font-medium transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
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
                // Phase 4.99 E9: Stop Event with confirmation
                <Button variant="outline" onClick={handleStopClick} disabled={updating}>
                  Stop Event
                </Button>
              ) : (
                <Button variant="primary" onClick={goLive} disabled={updating || timeslots.length === 0}>
                  Go Live
                </Button>
              )}
              {/* Phase 4.99 E10: Reset with confirmation */}
              <Button variant="outline" onClick={handleResetClick} disabled={updating}>
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

      {/* Phase 4.99 E9: Stop Event Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showStopConfirm}
        onClose={() => setShowStopConfirm(false)}
        onConfirm={confirmStop}
        title="Stop Event?"
        message="This will end the live event. The TV display will show 'Not started yet' until you go live again."
        confirmLabel="Stop Event"
        cancelLabel="Keep Running"
        variant="warning"
        loading={updating}
      />

      {/* Phase 4.99 E10: Reset Lineup Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmReset}
        title="Reset Lineup?"
        message="This will reset the lineup to the beginning. The TV display will show 'Not started yet'."
        confirmLabel="Reset Lineup"
        cancelLabel="Cancel"
        variant="warning"
        loading={updating}
      />
    </div>
  );
}
