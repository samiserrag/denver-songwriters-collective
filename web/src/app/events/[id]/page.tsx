import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { EVENT_TYPE_CONFIG } from "@/types/events";
import type { EventType } from "@/types/events";
import { RSVPSection } from "@/components/events/RSVPSection";
import { AddToCalendarButton } from "@/components/events/AddToCalendarButton";
import { TimeslotSection } from "@/components/events/TimeslotSection";
import { HostControls } from "@/components/events/HostControls";
import { ClaimEventButton } from "@/components/events/ClaimEventButton";
import { AttendeeList } from "@/components/events/AttendeeList";
import { PosterMedia } from "@/components/media";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { hasMissingDetails } from "@/lib/events/missingDetails";
import { getPublicVerificationState, formatVerifiedDate } from "@/lib/events/verification";

export const dynamic = "force-dynamic";

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Support both UUID and slug lookups
  const { data: event } = isUUID(id)
    ? await supabase
        .from("events")
        .select("title, description, event_type, venue_name")
        .eq("id", id)
        .single()
    : await supabase
        .from("events")
        .select("title, description, event_type, venue_name")
        .eq("slug", id)
        .single();

  if (!event) {
    return {
      title: "Event Not Found | Denver Songwriters Collective",
      description: "This event could not be found.",
    };
  }

  const config = EVENT_TYPE_CONFIG[event.event_type as EventType] || EVENT_TYPE_CONFIG.other;
  const title = `${event.title} | ${config.label} | Denver Songwriters Collective`;
  const description = event.description
    ? event.description.slice(0, 155) + (event.description.length > 155 ? "..." : "")
    : `Join us for ${event.title}${event.venue_name ? ` at ${event.venue_name}` : ""}. A ${config.label.toLowerCase()} hosted by the Denver Songwriters Collective.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Denver Songwriters Collective",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Phase 4.0: Generate Google Maps URL
 * Supports lat/lng coordinates or address-based search
 */
function getGoogleMapsUrl(
  address: string | null,
  latitude?: number | null,
  longitude?: number | null
): string | null {
  // Prefer lat/lng if available (more precise)
  if (latitude && longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  // Fall back to address search
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * Format time from HH:MM:SS or HH:MM to human-readable format (e.g., "6:00 PM")
 */
function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Phase 4.43: Determines if an event has a functioning signup lane.
 *
 * RSVP is now always available for published, non-cancelled events.
 * - RSVP lane is always present (capacity=null means unlimited)
 * - Timeslot lane exists only if has_timeslots=true AND timeslot rows exist
 *
 * This function is used to detect "no signup method set" for host warnings.
 * Since RSVP is always available, this now returns true for any published event.
 */
function hasSignupLane(
  event: { has_timeslots?: boolean | null; capacity?: number | null; is_published?: boolean },
  timeslotCount: number
): boolean {
  // RSVP is always available for published events (capacity=null means unlimited)
  // The only "no signup" scenario is when timeslots are enabled but no slots exist
  if (event.has_timeslots && timeslotCount === 0) {
    // Timeslots enabled but no slots configured - missing performer lane
    // But RSVP still works, so return true
    return true;
  }
  // RSVP is always available
  return true;
}

export default async function EventDetailPage({ params }: EventPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch event with venue join and recurrence info
  // Phase 4.0: Include custom location fields
  // Phase 4.22.3: Include host_id for claim functionality
  // Support both UUID and slug lookups
  // Phase 4.37: Added slug, source, last_verified_at, verified_by for verification display
  const eventSelectQuery = `
      id, title, description, event_type, venue_name, venue_address, venue_id,
      day_of_week, start_time, end_time, capacity, cover_image_url,
      is_dsc_event, status, created_at, event_date, slug,
      has_timeslots, total_slots, slot_duration_minutes, is_published,
      is_recurring, recurrence_pattern,
      custom_location_name, custom_address, custom_city, custom_state,
      custom_latitude, custom_longitude, location_notes, location_mode,
      is_free, age_policy, host_id,
      source, last_verified_at, verified_by
    `;
  const { data: event, error } = isUUID(id)
    ? await supabase.from("events").select(eventSelectQuery).eq("id", id).single()
    : await supabase.from("events").select(eventSelectQuery).eq("slug", id).single();

  if (error || !event) {
    notFound();
  }

  // Phase 4.38: Canonical slug redirect - if accessed by UUID and event has slug, redirect to canonical
  if (isUUID(id) && event.slug) {
    redirect(`/events/${event.slug}`);
  }

  // Draft protection: only hosts/admins can view unpublished events
  if (!event.is_published) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      redirect("/happenings");
    }

    // Check if user is admin
    const isAdmin = await checkAdminRole(supabase, session.user.id);

    // Check if user is an event host
    // Phase 4.39: Use event.id (UUID) not route param which could be a slug
    const { data: hostEntry } = await supabase
      .from("event_hosts")
      .select("id")
      .eq("event_id", event.id)
      .eq("user_id", session.user.id)
      .eq("invitation_status", "accepted")
      .maybeSingle();

    if (!isAdmin && !hostEntry) {
      redirect("/happenings");
    }
  }

  // Compute derived states
  const isPastEvent = event.event_date
    ? new Date(event.event_date + "T23:59:59") < new Date()
    : false;
  const isCancelled = event.status === "cancelled";
  const needsVerification = event.status === "needs_verification";
  const canRSVP = !isCancelled && !isPastEvent && event.is_published;

  // Phase 4.37: Get verification state for display
  const verificationResult = getPublicVerificationState({
    status: event.status,
    host_id: (event as { host_id?: string | null }).host_id,
    source: (event as { source?: string | null }).source,
    last_verified_at: (event as { last_verified_at?: string | null }).last_verified_at,
    verified_by: (event as { verified_by?: string | null }).verified_by,
  });
  const verificationState = verificationResult.state;
  const isUnconfirmed = verificationState === "unconfirmed";

  // Phase 4.0: Resolve location name and address
  // Check venue first, then fall back to custom location
  let locationName: string | null = event.venue_name;
  let locationAddress: string | null = event.venue_address;
  let isCustomLocation = false;

  if (!locationName && event.venue_id) {
    // Fetch from venues table if venue_name wasn't denormalized
    const { data: venue } = await supabase
      .from("venues")
      .select("name, address, city, state")
      .eq("id", event.venue_id)
      .single();
    if (venue) {
      locationName = venue.name;
      const addressParts = [venue.address, venue.city, venue.state].filter(Boolean);
      locationAddress = addressParts.length > 0 ? addressParts.join(", ") : null;
    }
  }

  // Phase 4.0: Fall back to custom location if no venue
  if (!locationName && event.custom_location_name) {
    locationName = event.custom_location_name;
    isCustomLocation = true;
    // Build custom address from parts
    const addressParts = [
      event.custom_address,
      event.custom_city,
      event.custom_state
    ].filter(Boolean);
    locationAddress = addressParts.length > 0 ? addressParts.join(", ") : null;
  }

  // Keep legacy variable names for compatibility with rest of file
  const venueName = locationName;
  const venueAddress = locationAddress;

  // Fetch hosts separately since there's no FK relationship between event_hosts and profiles
  // Phase 4.39: Use event.id (UUID) not route param which could be a slug
  const { data: eventHosts } = await supabase
    .from("event_hosts")
    .select("user_id")
    .eq("event_id", event.id);

  // Fetch host profiles if there are hosts
  let hosts: Array<{ id: string; slug: string | null; full_name: string | null; avatar_url: string | null }> = [];
  if (eventHosts && eventHosts.length > 0) {
    const hostIds = eventHosts.map((h) => h.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, slug, full_name, avatar_url")
      .in("id", hostIds);
    hosts = profiles || [];
  }

  // Phase 4.43: Count RSVP attendees AND performer claims separately
  // RSVP = audience "planning to attend" (always available)
  // Timeslot claims = performers (when has_timeslots=true)
  let rsvpCount = 0;
  let performerCount = 0;
  let timeslotCount = 0;

  // Always count RSVPs (RSVP is always available)
  const { count: rsvpCountResult } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("status", "confirmed");
  rsvpCount = rsvpCountResult || 0;

  // Count performer claims if timeslots are enabled
  if (event.has_timeslots) {
    const { data: timeslots } = await supabase
      .from("event_timeslots")
      .select("id")
      .eq("event_id", event.id);

    timeslotCount = timeslots?.length || 0;

    if (timeslots && timeslots.length > 0) {
      const slotIds = timeslots.map(s => s.id);
      const { count } = await supabase
        .from("timeslot_claims")
        .select("*", { count: "exact", head: true })
        .in("timeslot_id", slotIds)
        .in("status", ["confirmed", "performed"]);
      performerCount = count || 0;
    }
  }

  // For RSVPSection, pass the RSVP count (not combined)
  const attendanceCount = rsvpCount;

  // Fetch approved gallery photos linked to this event
  // Phase 4.39: Use event.id (UUID) not route param which could be a slug
  const { data: eventPhotos } = await supabase
    .from("gallery_images")
    .select("id, image_url, caption")
    .eq("event_id", event.id)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(12);

  // Phase 4.22.3: Check for unclaimed event and user's existing claim
  const { data: { session } } = await supabase.auth.getSession();
  const eventHostId = (event as { host_id?: string | null }).host_id;
  const isUnclaimed = !eventHostId;
  const isUserTheHost = session && eventHostId === session.user.id;
  let userClaim: { status: "pending" | "approved" | "rejected"; rejection_reason?: string | null } | null = null;

  if (session && isUnclaimed) {
    // Phase 4.39: Use event.id (UUID) not route param which could be a slug
    const { data: existingClaim } = await supabase
      .from("event_claims")
      .select("status, rejection_reason")
      .eq("event_id", event.id)
      .eq("requester_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingClaim) {
      userClaim = {
        status: existingClaim.status as "pending" | "approved" | "rejected",
        rejection_reason: existingClaim.rejection_reason,
      };
    }
  }

  // Phase 4.32: Check if current user can manage this event (host or admin)
  let canManageEvent = false;
  let isAdminUser = false;
  if (session) {
    // Check if user is in event_hosts table
    const isEventHost = eventHosts?.some(h => h.user_id === session.user.id);
    // Check if user is admin
    isAdminUser = await checkAdminRole(supabase, session.user.id);
    // User can manage if they're the primary host, an event host, or an admin
    canManageEvent = isUserTheHost || isEventHost || isAdminUser;
  }

  // Phase 4.32: Check if signup lane exists (only shown to managers)
  const signupLaneExists = hasSignupLane(event, timeslotCount);

  const config = EVENT_TYPE_CONFIG[event.event_type as EventType] || EVENT_TYPE_CONFIG.other;
  // Phase 4.0: Pass lat/lng for custom locations
  const mapsUrl = getGoogleMapsUrl(
    venueAddress,
    isCustomLocation ? event.custom_latitude : null,
    isCustomLocation ? event.custom_longitude : null
  );
  const remaining = event.capacity ? Math.max(0, event.capacity - attendanceCount) : null;

  // Format recurrence pattern for display (available for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _getRecurrenceLabel = () => {
    if (!event.is_recurring || !event.recurrence_pattern) return null;
    switch (event.recurrence_pattern) {
      case "weekly": return `Every ${event.day_of_week || "week"}`;
      case "biweekly": return `Every other ${event.day_of_week || "week"}`;
      case "monthly": return "Monthly";
      default: return null;
    }
  };

  // Build calendar date from event_date + start_time
  let calendarStartDate: Date | null = null;
  let calendarEndDate: Date | null = null;
  if (event.event_date) {
    // Parse date (YYYY-MM-DD format)
    const [year, month, day] = event.event_date.split("-").map(Number);

    // Parse start time (HH:MM:SS or HH:MM format)
    if (event.start_time) {
      const [startHour, startMin] = event.start_time.split(":").map(Number);
      calendarStartDate = new Date(year, month - 1, day, startHour, startMin);

      // Parse end time if available, otherwise default to 2 hours after start
      if (event.end_time) {
        const [endHour, endMin] = event.end_time.split(":").map(Number);
        calendarEndDate = new Date(year, month - 1, day, endHour, endMin);
      } else {
        calendarEndDate = new Date(calendarStartDate.getTime() + 2 * 60 * 60 * 1000);
      }
    } else {
      // All-day event if no start time
      calendarStartDate = new Date(year, month - 1, day);
      calendarEndDate = new Date(year, month - 1, day + 1);
    }
  }

  const venueLocation = [venueName, venueAddress].filter(Boolean).join(", ");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Status Banners */}
      {isCancelled && (
        <div className="mb-4 p-4 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚫</span>
            <div>
              <p className="font-semibold">This event has been cancelled</p>
              <p className="text-sm text-red-300/80">RSVP and signups are no longer available.</p>
            </div>
          </div>
        </div>
      )}
      {needsVerification && !isCancelled && (
        <div className="mb-4 p-4 rounded-lg bg-amber-900/30 border border-amber-500/40 text-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Schedule may have changed</p>
              <p className="text-sm text-amber-300/80">We&apos;re confirming details with the venue. Check back soon!</p>
            </div>
          </div>
        </div>
      )}
      {isPastEvent && !isCancelled && (
        <div className="mb-4 p-4 rounded-lg bg-slate-900/30 border border-slate-500/40 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <div>
              <p className="font-semibold">This event has ended</p>
              <p className="text-sm text-slate-300/80">Check out upcoming happenings for future events.</p>
            </div>
          </div>
        </div>
      )}
      {!event.is_published && (
        <div className="mb-4 p-4 rounded-lg bg-amber-900/30 border border-amber-500/40 text-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <div>
              <p className="font-semibold">Draft Preview</p>
              <p className="text-sm text-amber-300/80">This event is not published yet. Only you and admins can see it.</p>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4.32: No signup lane warning - only visible to hosts/admins */}
      {canManageEvent && event.is_dsc_event && !signupLaneExists && (
        <div className="mb-4 p-4 rounded-lg bg-amber-900/30 border border-amber-500/40 text-amber-300">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚙️</span>
              <div>
                <p className="font-semibold">No sign-up method configured</p>
                <p className="text-sm text-amber-300/80">
                  {event.has_timeslots
                    ? "Timeslots are enabled but no slots have been generated yet."
                    : "Set a capacity to enable RSVP, or enable performance slots."}
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/my-events/${event.id}`}
              className="flex-shrink-0 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-[var(--color-text-primary)] font-medium text-sm transition-colors"
            >
              Fix Sign-up
            </Link>
          </div>
        </div>
      )}

      <Link
        href="/happenings"
        className="inline-flex items-center gap-2 text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Happenings
      </Link>

      <div className="rounded-2xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
        {/* Poster - Phase 3.1: full width, natural height, no cropping */}
        <PosterMedia
          src={event.cover_image_url}
          alt={event.title}
          variant="detail"
          priority={true}
        />

        <div className="p-6 md:p-8">
          {/* Event type, DSC, and verification badges */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-sm rounded flex items-center gap-1.5">
              <span>{config.icon}</span> {config.label}
            </span>
            {event.is_dsc_event && (
              <span className="px-2 py-1 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm rounded font-medium">
                DSC Event
              </span>
            )}
            {/* Phase 4.39: Always-visible verification pill (matches HappeningCard) */}
            {verificationState === "confirmed" && (
              <span className="inline-flex items-center px-2 py-1 text-sm font-medium rounded bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)] border border-[var(--pill-border-success)]">
                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Confirmed
              </span>
            )}
            {verificationState === "unconfirmed" && (
              <span className="inline-flex items-center px-2 py-1 text-sm font-medium rounded bg-[var(--pill-bg-warning)] text-[var(--pill-fg-warning)] border border-[var(--pill-border-warning)]">
                Unconfirmed
              </span>
            )}
            {verificationState === "cancelled" && (
              <span className="inline-flex items-center px-2 py-1 text-sm font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30">
                Cancelled
              </span>
            )}
          </div>

          <h1 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-4">
            {event.title}
          </h1>

          {/* Phase 4.37: Verification status block */}
          {verificationState === "cancelled" && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-100 text-red-800 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>
                <span className="font-medium">Cancelled</span>
                <span className="ml-1">— This event has been cancelled.</span>
              </span>
            </div>
          )}
          {isUnconfirmed && !isCancelled && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-amber-100 text-amber-800 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-medium">Happening (not confirmed)</span>
                <span className="block text-sm mt-0.5">
                  {/* Phase 4.42k: Source-aware copy for unconfirmed events */}
                  {(event as { source?: string }).source === "import" ? (
                    <>This event was imported from an external source and hasn&apos;t been verified yet.</>
                  ) : (
                    <>This event is awaiting admin verification.</>
                  )}
                  {verificationResult.lastVerifiedAt && (
                    <span className="ml-1">Last verified: {formatVerifiedDate(verificationResult.lastVerifiedAt)}</span>
                  )}
                </span>
                <div className="flex gap-3 mt-1">
                  <Link
                    href={`/open-mics/${(event as { slug?: string }).slug || event.id}`}
                    className="text-sm underline hover:no-underline"
                  >
                    Suggest an update
                  </Link>
                  {isAdminUser && (
                    <Link
                      href="/dashboard/admin/open-mics"
                      className="text-sm underline hover:no-underline"
                    >
                      Admin: Manage status
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Phase 4.39: Removed old confirmed text block - pill in badges row is now the canonical display */}

          {/* Phase 4.1: Missing details indicator */}
          {hasMissingDetails({
            location_mode: event.location_mode,
            venue_id: event.venue_id,
            venue_name: event.venue_name,
            custom_location_name: event.custom_location_name,
            online_url: (event as any).online_url,
            is_free: (event as any).is_free,
            age_policy: (event as any).age_policy,
            is_dsc_event: event.is_dsc_event,
            event_type: event.event_type
          }) && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-amber-100 text-amber-800 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                <span className="font-medium">Missing details</span>
                <span className="ml-1">— Know more about this event? Contact an admin to help complete this listing.</span>
              </span>
            </div>
          )}

          {/* Compact info row: Date | Time | Venue | Spots */}
          <div className="mb-6 p-4 rounded-xl bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-default)]">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[var(--color-text-primary)]">
              {/* Date */}
              {event.event_date && (
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-accent)]">📅</span>
                  <span className="font-medium">
                    {new Date(event.event_date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      timeZone: "America/Denver",
                    })}
                  </span>
                </div>
              )}

              {/* Time */}
              {event.start_time && (
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-accent)]">🕐</span>
                  <span>
                    {formatTime(event.start_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ""}
                  </span>
                </div>
              )}

              {/* Venue */}
              {venueName && (
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-accent)]">📍</span>
                  <span>{venueName}</span>
                </div>
              )}

              {/* Spots remaining */}
              {remaining !== null && (
                <div className="flex items-center gap-2">
                  {remaining === 0 ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-sm font-medium">
                      Full
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)] text-sm font-medium">
                      {remaining} {remaining === 1 ? "spot" : "spots"} left
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Address on separate line if exists */}
            {venueAddress && (
              <p className="mt-2 text-[var(--color-text-secondary)] text-sm pl-6">
                {venueAddress}
              </p>
            )}

            {/* Phase 4.0: Location notes (e.g., "Back room", "Meet at north entrance") */}
            {event.location_notes && (
              <p className="mt-1 text-[var(--color-text-secondary)] text-sm pl-6 italic">
                {event.location_notes}
              </p>
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex flex-wrap items-start gap-4 mb-8">
            {/* Phase 4.43: RSVP is always available for DSC events (even with timeslots) */}
            {/* RSVP = audience/supporters "planning to attend", not performer signup */}
            {canRSVP && event.is_dsc_event && (
              <Suspense fallback={
                <div className="animate-pulse">
                  <div className="h-12 w-32 bg-[var(--color-bg-tertiary)] rounded-lg"></div>
                </div>
              }>
                <RSVPSection
                  eventId={event.id}
                  eventTitle={event.title}
                  capacity={event.capacity}
                  initialConfirmedCount={attendanceCount}
                />
              </Suspense>
            )}
            {calendarStartDate && (
              <AddToCalendarButton
                title={event.title}
                description={event.description}
                location={venueLocation}
                startDate={calendarStartDate}
                endDate={calendarEndDate || undefined}
              />
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] text-[var(--color-text-primary)] font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Get Directions
              </a>
            )}
          </div>

          {/* Host Controls - only visible to hosts/admins */}
          {event.is_dsc_event && (
            <HostControls
              eventId={event.id}
              hasTimeslots={(event as { has_timeslots?: boolean }).has_timeslots || false}
            />
          )}

          {/* About section - shown above timeslots */}
          {event.description && (
            <div className="mb-8">
              <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">About This Event</h2>
              <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Timeslot claiming section for timeslot-enabled events */}
          {event.is_dsc_event && (event as { has_timeslots?: boolean }).has_timeslots && (
            <div className="mb-8">
              <TimeslotSection
                eventId={event.id}
                eventStartTime={event.start_time}
                totalSlots={(event as { total_slots?: number }).total_slots || 10}
                slotDuration={(event as { slot_duration_minutes?: number }).slot_duration_minutes || 15}
                disabled={!canRSVP}
              />
            </div>
          )}

          {/* Phase 4.43: Attendee list (RSVP'd members) */}
          {event.is_dsc_event && (
            <AttendeeList
              eventId={event.id}
              hasTimeslots={(event as { has_timeslots?: boolean }).has_timeslots || false}
              performerCount={performerCount}
            />
          )}

          {hosts.length > 0 && (
            <div className="mb-8">
              <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">
                {hosts.length === 1 ? "Host" : "Hosts"}
              </h2>
              <div className="flex flex-wrap gap-4">
                {hosts.map((host) => host && (
                  <Link
                    key={host.id}
                    href={`/songwriters/${host.slug || host.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] transition-colors"
                  >
                    {host.avatar_url ? (
                      <Image
                        src={host.avatar_url}
                        alt={host.full_name || "Host"}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                        <span className="text-[var(--color-text-accent)]">
                          {host.full_name?.[0] || "?"}
                        </span>
                      </div>
                    )}
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {host.full_name || "Anonymous Host"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Event Photos Section */}
          {eventPhotos && eventPhotos.length > 0 && (
            <div className="mb-8">
              <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">
                Photos
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {eventPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
                  >
                    <Image
                      src={photo.image_url}
                      alt={photo.caption || "Event photo"}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                Have photos from this event?{" "}
                <Link
                  href="/dashboard/gallery"
                  className="text-[var(--color-text-accent)] hover:underline"
                >
                  Share them with the community
                </Link>
              </p>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)]/30 border border-[var(--color-border-default)]">
            <p className="text-[var(--color-text-secondary)] text-sm">
              <span className="font-medium text-[var(--color-text-primary)]">{config.label}:</span> {config.description}
            </p>
          </div>

          {/* Phase 4.22.3: Host confirmation or Claim Event Section */}
          {isUserTheHost && (
            <div className="mt-8 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 text-lg">✓</span>
                <div>
                  <p className="font-medium text-emerald-400">You are the host of this event</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Manage this event from your{" "}
                    <Link href="/dashboard/my-events" className="text-[var(--color-text-accent)] hover:underline">
                      dashboard
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}
          {session && isUnclaimed && (
            <div className="mt-8">
              <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">
                Claim This Event
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Are you the organizer of this event? Request ownership to manage details and updates.
              </p>
              <ClaimEventButton
                eventId={event.id}
                eventTitle={event.title}
                existingClaim={userClaim}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
