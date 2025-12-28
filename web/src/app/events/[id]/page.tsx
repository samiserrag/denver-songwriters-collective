import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EVENT_TYPE_CONFIG } from "@/types/events";
import type { EventType } from "@/types/events";
import { RSVPSection } from "@/components/events/RSVPSection";
import { AddToCalendarButton } from "@/components/events/AddToCalendarButton";
import { TimeslotSection } from "@/components/events/TimeslotSection";
import { HostControls } from "@/components/events/HostControls";
import { PosterMedia } from "@/components/media";

export const dynamic = "force-dynamic";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("title, description, event_type, venue_name")
    .eq("id", id)
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

function getGoogleMapsUrl(address: string | null): string | null {
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

export default async function EventDetailPage({ params }: EventPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch event with venue join and recurrence info
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      id, title, description, event_type, venue_name, venue_address, venue_id,
      day_of_week, start_time, end_time, capacity, cover_image_url,
      is_dsc_event, status, created_at, event_date,
      has_timeslots, total_slots, slot_duration_minutes, is_published,
      is_recurring, recurrence_pattern
    `)
    .eq("id", id)
    .single();

  if (error || !event) {
    notFound();
  }

  // If venue_name is null but venue_id exists, fetch from venues table
  let venueName = event.venue_name;
  let venueAddress = event.venue_address;
  if (!venueName && event.venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("name, address")
      .eq("id", event.venue_id)
      .single();
    if (venue) {
      venueName = venue.name;
      venueAddress = venue.address;
    }
  }

  // Fetch hosts separately since there's no FK relationship between event_hosts and profiles
  const { data: eventHosts } = await supabase
    .from("event_hosts")
    .select("user_id")
    .eq("event_id", id);

  // Fetch host profiles if there are hosts
  let hosts: Array<{ id: string; full_name: string | null; avatar_url: string | null }> = [];
  if (eventHosts && eventHosts.length > 0) {
    const hostIds = eventHosts.map((h) => h.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", hostIds);
    hosts = profiles || [];
  }

  // Get attendance count - use timeslot_claims for timeslot events, event_rsvps otherwise
  let attendanceCount = 0;
  if (event.has_timeslots) {
    // First get the timeslot IDs for this event
    const { data: timeslots } = await supabase
      .from("event_timeslots")
      .select("id")
      .eq("event_id", id);

    if (timeslots && timeslots.length > 0) {
      const slotIds = timeslots.map(s => s.id);
      const { count } = await supabase
        .from("timeslot_claims")
        .select("*", { count: "exact", head: true })
        .in("timeslot_id", slotIds)
        .in("status", ["confirmed", "performed"]);
      attendanceCount = count || 0;
    }
  } else {
    const { count: rsvpCount } = await supabase
      .from("event_rsvps")
      .select("*", { count: "exact", head: true })
      .eq("event_id", id)
      .eq("status", "confirmed");
    attendanceCount = rsvpCount || 0;
  }

  const config = EVENT_TYPE_CONFIG[event.event_type as EventType] || EVENT_TYPE_CONFIG.other;
  const mapsUrl = getGoogleMapsUrl(venueAddress);
  const remaining = event.capacity ? Math.max(0, event.capacity - attendanceCount) : null;

  // Format recurrence pattern for display
  const getRecurrenceLabel = () => {
    if (!event.is_recurring || !event.recurrence_pattern) return null;
    switch (event.recurrence_pattern) {
      case "weekly": return `Every ${event.day_of_week || "week"}`;
      case "biweekly": return `Every other ${event.day_of_week || "week"}`;
      case "monthly": return "Monthly";
      default: return null;
    }
  };
  const recurrenceLabel = getRecurrenceLabel();

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
          {/* Event type and DSC badges */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-sm rounded flex items-center gap-1.5">
              <span>{config.icon}</span> {config.label}
            </span>
            {event.is_dsc_event && (
              <span className="px-2 py-1 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm rounded font-medium">
                DSC Event
              </span>
            )}
          </div>

          <h1 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-6">
            {event.title}
          </h1>

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
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-sm">
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
          </div>

          {/* Action buttons row */}
          <div className="flex flex-wrap items-start gap-4 mb-8">
            {/* Show RSVP button only for non-timeslot DSC events */}
            {event.is_dsc_event && !(event as { has_timeslots?: boolean }).has_timeslots && (
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
              />
            </div>
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
                    href={`/songwriters/${host.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] transition-colors"
                  >
                    {host.avatar_url ? (
                      <img
                        src={host.avatar_url}
                        alt={host.full_name || "Host"}
                        className="w-10 h-10 rounded-full object-cover"
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

          <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)]/30 border border-[var(--color-border-default)]">
            <p className="text-[var(--color-text-secondary)] text-sm">
              <span className="font-medium text-[var(--color-text-primary)]">{config.label}:</span> {config.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
