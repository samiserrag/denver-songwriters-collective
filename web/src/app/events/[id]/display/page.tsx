"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import QRCode from "qrcode";
import { expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";
import { LineupStateBanner } from "@/components/events/LineupStateBanner";
import { TvQrStrip } from "@/components/events/TvQrStrip";

/**
 * Phase 4.104: TV Poster Mode
 *
 * When ?tv=1 is present, renders a full-screen artistic overlay that:
 * - Shows cover art as blurred background with dark gradient
 * - Displays host + accepted cohosts with avatars and QR codes
 * - Hides header/footer visually (overlay covers them)
 * - Accepts any valid YYYY-MM-DD date for past demo support
 */

/**
 * Phase 4.100.2: Check if string is a valid UUID
 * Used to determine whether to query by id (UUID) or slug
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

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
  now_playing_timeslot_id: string | null;
  updated_at: string | null;
}

interface EventInfo {
  id: string;
  title: string;
  slug: string | null;
  venue_name: string | null;
  start_time: string | null;
  end_time: string | null; // Phase 4.108: For event time window display
  event_date: string | null;
  is_recurring: boolean;
  day_of_week: string | null;
  recurrence_rule: string | null;
  // Phase 4.102: Additional fields for TV display media + QR
  cover_image_url: string | null;
  venue_id: string | null;
  host_id: string | null;
}

// Phase 4.102: Static venue/host data (fetched once)
interface VenueInfo {
  id: string;
  name: string;
  slug: string | null;
}

interface HostInfo {
  id: string;
  full_name: string | null;
  slug: string | null;
  avatar_url?: string | null;
  role?: "host" | "cohost";
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://coloradosongwriterscollective.org";

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
 * Phase 4.108: Format event time window (e.g., "7:00 PM – 10:00 PM" or "Starts 7:00 PM")
 */
function formatEventTimeWindow(startTime: string, endTime: string | null): string {
  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (endTime) {
    return `${formatTime(startTime)} – ${formatTime(endTime)}`;
  }
  return `Starts ${formatTime(startTime)}`;
}

export default function EventDisplayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  // Phase 4.100.2: Rename to routeParam - may be UUID or slug
  const routeParam = params.id as string;
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  // Phase 4.100.2: Resolved UUID after fetching event (used for all subsequent queries)
  const [eventUuid, setEventUuid] = React.useState<string | null>(null);

  const [event, setEvent] = React.useState<EventInfo | null>(null);
  const [timeslots, setTimeslots] = React.useState<TimeslotWithClaim[]>([]);
  const [lineupState, setLineupState] = React.useState<LineupState | null>(null);
  const [qrCodes, setQrCodes] = React.useState<Map<string, string>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Phase 4.102: Static data (fetched once on initial load)
  const [venue, setVenue] = React.useState<VenueInfo | null>(null);
  const [host, setHost] = React.useState<HostInfo | null>(null);
  const [staticDataLoaded, setStaticDataLoaded] = React.useState(false);

  // Phase 4.104: TV Poster Mode
  const tvMode = searchParams.get("tv") === "1";
  const [allHosts, setAllHosts] = React.useState<HostInfo[]>([]); // Primary host + accepted cohosts
  const [displayCoverImage, setDisplayCoverImage] = React.useState<string | null>(null);
  const [hostQrCodes, setHostQrCodes] = React.useState<Map<string, string>>(new Map());
  // Phase 4.105: Event QR code (generated locally, tied to dateKey changes)
  const [eventQrCode, setEventQrCode] = React.useState<string | null>(null);
  const [eventQrError, setEventQrError] = React.useState(false);
  // Phase 4.108: CSC Join QR code for homepage
  const [dscJoinQrCode, setDscJoinQrCode] = React.useState<string | null>(null);

  // Phase 4.99: Connection health tracking
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<"connected" | "disconnected" | "reconnecting">("connected");
  const [failureCount, setFailureCount] = React.useState(0);

  // Phase 4.100: Reliability polish
  const [showRecovered, setShowRecovered] = React.useState(false);
  const [showExtendedHint, setShowExtendedHint] = React.useState(false);
  const wasDisconnectedRef = React.useRef(false);
  const recoveredTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const extendedHintTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase ABC7: Track effective date_key for this occurrence
  const [effectiveDateKey, setEffectiveDateKey] = React.useState<string | null>(null);

  // Get date from URL param
  const urlDate = searchParams.get("date");

  // Update current time every second
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Phase 4.104: Scroll lock for TV mode
  React.useEffect(() => {
    if (tvMode) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [tvMode]);

  // Phase 4.102 + 4.104: Fetch static data (venue, hosts, cover image) once on initial load
  const fetchStaticData = React.useCallback(async (
    eventId: string,
    venueId: string | null,
    hostId: string | null,
    baseCoverImage: string | null,
    dateKey: string
  ) => {
    // Fetch venue if we have venue_id
    if (venueId) {
      const { data: venueData } = await supabase
        .from("venues")
        .select("id, name, slug")
        .eq("id", venueId)
        .single();
      if (venueData) {
        setVenue(venueData);
      }
    }

    // Fetch primary host if we have host_id (legacy)
    if (hostId) {
      const { data: hostData } = await supabase
        .from("profiles")
        .select("id, full_name, slug, avatar_url")
        .eq("id", hostId)
        .single();
      if (hostData) {
        setHost({ ...hostData, role: "host" });
      }
    }

    // Phase 4.104: Fetch all accepted hosts (primary + cohosts) from event_hosts
    const { data: eventHosts } = await supabase
      .from("event_hosts")
      .select("user_id, role")
      .eq("event_id", eventId)
      .eq("invitation_status", "accepted");

    if (eventHosts && eventHosts.length > 0) {
      const hostIds = eventHosts.map((h: { user_id: string }) => h.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, slug, avatar_url")
        .in("id", hostIds);

      if (profiles) {
        // Map profiles with their roles, primary hosts first
        type ProfileRow = { id: string; full_name: string | null; slug: string | null; avatar_url: string | null };
        const hostsWithRoles: HostInfo[] = (profiles as ProfileRow[]).map((p: ProfileRow) => {
          const hostEntry = eventHosts.find((h: { user_id: string; role: string }) => h.user_id === p.id);
          return {
            ...p,
            role: (hostEntry?.role === "host" ? "host" : "cohost") as "host" | "cohost",
          };
        });
        // Sort: primary hosts first, then cohosts
        hostsWithRoles.sort((a, b) => {
          if (a.role === "host" && b.role !== "host") return -1;
          if (a.role !== "host" && b.role === "host") return 1;
          return 0;
        });
        setAllHosts(hostsWithRoles);

        // Generate QR codes for hosts (TV mode only - smaller sizes)
        const newHostQrCodes = new Map<string, string>();
        for (const h of hostsWithRoles) {
          const profileUrl = `${SITE_URL}/songwriters/${h.slug || h.id}`;
          try {
            // Primary host: 80px, cohosts: 60px
            const size = h.role === "host" ? 80 : 60;
            const qrDataUrl = await QRCode.toDataURL(profileUrl, {
              width: size,
              margin: 1,
              color: { dark: "#1a1a1a", light: "#ffffff" }, // Dark on white for scan reliability
            });
            newHostQrCodes.set(h.id, qrDataUrl);
          } catch (err) {
            console.error("Host QR generation error:", err);
          }
        }
        setHostQrCodes(newHostQrCodes);
      }
    }

    // Phase 4.104: Fetch cover image with override precedence
    // Priority: override_patch.cover_image_url > override_cover_image_url > event.cover_image_url
    let coverImage = baseCoverImage;
    const { data: override } = await supabase
      .from("occurrence_overrides")
      .select("override_cover_image_url, override_patch")
      .eq("event_id", eventId)
      .eq("date_key", dateKey)
      .maybeSingle();

    if (override) {
      const patch = override.override_patch as Record<string, unknown> | null;
      coverImage = (patch?.cover_image_url as string | undefined)
        || override.override_cover_image_url
        || baseCoverImage;
    }
    setDisplayCoverImage(coverImage);

    setStaticDataLoaded(true);
  }, [supabase]);

  // Fetch event data
  const fetchData = React.useCallback(async () => {
    try {
      // Phase 4.100.2: Conditionally query by UUID or slug
      // Phase 4.102: Include additional fields for media + QR
      // Phase 4.108: Added end_time for event time window display
      const eventQuery = supabase
        .from("events")
        .select("id, title, slug, venue_name, start_time, end_time, event_date, is_recurring, day_of_week, recurrence_rule, cover_image_url, venue_id, host_id");

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

    // Phase ABC7 + 4.104: Compute effective date_key for this occurrence
    // Phase 4.104: In TV mode, accept any valid YYYY-MM-DD for past demo support
    let dateKey: string;
    const isValidDateFormat = urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate);

    if (tvMode && isValidDateFormat) {
      // TV mode: accept any valid date format for demo purposes
      dateKey = urlDate;
    } else if (eventData.is_recurring) {
      // For recurring events, expand occurrences and find valid date
      const occurrences = expandOccurrencesForEvent({
        event_date: eventData.event_date,
        day_of_week: eventData.day_of_week,
        recurrence_rule: eventData.recurrence_rule,
      });
      const dates = occurrences.map(occ => occ.dateKey);

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
    }

    setEffectiveDateKey(dateKey);

      // Phase 4.102 + 4.104: Fetch static data (venue, hosts, cover) only once
      if (!staticDataLoaded) {
        fetchStaticData(resolvedUuid, eventData.venue_id, eventData.host_id, eventData.cover_image_url, dateKey);
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
      const slotIds = slots.map((s: { id: string }) => s.id);
      const { data: claims, error: claimsError } = await supabase
        .from("timeslot_claims")
        .select(`
          id, timeslot_id, status,
          member:profiles!timeslot_claims_member_id_fkey(id, slug, full_name, avatar_url)
        `)
        .in("timeslot_id", slotIds)
        .in("status", ["confirmed", "performed"]);

      if (claimsError) throw claimsError;

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
            // Phase 4.109: Black on white for consistent scanning (was gold #d4a853 on transparent)
            const qrDataUrl = await QRCode.toDataURL(profileUrl, {
              width: 100,
              margin: 1,
              color: { dark: "#000000", light: "#ffffff" },
            });
            newQrCodes.set(slot.claim.member.id, qrDataUrl);
          } catch (err) {
            console.error("QR generation error:", err);
          }
        }
      }
      setQrCodes(newQrCodes);
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
      setLineupState(null);
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

    // Phase 4.100: Clear extended hint when connected
    setShowExtendedHint(false);
    if (extendedHintTimeoutRef.current) {
      clearTimeout(extendedHintTimeoutRef.current);
      extendedHintTimeoutRef.current = null;
    }

    setConnectionStatus("connected");
    setLoading(false);
    } catch (error) {
      console.error("Failed to fetch display data:", error);
      // Phase 4.99: Track failures for connection health
      setFailureCount(prev => prev + 1);
      if (failureCount >= 2) {
        setConnectionStatus("disconnected");
        // Phase 4.100: Track that we were disconnected for recovery banner
        wasDisconnectedRef.current = true;

        // Phase 4.100: Start 5-minute timer for extended hint (display page only)
        if (!extendedHintTimeoutRef.current) {
          extendedHintTimeoutRef.current = setTimeout(() => {
            setShowExtendedHint(true);
          }, 5 * 60 * 1000); // 5 minutes
        }
      } else {
        setConnectionStatus("reconnecting");
      }
      setLoading(false);
    }
  }, [routeParam, supabase, urlDate, failureCount, staticDataLoaded, fetchStaticData, tvMode]);

  // Initial fetch and auto-refresh every 5 seconds
  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Phase 4.105: Generate Event QR locally (tied to dateKey/event changes)
  // Phase 4.108: Also generate CSC Join QR for homepage
  React.useEffect(() => {
    async function generateEventQr() {
      if (!event) return;

      const eventIdentifier = event.slug || eventUuid || routeParam;
      const eventUrl = effectiveDateKey
        ? `${SITE_URL}/events/${eventIdentifier}?date=${effectiveDateKey}`
        : `${SITE_URL}/events/${eventIdentifier}`;

      try {
        const qrDataUrl = await QRCode.toDataURL(eventUrl, {
          width: 120,
          margin: 1,
          color: { dark: "#1a1a1a", light: "#ffffff" }, // Dark on white for scan reliability
        });
        setEventQrCode(qrDataUrl);
        setEventQrError(false);
      } catch (err) {
        console.error("Event QR generation error:", err);
        setEventQrError(true);
      }

      // Phase 4.108: Generate CSC Join QR (homepage)
      try {
        const joinQr = await QRCode.toDataURL(SITE_URL, {
          width: 80,
          margin: 1,
          color: { dark: "#1a1a1a", light: "#ffffff" },
        });
        setDscJoinQrCode(joinQr);
      } catch (err) {
        console.error("CSC Join QR generation error:", err);
      }
    }

    generateEventQr();
  }, [event, effectiveDateKey, eventUuid, routeParam]);

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

  // Phase 4.100: Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (recoveredTimeoutRef.current) {
        clearTimeout(recoveredTimeoutRef.current);
      }
      if (extendedHintTimeoutRef.current) {
        clearTimeout(extendedHintTimeoutRef.current);
      }
    };
  }, []);

  // Phase ABC7: Compute current slot from timeslot ID (must be before early returns for hooks rules)
  const currentSlotIndex = React.useMemo(() => {
    if (!lineupState?.now_playing_timeslot_id) return -1;
    return timeslots.findIndex(s => s.id === lineupState.now_playing_timeslot_id);
  }, [lineupState, timeslots]);

  const isLive = lineupState?.now_playing_timeslot_id !== null && lineupState?.now_playing_timeslot_id !== undefined;
  const nowPlayingSlot = isLive && currentSlotIndex >= 0 ? timeslots[currentSlotIndex] : null;
  // Phase 4.105: TV mode shows up to 20 slots with density tiers; non-TV shows 5
  const allUpNextSlots = timeslots.filter((_, idx) => idx > currentSlotIndex);
  const upNextSlots = tvMode ? allUpNextSlots.slice(0, 20) : allUpNextSlots.slice(0, 5);
  const completedSlots = currentSlotIndex >= 0 ? timeslots.filter((_, idx) => idx < currentSlotIndex) : [];

  // Phase 4.105: Density tier for TV mode (no scrollbars)
  // Large (≤8 slots): full-size avatars, QR codes
  // Medium (9-14 slots): smaller avatars, smaller QR
  // Phase 4.110: 3-tier adaptive slot sizing for 20 slots
  // Computed from TOTAL timeslots.length (stable) not upNextSlots.length (variable on Go Live)
  // This ensures no layout reflow when transitioning from pre-live to live state
  const getSlotTier = (slotCount: number): "large" | "medium" | "compact" => {
    if (slotCount <= 10) return "large";
    if (slotCount <= 14) return "medium";
    return "compact";
  };
  const slotTier = getSlotTier(timeslots.length);
  const use2Columns = timeslots.length > 10;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[var(--color-text-accent)] text-2xl animate-pulse">
          Loading lineup...
        </div>
      </div>
    );
  }

  // Phase 4.104: TV Poster Mode - Full-screen artistic overlay
  // Phase 4.108: Complete overhaul - stable layout, QR for all, prominent HOST, object-contain flyer
  if (tvMode) {
    // Check if we have roster data for this date
    const hasRosterData = timeslots.length > 0;

    return (
      <div className="fixed inset-0 z-[9999] overflow-hidden">
        {/* Phase 4.105: Stable organic texture background (NOT cover-based) */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
          {/* SVG noise texture overlay for organic feel */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="noise">
                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
                <feColorMatrix type="saturate" values="0"/>
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#noise)"/>
          </svg>
          {/* Subtle gradient accent */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-accent-primary)]/5 via-transparent to-transparent" />
        </div>

        {/* Phase 4.110: Reduced padding/gap for 20-slot fit at 720p */}
        <div className="relative z-10 h-full grid grid-rows-[auto_auto_minmax(0,1fr)] p-4 gap-2">
          {/* Connection status (subtle) */}
          <LineupStateBanner
            lastUpdated={lastUpdated}
            connectionStatus={connectionStatus}
            variant="subtle"
            showRecovered={showRecovered}
            showExtendedHint={showExtendedHint}
          />

          {/* Row 1: Header - Centered/balanced layout with all key info */}
          <header className="flex items-center justify-between">
            {/* Left: Date box */}
            {effectiveDateKey && (
              <div className="flex-shrink-0 w-20 h-20 bg-[var(--color-accent-primary)] rounded-xl flex flex-col items-center justify-center text-black shadow-lg">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "America/Denver" })}
                </span>
                <span className="text-3xl font-bold leading-none">
                  {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Denver" })}
                </span>
                <span className="text-xs font-medium uppercase">
                  {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Denver" })}
                </span>
              </div>
            )}

            {/* Center: Event title, venue, time - all centered */}
            <div className="flex-1 text-center px-4">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">
                {event?.title || "Event"}
              </h1>
              <div className="flex items-center justify-center gap-3 mt-1">
                {event?.venue_name && (
                  <span className="text-lg text-gray-200 drop-shadow">{event.venue_name}</span>
                )}
                {event?.venue_name && event?.start_time && (
                  <span className="text-gray-500">•</span>
                )}
                {event?.start_time && (
                  <span className="text-lg text-[var(--color-text-accent)]">
                    {formatEventTimeWindow(event.start_time, event.end_time)}
                  </span>
                )}
              </div>
              {/* CTA text centered */}
              <p className="text-base text-gray-300 mt-2 font-medium">
                Scan the QR codes to Follow and Support the Artists and our Collective
              </p>
            </div>

            {/* Right: LIVE badge + QR codes */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {isLive && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full text-base font-semibold animate-pulse shadow-lg">
                  <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                  LIVE
                </span>
              )}
              {dscJoinQrCode && (
                <div className="flex flex-col items-center gap-1">
                  <div className="bg-white rounded-lg p-1.5 shadow-lg">
                    <Image
                      src={dscJoinQrCode}
                      alt="Our Collective"
                      width={70}
                      height={70}
                      className="rounded"
                    />
                  </div>
                  <p className="text-xs text-gray-300 uppercase tracking-wider font-semibold">OUR COLLECTIVE</p>
                </div>
              )}
              {eventQrCode && !eventQrError && (
                <div className="flex flex-col items-center gap-1">
                  <div className="bg-white rounded-lg p-1.5 shadow-lg">
                    <Image
                      src={eventQrCode}
                      alt="Event Page"
                      width={70}
                      height={70}
                      className="rounded"
                    />
                  </div>
                  <p className="text-xs text-gray-300 uppercase tracking-wider font-semibold">EVENT PAGE</p>
                </div>
              )}
            </div>
          </header>

          {/* Row 2: Host badges row with Phase 4.108 prominent HOST label */}
          {allHosts.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-3">
                {allHosts.map((h) => (
                  <div key={h.id} className={`flex items-center gap-2 backdrop-blur-sm rounded-xl px-3 py-2 border ${
                    h.role === "host"
                      ? "bg-[var(--color-accent-primary)]/20 border-[var(--color-accent-primary)]/40"
                      : "bg-black/40 border-white/10"
                  }`}>
                    {h.avatar_url ? (
                      <Image
                        src={h.avatar_url}
                        alt={h.full_name || "Host"}
                        width={h.role === "host" ? 48 : 40}
                        height={h.role === "host" ? 48 : 40}
                        className={`rounded-full object-cover ${
                          h.role === "host"
                            ? "border-2 border-[var(--color-accent-primary)] shadow-lg"
                            : "border border-white/30"
                        }`}
                      />
                    ) : (
                      <div className={`rounded-full flex items-center justify-center ${
                        h.role === "host"
                          ? "w-12 h-12 bg-[var(--color-accent-primary)]/40"
                          : "w-10 h-10 bg-gray-700/50"
                      }`}>
                        <span className={`text-[var(--color-text-accent)] ${h.role === "host" ? "text-xl" : "text-base"}`}>
                          {h.full_name?.[0] || "?"}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      {/* Phase 4.108: Prominent HOST badge ABOVE name */}
                      {h.role === "host" ? (
                        <div className="px-2 py-0.5 bg-[var(--color-accent-primary)] rounded-full mb-1 self-start">
                          <span className="text-xs font-bold text-black uppercase tracking-wider">★ HOST</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Co-host</span>
                      )}
                      <p className={`font-semibold ${
                        h.role === "host"
                          ? "text-lg text-[var(--color-text-accent)]"
                          : "text-base text-white"
                      }`}>
                        {h.full_name || "Host"}
                      </p>
                    </div>
                    {/* Host QR on white tile */}
                    {hostQrCodes.get(h.id) && (
                      <div className="bg-white rounded-md p-1 ml-1">
                        <Image
                          src={hostQrCodes.get(h.id)!}
                          alt={`${h.full_name} QR`}
                          width={h.role === "host" ? 56 : 44}
                          height={h.role === "host" ? 56 : 44}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Main content - fills remaining space */}
          <div className="grid grid-cols-12 gap-4 min-h-0">
            {/* Phase 4.108: Foreground flyer panel with object-contain (no cropping) */}
            {displayCoverImage && (
              <div className="col-span-3 flex flex-col min-h-0">
                <div className="flex-1 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-gray-900 flex items-center justify-center min-h-0">
                  <Image
                    src={displayCoverImage}
                    alt={event?.title || "Event flyer"}
                    width={400}
                    height={600}
                    className="max-w-full max-h-full object-contain"
                    priority
                  />
                </div>
              </div>
            )}

            {/* Now Playing - HUGE frame-filling layout */}
            <div className={`${displayCoverImage ? "col-span-4" : "col-span-5"} flex flex-col min-h-0`}>
              <h2 className="text-2xl font-bold text-[var(--color-text-accent)] uppercase tracking-wider mb-3 flex-shrink-0">
                NOW PLAYING
              </h2>
              <div className="flex-1 bg-black/60 backdrop-blur-sm border-2 border-[var(--color-accent-primary)]/50 rounded-2xl p-6 min-h-0 flex flex-col">
                {/* Phase 4.113: Now Playing - HUGE layout with frame-filling avatar */}
                {nowPlayingSlot?.claim?.member ? (
                  <div className="flex flex-col items-center text-center flex-1 justify-center gap-4">
                    {/* Large avatar that dominates the frame */}
                    {nowPlayingSlot.claim.member.avatar_url ? (
                      <Image
                        src={nowPlayingSlot.claim.member.avatar_url}
                        alt={nowPlayingSlot.claim.member.full_name || "Performer"}
                        width={180}
                        height={180}
                        className="rounded-full object-cover border-4 border-[var(--color-accent-primary)] shadow-2xl"
                      />
                    ) : (
                      <div className="w-44 h-44 rounded-full bg-[var(--color-accent-primary)]/30 flex items-center justify-center">
                        <span className="text-7xl text-[var(--color-text-accent)]">
                          {nowPlayingSlot.claim.member.full_name?.[0] || "?"}
                        </span>
                      </div>
                    )}
                    {/* HUGE performer name */}
                    <h3 className="text-5xl font-bold text-white drop-shadow-lg leading-tight">
                      {nowPlayingSlot.claim.member.full_name || "Anonymous"}
                    </h3>
                    {/* QR code with prominent CTA */}
                    {qrCodes.get(nowPlayingSlot.claim.member.id) && (
                      <div className="flex flex-col items-center">
                        <div className="bg-white rounded-xl p-2 shadow-xl">
                          <Image
                            src={qrCodes.get(nowPlayingSlot.claim.member.id)!}
                            alt="Profile QR"
                            width={100}
                            height={100}
                          />
                        </div>
                        {/* HUGE CTA text */}
                        <p className="text-xl text-[var(--color-text-accent)] mt-3 font-semibold">
                          SCAN TO FOLLOW + TIP
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center flex-1">
                    <p className="text-2xl text-gray-500">
                      {isLive ? "Intermission" : "Not started yet"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Phase 4.109: Up Next - 2-column layout when >10 slots, adaptive sizing */}
            <div className={`${displayCoverImage ? "col-span-5" : "col-span-7"} flex flex-col min-h-0`}>
              <h2 className="text-xl font-bold text-gray-300 uppercase tracking-wider mb-3 flex-shrink-0">
                UP NEXT
              </h2>
              <div className="flex-1 overflow-hidden min-h-0">
                {hasRosterData ? (
                  (() => {
                    // Phase 4.110: Tier-specific styling (slotTier and use2Columns computed at component level for stability)
                    const slotPadding = slotTier === "large" ? "p-2.5 gap-3" : slotTier === "medium" ? "p-1.5 gap-2" : "p-1 gap-1.5";
                    const slotRounding = slotTier === "large" ? "rounded-xl" : "rounded-lg";
                    const containerGap = slotTier === "large" ? "gap-2" : slotTier === "medium" ? "gap-1.5" : "gap-1";

                    return (
                      <div className={`h-full ${use2Columns ? `grid grid-cols-2 ${containerGap}` : `flex flex-col ${containerGap}`}`}>
                        {upNextSlots.length > 0 ? (
                          upNextSlots.map((slot, index) => (
                            <div
                              key={slot.id}
                              className={`flex items-center transition-all ${use2Columns ? "" : "flex-shrink-0"} ${slotPadding} ${slotRounding} border ${
                                index === 0
                                  ? "bg-[var(--color-accent-primary)]/20 border-[var(--color-accent-primary)]/50"
                                  : "bg-black/40 border-white/10"
                              }`}
                            >
                              {/* Phase 4.110: Slot number badge - size varies by tier */}
                              <div className={`rounded-full bg-gray-800/80 flex items-center justify-center font-bold text-gray-400 flex-shrink-0 ${
                                slotTier === "large" ? "w-10 h-10 text-base" : slotTier === "medium" ? "w-8 h-8 text-sm" : "w-6 h-6 text-xs"
                              }`}>
                                {slot.slot_index + 1}
                              </div>
                              {slot.claim?.member ? (
                                <>
                                  {/* Phase 4.110: Avatar - show in large/medium tier, hide in compact to save space */}
                                  {slotTier !== "compact" && (
                                    slot.claim.member.avatar_url ? (
                                      <Image
                                        src={slot.claim.member.avatar_url}
                                        alt={slot.claim.member.full_name || ""}
                                        width={slotTier === "large" ? 36 : 28}
                                        height={slotTier === "large" ? 36 : 28}
                                        className="rounded-full object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className={`rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center flex-shrink-0 ${
                                        slotTier === "large" ? "w-9 h-9" : "w-7 h-7"
                                      }`}>
                                        <span className={`text-[var(--color-text-accent)] ${slotTier === "large" ? "text-sm" : "text-xs"}`}>
                                          {slot.claim.member.full_name?.[0] || "?"}
                                        </span>
                                      </div>
                                    )
                                  )}
                                  <div className="flex-1 min-w-0">
                                    {/* Phase 4.110: Name font size by tier */}
                                    <p className={`font-semibold truncate ${
                                      slotTier === "large"
                                        ? (index === 0 ? "text-white text-lg" : "text-gray-300 text-base")
                                        : slotTier === "medium"
                                          ? (index === 0 ? "text-white text-base" : "text-gray-300 text-sm")
                                          : (index === 0 ? "text-white text-sm" : "text-gray-300 text-xs")
                                    }`}>
                                      {slot.claim.member.full_name || "Anonymous"}
                                    </p>
                                  </div>
                                  {/* Phase 4.110: QR for performers with profiles, adaptive sizing by tier */}
                                  {qrCodes.get(slot.claim.member.id) && (
                                    (() => {
                                      // In compact mode, only show QR for first 4 performers
                                      if (slotTier === "compact" && index > 3) return null;
                                      // In medium mode, limit QR to first 6
                                      if (slotTier === "medium" && index > 5) return null;
                                      const qrSize = slotTier === "large" ? 44 : slotTier === "medium" ? 36 : 28;
                                      return (
                                        <div className="bg-white rounded-md p-0.5 flex-shrink-0">
                                          <Image
                                            src={qrCodes.get(slot.claim.member.id)!}
                                            alt="QR"
                                            width={qrSize}
                                            height={qrSize}
                                          />
                                        </div>
                                      );
                                    })()
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Phase 4.110: Open slot - only show placeholder avatar in large mode */}
                                  {slotTier === "large" && (
                                    <div className="w-9 h-9 rounded-full bg-gray-800/50 flex items-center justify-center flex-shrink-0">
                                      <span className="text-gray-600 text-sm">?</span>
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <p className={`font-semibold text-gray-500 ${
                                      slotTier === "large" ? "text-base" : slotTier === "medium" ? "text-sm" : "text-xs"
                                    }`}>Open Slot</p>
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-base text-gray-500 col-span-2">
                            No more performers scheduled
                          </div>
                        )}

                        {/* Completed performers - only show when space allows */}
                        {!use2Columns && completedSlots.length > 0 && upNextSlots.length <= 5 && (
                          <div className="mt-2 pt-2 border-t border-white/10 flex-shrink-0">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Already Performed</p>
                            <div className="flex flex-wrap gap-1.5">
                              {completedSlots.slice(0, 6).map(slot => (
                                slot.claim?.member && (
                                  <div
                                    key={slot.id}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-black/30 rounded-full text-xs text-gray-500"
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
                    );
                  })()
                ) : (
                  /* Empty state for past dates with no roster */
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-6">
                      <p className="text-xl text-gray-400 mb-1">No performer data</p>
                      <p className="text-sm text-gray-500">No lineup information available for this date</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default (non-TV) mode
  return (
    <div className="min-h-screen bg-black text-white p-8 overflow-hidden">
      {/* Phase 4.99: Subtle connection status for TV display */}
      <LineupStateBanner
        lastUpdated={lastUpdated}
        connectionStatus={connectionStatus}
        variant="subtle"
        showRecovered={showRecovered}
        showExtendedHint={showExtendedHint}
      />

      {/* Header - Phase 4.102: Increased typography for TV readability */}
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-8">
          {/* Date Box - Phase ABC7: Use effectiveDateKey for occurrence date */}
          {/* Phase 4.102: Larger date box for TV visibility */}
          {effectiveDateKey && (
            <div className="flex-shrink-0 w-28 h-28 bg-[var(--color-accent-primary)] rounded-xl flex flex-col items-center justify-center text-black">
              <span className="text-base font-semibold uppercase tracking-wide">
                {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "America/Denver" })}
              </span>
              <span className="text-5xl font-bold leading-none">
                {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Denver" })}
              </span>
              <span className="text-sm font-medium uppercase">
                {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Denver" })}
              </span>
            </div>
          )}
          <div>
            {/* Phase 4.102: text-5xl for TV readability (was text-4xl) */}
            <h1 className="text-5xl font-bold text-[var(--color-text-accent)]">
              {event?.title || "Event"}
            </h1>
            {/* Phase 4.102: text-2xl for TV readability (was text-xl) */}
            {event?.venue_name && (
              <p className="text-2xl text-gray-400 mt-2">{event.venue_name}</p>
            )}
            {/* Phase ABC7: Use effectiveDateKey for occurrence date display */}
            {/* Phase 4.102: text-lg for TV readability (was text-sm) */}
            {effectiveDateKey && (
              <p className="text-lg text-gray-500 mt-1">
                {new Date(effectiveDateKey + "T12:00:00Z").toLocaleDateString("en-US", {
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
          {/* Phase 4.102: text-6xl for TV readability (was text-5xl) */}
          <p className="text-6xl font-mono text-white">
            {currentTime.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
          {isLive && (
            <span className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-red-600 rounded-full text-lg font-semibold animate-pulse">
              <span className="w-3 h-3 bg-white rounded-full"></span>
              LIVE
            </span>
          )}
        </div>
      </header>

      {/* Phase 4.102: Adjusted grid height to accommodate QR strip at bottom */}
      <div className="grid grid-cols-12 gap-8 h-[calc(100vh-380px)]">
        {/* Now Playing - Left side (large) */}
        <div className="col-span-5">
          {/* Phase 4.102: text-2xl for TV readability (was text-lg) */}
          <h2 className="text-2xl font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Now Playing
          </h2>
          {nowPlayingSlot?.claim?.member ? (
            <div className="bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-transparent border-2 border-[var(--color-accent-primary)] rounded-2xl p-8 h-[calc(100%-48px)]">
              <div className="flex flex-col items-center text-center h-full justify-center">
                {nowPlayingSlot.claim.member.avatar_url ? (
                  <Image
                    src={nowPlayingSlot.claim.member.avatar_url}
                    alt={nowPlayingSlot.claim.member.full_name || "Performer"}
                    width={224}
                    height={224}
                    className="rounded-full object-cover border-4 border-[var(--color-accent-primary)] mb-6"
                  />
                ) : (
                  <div className="w-56 h-56 rounded-full bg-[var(--color-accent-primary)]/30 flex items-center justify-center mb-6">
                    <span className="text-8xl text-[var(--color-text-accent)]">
                      {nowPlayingSlot.claim.member.full_name?.[0] || "?"}
                    </span>
                  </div>
                )}
                {/* Phase 4.102: text-5xl for TV readability (was text-4xl) */}
                <h3 className="text-5xl font-bold text-white mb-3">
                  {nowPlayingSlot.claim.member.full_name || "Anonymous"}
                </h3>
                {/* Phase 4.102: text-2xl for TV readability (was text-xl) */}
                <p className="text-2xl text-[var(--color-text-accent)]">
                  {formatSlotTime(event?.start_time || null, nowPlayingSlot.start_offset_minutes, nowPlayingSlot.duration_minutes)}
                </p>
                {qrCodes.get(nowPlayingSlot.claim.member.id) && (
                  <div className="mt-6">
                    <Image
                      src={qrCodes.get(nowPlayingSlot.claim.member.id)!}
                      alt="Profile QR Code"
                      width={120}
                      height={120}
                      className="mx-auto"
                    />
                    <p className="text-sm text-gray-500 mt-2">Scan for profile</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 h-[calc(100%-48px)] flex items-center justify-center">
              {/* Phase 4.102: text-3xl for TV readability (was text-2xl) */}
              <p className="text-3xl text-gray-500">
                {isLive ? "Intermission" : "Not started yet"}
              </p>
            </div>
          )}
        </div>

        {/* Up Next - Right side */}
        <div className="col-span-7">
          {/* Phase 4.102: text-2xl for TV readability (was text-lg) */}
          <h2 className="text-2xl font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Up Next
          </h2>
          {/* Phase 4.102: Increased spacing and typography for TV readability */}
          <div className="space-y-4">
            {upNextSlots.length > 0 ? (
              upNextSlots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={`flex items-center gap-5 p-5 rounded-xl border transition-all ${
                    index === 0
                      ? "bg-[var(--color-accent-primary)]/10 border-[var(--color-accent-primary)]/50"
                      : "bg-gray-900/30 border-gray-800"
                  }`}
                >
                  {/* Phase 4.102: Larger slot number for TV */}
                  <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-400">
                    {slot.slot_index + 1}
                  </div>
                  {slot.claim?.member ? (
                    <>
                      {slot.claim.member.avatar_url ? (
                        <Image
                          src={slot.claim.member.avatar_url}
                          alt={slot.claim.member.full_name || ""}
                          width={56}
                          height={56}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                          <span className="text-lg text-[var(--color-text-accent)]">
                            {slot.claim.member.full_name?.[0] || "?"}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        {/* Phase 4.102: text-2xl for next up, text-xl for others */}
                        <p className={`font-semibold ${index === 0 ? "text-white text-2xl" : "text-gray-300 text-xl"}`}>
                          {slot.claim.member.full_name || "Anonymous"}
                        </p>
                        <p className="text-base text-gray-500">
                          {formatSlotTime(event?.start_time || null, slot.start_offset_minutes, slot.duration_minutes)}
                        </p>
                      </div>
                      {qrCodes.get(slot.claim.member.id) && index === 0 && (
                        <Image
                          src={qrCodes.get(slot.claim.member.id)!}
                          alt="QR"
                          width={80}
                          height={80}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
                        <span className="text-lg text-gray-600">?</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-xl text-gray-500">Open Slot</p>
                        <p className="text-base text-gray-600">
                          {formatSlotTime(event?.start_time || null, slot.start_offset_minutes, slot.duration_minutes)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xl text-gray-500">
                No more performers scheduled
              </div>
            )}
          </div>

          {/* Completed performers - Phase 4.102: Larger for TV visibility */}
          {completedSlots.length > 0 && (
            <div className="mt-8">
              <h3 className="text-base font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Already Performed
              </h3>
              <div className="flex flex-wrap gap-3">
                {completedSlots.map(slot => (
                  slot.claim?.member && (
                    <div
                      key={slot.id}
                      className="flex items-center gap-3 px-4 py-2 bg-gray-900/30 rounded-full text-base text-gray-500"
                    >
                      {slot.claim.member.avatar_url ? (
                        <Image
                          src={slot.claim.member.avatar_url}
                          alt=""
                          width={28}
                          height={28}
                          className="rounded-full object-cover opacity-50"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-800" />
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

      {/* Phase 4.102: QR Strip Footer with Event, Venue, Host QR codes */}
      <footer className="absolute bottom-0 left-0 right-0 bg-black/80 border-t border-white/10">
        <TvQrStrip
          eventSlugOrId={event?.slug || eventUuid || routeParam}
          venueSlugOrId={venue?.slug || venue?.id}
          venueName={venue?.name}
          hostSlugOrId={host?.slug || host?.id}
          hostName={host?.full_name}
        />
      </footer>
    </div>
  );
}
