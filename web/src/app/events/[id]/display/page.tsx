"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import QRCode from "qrcode";

interface Performer {
  id: string;
  slug: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface TimeslotWithClaim {
  id: string;
  slot_index: number;
  start_offset_minutes: number;
  duration_minutes: number;
  claim?: {
    id: string;
    status: string;
    member: Performer | null;
  } | null;
}

interface LineupState {
  current_slot_index: number | null;
  is_live: boolean;
}

interface EventInfo {
  title: string;
  venue_name: string | null;
  start_time: string | null;
  event_date: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://denversongwriterscollective.org";

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

export default function EventDisplayPage() {
  const params = useParams();
  const eventId = params.id as string;
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [event, setEvent] = React.useState<EventInfo | null>(null);
  const [timeslots, setTimeslots] = React.useState<TimeslotWithClaim[]>([]);
  const [lineupState, setLineupState] = React.useState<LineupState | null>(null);
  const [qrCodes, setQrCodes] = React.useState<Map<string, string>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Update current time every second
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch event data
  const fetchData = React.useCallback(async () => {
    // Fetch event info
    const { data: eventData } = await supabase
      .from("events")
      .select("title, venue_name, start_time, event_date")
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
      const slotIds = slots.map((s: { id: string }) => s.id);
      const { data: claims } = await supabase
        .from("timeslot_claims")
        .select(`
          id, timeslot_id, status,
          member:profiles!timeslot_claims_member_id_fkey(id, slug, full_name, avatar_url)
        `)
        .in("timeslot_id", slotIds)
        .in("status", ["confirmed", "performed"]);

      type ClaimRow = {
        id: string;
        timeslot_id: string;
        status: string;
        member: Performer | null;
      };

      const claimsBySlot = new Map<string, { id: string; status: string; member: Performer | null }>();
      ((claims || []) as ClaimRow[]).forEach((claim) => {
        claimsBySlot.set(claim.timeslot_id, {
          id: claim.id,
          status: claim.status,
          member: claim.member,
        });
      });

      type SlotRow = {
        id: string;
        slot_index: number;
        start_offset_minutes: number;
        duration_minutes: number;
      };

      const slotsWithClaims = (slots as SlotRow[]).map((slot) => ({
        ...slot,
        claim: claimsBySlot.get(slot.id) || null,
      }));

      setTimeslots(slotsWithClaims);

      // Generate QR codes for performers with profiles
      const newQrCodes = new Map<string, string>();
      for (const slot of slotsWithClaims) {
        if (slot.claim?.member?.id) {
          const profileUrl = `${SITE_URL}/songwriters/${slot.claim.member.slug || slot.claim.member.id}`;
          try {
            const qrDataUrl = await QRCode.toDataURL(profileUrl, {
              width: 100,
              margin: 1,
              color: { dark: "#d4a853", light: "#00000000" },
            });
            newQrCodes.set(slot.claim.member.id, qrDataUrl);
          } catch (err) {
            console.error("QR generation error:", err);
          }
        }
      }
      setQrCodes(newQrCodes);
    }

    // Fetch lineup state
    const { data: state } = await supabase
      .from("event_lineup_state")
      .select("current_slot_index, is_live")
      .eq("event_id", eventId)
      .single();

    if (state) setLineupState(state);

    setLoading(false);
  }, [eventId, supabase]);

  // Initial fetch and auto-refresh every 5 seconds
  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[var(--color-text-accent)] text-2xl animate-pulse">
          Loading lineup...
        </div>
      </div>
    );
  }

  const currentSlotIndex = lineupState?.current_slot_index ?? -1;
  const isLive = lineupState?.is_live ?? false;
  const nowPlayingSlot = isLive ? timeslots.find(s => s.slot_index === currentSlotIndex) : null;
  const upNextSlots = timeslots.filter(s => s.slot_index > currentSlotIndex).slice(0, 5);
  const completedSlots = timeslots.filter(s => s.slot_index < currentSlotIndex);

  return (
    <div className="min-h-screen bg-black text-white p-8 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-6">
          {/* Date Box */}
          {event?.event_date && (
            <div className="flex-shrink-0 w-24 h-24 bg-[var(--color-accent-primary)] rounded-xl flex flex-col items-center justify-center text-black">
              <span className="text-sm font-semibold uppercase tracking-wide">
                {new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "America/Denver" })}
              </span>
              <span className="text-4xl font-bold leading-none">
                {new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Denver" })}
              </span>
              <span className="text-xs font-medium uppercase">
                {new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Denver" })}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-4xl font-bold text-[var(--color-text-accent)]">
              {event?.title || "Event"}
            </h1>
            {event?.venue_name && (
              <p className="text-xl text-gray-400 mt-1">{event.venue_name}</p>
            )}
            {event?.event_date && (
              <p className="text-sm text-gray-500 mt-1">
                {new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "America/Denver",
                })}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-5xl font-mono text-white">
            {currentTime.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
          {isLive && (
            <span className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-red-600 rounded-full text-sm font-semibold animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full"></span>
              LIVE
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8 h-[calc(100vh-200px)]">
        {/* Now Playing - Left side (large) */}
        <div className="col-span-5">
          <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Now Playing
          </h2>
          {nowPlayingSlot?.claim?.member ? (
            <div className="bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-transparent border-2 border-[var(--color-accent-primary)] rounded-2xl p-8 h-[calc(100%-40px)]">
              <div className="flex flex-col items-center text-center h-full justify-center">
                {nowPlayingSlot.claim.member.avatar_url ? (
                  <Image
                    src={nowPlayingSlot.claim.member.avatar_url}
                    alt={nowPlayingSlot.claim.member.full_name || "Performer"}
                    width={192}
                    height={192}
                    className="rounded-full object-cover border-4 border-[var(--color-accent-primary)] mb-6"
                  />
                ) : (
                  <div className="w-48 h-48 rounded-full bg-[var(--color-accent-primary)]/30 flex items-center justify-center mb-6">
                    <span className="text-7xl text-[var(--color-text-accent)]">
                      {nowPlayingSlot.claim.member.full_name?.[0] || "?"}
                    </span>
                  </div>
                )}
                <h3 className="text-4xl font-bold text-white mb-2">
                  {nowPlayingSlot.claim.member.full_name || "Anonymous"}
                </h3>
                <p className="text-xl text-[var(--color-text-accent)]">
                  {formatSlotTime(event?.start_time || null, nowPlayingSlot.start_offset_minutes, nowPlayingSlot.duration_minutes)}
                </p>
                {qrCodes.get(nowPlayingSlot.claim.member.id) && (
                  <div className="mt-6">
                    <Image
                      src={qrCodes.get(nowPlayingSlot.claim.member.id)!}
                      alt="Profile QR Code"
                      width={96}
                      height={96}
                      className="mx-auto"
                    />
                    <p className="text-xs text-gray-500 mt-2">Scan for profile</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 h-[calc(100%-40px)] flex items-center justify-center">
              <p className="text-2xl text-gray-500">
                {isLive ? "Intermission" : "Not started yet"}
              </p>
            </div>
          )}
        </div>

        {/* Up Next - Right side */}
        <div className="col-span-7">
          <h2 className="text-lg font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Up Next
          </h2>
          <div className="space-y-3">
            {upNextSlots.length > 0 ? (
              upNextSlots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    index === 0
                      ? "bg-[var(--color-accent-primary)]/10 border-[var(--color-accent-primary)]/50"
                      : "bg-gray-900/30 border-gray-800"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-400">
                    {slot.slot_index + 1}
                  </div>
                  {slot.claim?.member ? (
                    <>
                      {slot.claim.member.avatar_url ? (
                        <Image
                          src={slot.claim.member.avatar_url}
                          alt={slot.claim.member.full_name || ""}
                          width={48}
                          height={48}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                          <span className="text-[var(--color-text-accent)]">
                            {slot.claim.member.full_name?.[0] || "?"}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className={`font-semibold ${index === 0 ? "text-white text-xl" : "text-gray-300"}`}>
                          {slot.claim.member.full_name || "Anonymous"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatSlotTime(event?.start_time || null, slot.start_offset_minutes, slot.duration_minutes)}
                        </p>
                      </div>
                      {qrCodes.get(slot.claim.member.id) && index === 0 && (
                        <Image
                          src={qrCodes.get(slot.claim.member.id)!}
                          alt="QR"
                          width={64}
                          height={64}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                        <span className="text-gray-600">?</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-500">Open Slot</p>
                        <p className="text-sm text-gray-600">
                          {formatSlotTime(event?.start_time || null, slot.start_offset_minutes, slot.duration_minutes)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                No more performers scheduled
              </div>
            )}
          </div>

          {/* Completed performers (smaller) */}
          {completedSlots.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Already Performed
              </h3>
              <div className="flex flex-wrap gap-2">
                {completedSlots.map(slot => (
                  slot.claim?.member && (
                    <div
                      key={slot.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/30 rounded-full text-sm text-gray-500"
                    >
                      {slot.claim.member.avatar_url ? (
                        <Image
                          src={slot.claim.member.avatar_url}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded-full object-cover opacity-50"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-800" />
                      )}
                      <span>{slot.claim.member.full_name}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0 text-center text-gray-600 text-sm">
        Denver Songwriters Collective
      </footer>
    </div>
  );
}
