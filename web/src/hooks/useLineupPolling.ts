"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";

interface Performer {
  id: string;
  slug?: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface TimeslotClaim {
  id: string;
  status: string;
  member: Performer | null;
}

export interface Timeslot {
  id: string;
  slot_index: number;
  start_offset_minutes: number;
  duration_minutes: number;
  claim: TimeslotClaim | null;
}

export interface LineupState {
  now_playing_timeslot_id: string | null;
  updated_at: string | null;
}

export interface EventInfo {
  id: string;
  title: string;
  venue_name: string | null;
  start_time: string | null;
  event_date: string | null;
  is_recurring: boolean;
  day_of_week: string | null;
  recurrence_rule: string | null;
  host_id: string | null;
}

export interface UseLineupPollingOptions {
  eventId: string;
  urlDate: string | null;
  pollingIntervalMs?: number;
  includePerformerSlug?: boolean;
}

export interface UseLineupPollingResult {
  event: EventInfo | null;
  timeslots: Timeslot[];
  lineupState: LineupState;
  effectiveDateKey: string | null;
  availableDates: string[];
  loading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
  refresh: () => Promise<void>;
}

/**
 * Shared hook for lineup polling used by both /lineup (control) and /display pages.
 *
 * Phase 4.99: Centralized polling logic with connection health tracking.
 */
export function useLineupPolling({
  eventId,
  urlDate,
  pollingIntervalMs = 5000,
  includePerformerSlug = false,
}: UseLineupPollingOptions): UseLineupPollingResult {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [event, setEvent] = React.useState<EventInfo | null>(null);
  const [timeslots, setTimeslots] = React.useState<Timeslot[]>([]);
  const [lineupState, setLineupState] = React.useState<LineupState>({
    now_playing_timeslot_id: null,
    updated_at: null,
  });
  const [effectiveDateKey, setEffectiveDateKey] = React.useState<string | null>(null);
  const [availableDates, setAvailableDates] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<"connected" | "disconnected" | "reconnecting">("connected");
  const [failureCount, setFailureCount] = React.useState(0);

  const fetchData = React.useCallback(async () => {
    try {
      // Fetch event info with recurrence fields for date_key computation
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, title, venue_name, start_time, event_date, is_recurring, day_of_week, recurrence_rule, host_id")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      if (!eventData) {
        setLoading(false);
        setError(new Error("Event not found"));
        return;
      }

      setEvent(eventData);

      // Compute effective date_key for this occurrence
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
          dateKey = urlDate;
        } else if (dates.length > 0) {
          dateKey = dates[0];
        } else {
          dateKey = new Date().toISOString().split("T")[0];
        }
      } else {
        dateKey = eventData.event_date || new Date().toISOString().split("T")[0];
        dates.push(dateKey);
      }

      setEffectiveDateKey(dateKey);
      setAvailableDates(dates);

      // Fetch timeslots filtered by (event_id, date_key)
      const { data: slots, error: slotsError } = await supabase
        .from("event_timeslots")
        .select("id, slot_index, start_offset_minutes, duration_minutes")
        .eq("event_id", eventId)
        .eq("date_key", dateKey)
        .order("slot_index", { ascending: true });

      if (slotsError) throw slotsError;

      if (slots && slots.length > 0) {
        type SlotRow = { id: string; slot_index: number; start_offset_minutes: number; duration_minutes: number };
        const slotIds = (slots as SlotRow[]).map((s) => s.id);

        // Build select query based on whether we need slug
        const claimSelect = includePerformerSlug
          ? `id, timeslot_id, status, member:profiles!timeslot_claims_member_id_fkey(id, slug, full_name, avatar_url)`
          : `id, timeslot_id, status, member:profiles!timeslot_claims_member_id_fkey(id, full_name, avatar_url)`;

        const { data: claims, error: claimsError } = await supabase
          .from("timeslot_claims")
          .select(claimSelect)
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

      // Fetch lineup state filtered by (event_id, date_key)
      const { data: state, error: stateError } = await supabase
        .from("event_lineup_state")
        .select("now_playing_timeslot_id, updated_at")
        .eq("event_id", eventId)
        .eq("date_key", dateKey)
        .maybeSingle();

      if (stateError) throw stateError;

      if (state) {
        setLineupState(state);
      } else {
        setLineupState({ now_playing_timeslot_id: null, updated_at: null });
      }

      // Success - update connection status
      setLastUpdated(new Date());
      setConnectionStatus("connected");
      setFailureCount(0);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error("[useLineupPolling] Fetch error:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setFailureCount(prev => prev + 1);

      // After 2 consecutive failures, mark as disconnected
      if (failureCount >= 1) {
        setConnectionStatus("disconnected");
      } else {
        setConnectionStatus("reconnecting");
      }

      setLoading(false);
    }
  }, [eventId, supabase, urlDate, includePerformerSlug, failureCount]);

  // Initial fetch
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling interval
  React.useEffect(() => {
    const interval = setInterval(fetchData, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, pollingIntervalMs]);

  return {
    event,
    timeslots,
    lineupState,
    effectiveDateKey,
    availableDates,
    loading,
    error,
    lastUpdated,
    connectionStatus,
    refresh: fetchData,
  };
}
