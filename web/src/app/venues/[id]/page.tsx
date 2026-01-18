import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SeriesCard, type SeriesEvent } from "@/components/happenings/SeriesCard";
import { PageContainer } from "@/components/layout";
import { PhotoGallery } from "@/components/profile/PhotoGallery";
import { chooseVenueLink, isValidUrl } from "@/lib/venue/chooseVenueLink";
import { getVenueDirectionsUrl } from "@/lib/venue/getDirectionsUrl";
import {
  getTodayDenver,
  addDaysDenver,
  groupEventsAsSeriesView,
  buildOverrideMap,
} from "@/lib/events/nextOccurrence";

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

interface VenueDetailParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: VenueDetailParams): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Phase ABC4: Support both UUID and slug lookups
  const { data: venue } = isUUID(id)
    ? await supabase.from("venues").select("name, city, state").eq("id", id).single()
    : await supabase.from("venues").select("name, city, state").eq("slug", id).single();

  if (!venue) {
    return { title: "Venue Not Found | Denver Songwriters Collective" };
  }

  const location = [venue.city, venue.state].filter(Boolean).join(", ");
  return {
    title: `${venue.name} | Denver Songwriters Collective`,
    description: `Discover happenings at ${venue.name}${location ? ` in ${location}` : ""}. Open mics, showcases, and music events.`,
  };
}

export const dynamic = "force-dynamic";

export default async function VenueDetailPage({ params }: VenueDetailParams) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const today = getTodayDenver();
  const windowEnd = addDaysDenver(today, 90);

  // Query venue details (excluding admin-only 'notes' field)
  // Phase ABC4: Support both UUID and slug lookups + add slug field
  const venueSelectQuery = `
      id,
      slug,
      name,
      address,
      city,
      state,
      zip,
      neighborhood,
      google_maps_url,
      website_url,
      phone,
      contact_link,
      accessibility_notes,
      parking_notes,
      cover_image_url
    `;
  const { data: venue, error: venueError } = isUUID(id)
    ? await supabase.from("venues").select(venueSelectQuery).eq("id", id).single()
    : await supabase.from("venues").select(venueSelectQuery).eq("slug", id).single();

  if (venueError || !venue) {
    notFound();
  }

  // Phase ABC4: Canonical slug redirect - if accessed by UUID and venue has slug, redirect to canonical
  if (isUUID(id) && venue.slug) {
    redirect(`/venues/${venue.slug}`);
  }

  // Query ALL events at this venue (no date filter - let occurrence expansion handle dates)
  // Phase ABC4: Recurring events with past anchor dates must still appear if they have future occurrences
  // IMPORTANT: Use venue.id (UUID) not id (which may be a slug)
  // NOTE: Only include columns that exist in the events table schema
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(`
      id,
      slug,
      title,
      event_type,
      event_date,
      day_of_week,
      start_time,
      end_time,
      recurrence_rule,
      is_recurring,
      status,
      cover_image_url,
      is_dsc_event,
      is_free,
      cost_label,
      signup_time,
      capacity,
      has_timeslots,
      last_verified_at,
      verified_by,
      source,
      host_id,
      location_mode,
      venue_name,
      venue_address
    `)
    .eq("venue_id", venue.id)
    .eq("is_published", true)
    .in("status", ["active", "needs_verification", "unverified"]);

  if (eventsError) {
    console.error("Error fetching events:", eventsError);
    throw new Error(`Events query failed: ${eventsError.message} (code: ${eventsError.code})`);
  }

  // Get event IDs for override query
  const eventIds = (events ?? []).map((e) => e.id);

  // Query occurrence overrides for this venue's events within the window
  const { data: overridesData } = eventIds.length > 0
    ? await supabase
        .from("occurrence_overrides")
        .select("event_id, date_key, status, override_start_time, override_cover_image_url, override_notes")
        .in("event_id", eventIds)
        .gte("date_key", today)
        .lte("date_key", windowEnd)
    : { data: [] };

  const overrideMap = buildOverrideMap(
    (overridesData || []).map((o) => ({
      event_id: o.event_id,
      date_key: o.date_key,
      status: o.status as "normal" | "cancelled",
      override_start_time: o.override_start_time,
      override_cover_image_url: o.override_cover_image_url,
      override_notes: o.override_notes,
    }))
  );

  // Fetch venue images for photo gallery
  const { data: venueImages } = await supabase
    .from("venue_images")
    .select("id, image_url")
    .eq("venue_id", venue.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Map events to SeriesEvent format with venue info
  // Phase ABC4: Include venue slug for SeriesCard internal links
  // Use venue.id (UUID) not id (which may be a slug)
  const eventsWithVenue: SeriesEvent[] = (events ?? []).map((event) => ({
    ...event,
    venue_name: event.venue_name || venue.name,
    venue_address: event.venue_address || venue.address,
    venue_id: venue.id,
    venue: {
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      address: venue.address,
      google_maps_url: venue.google_maps_url,
      website_url: venue.website_url,
    },
  }));

  // De-duplicate events by title (keep the one with the most complete data)
  // This handles cases where duplicate DB records exist for the same event at a venue
  const deduplicatedEvents = Array.from(
    eventsWithVenue.reduce((map, event) => {
      const key = event.title.toLowerCase().trim();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, event);
      } else {
        // Score completeness: prefer events with recurrence_rule and start_time
        const scoreEvent = (e: SeriesEvent) =>
          (e.recurrence_rule ? 2 : 0) + (e.start_time ? 1 : 0);
        if (scoreEvent(event) > scoreEvent(existing)) {
          map.set(key, event);
        }
      }
      return map;
    }, new Map<string, SeriesEvent>()).values()
  );

  // Group events as series view with occurrence expansion
  const { series, unknownEvents } = groupEventsAsSeriesView(deduplicatedEvents, {
    startKey: today,
    endKey: windowEnd,
    overrideMap,
  });

  // Separate recurring series from one-time events
  const recurringSeries = series.filter((s) => !s.isOneTime);
  const oneTimeSeries = series.filter((s) => s.isOneTime);

  // Check if there are any happenings to show
  const hasHappenings = series.length > 0 || unknownEvents.length > 0;

  // Build full address
  const fullAddress = [
    venue.address,
    venue.city,
    venue.state,
    venue.zip,
  ].filter(Boolean).join(", ");

  const locationText = [venue.city, venue.state].filter(Boolean).join(", ") || "Denver, CO";
  const externalLink = chooseVenueLink(venue);

  // Build Google Maps directions URL
  // Phase 4.65: Always use directions URL format, never google_maps_url
  // google_maps_url is for "View on Maps" button (place page), not directions
  const getDirectionsUrl = getVenueDirectionsUrl(venue);

  return (
    <PageContainer>
      <div className="py-8 md:py-12">
        {/* Back link */}
        <Link
          href="/venues"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All venues
        </Link>

        {/* Hero Cover Image */}
        {venue.cover_image_url && (
          <div className="relative w-full aspect-[21/9] rounded-xl overflow-hidden mb-8">
            <Image
              src={venue.cover_image_url}
              alt={`${venue.name} cover image`}
              fill
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              priority
            />
          </div>
        )}

        {/* Venue Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-[var(--font-family-serif)] font-bold text-[var(--color-text-primary)] tracking-tight">
            {venue.name}
          </h1>

          {/* Location */}
          <p className="text-lg text-[var(--color-text-secondary)] mt-2">
            {locationText}
          </p>

          {/* Address block */}
          {fullAddress && (
            <p className="text-[var(--color-text-secondary)] mt-1">
              {fullAddress}
            </p>
          )}

          {/* Action buttons row */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {getDirectionsUrl && (
              <a
                href={getDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] text-[var(--color-text-primary)] font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Get Directions
              </a>
            )}

            {externalLink && (
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] text-[var(--color-text-primary)] font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {venue.google_maps_url ? "View on Maps" : "Website"}
              </a>
            )}

            {/* Separate Website button when venue has both google_maps_url AND website_url */}
            {venue.website_url && isValidUrl(venue.website_url) && !!venue.google_maps_url && (
              <a
                href={venue.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] text-[var(--color-text-primary)] font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.6 9h16.8" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.6 15h16.8" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c2.5 2.7 3.9 5.8 3.9 9s-1.4 6.3-3.9 9c-2.5-2.7-3.9-5.8-3.9-9S9.5 5.7 12 3z" />
                </svg>
                Website
              </a>
            )}

            {venue.phone && (
              <a
                href={`tel:${venue.phone}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] text-[var(--color-text-primary)] font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {venue.phone}
              </a>
            )}
          </div>

          {/* Venue info notes */}
          {(venue.accessibility_notes || venue.parking_notes) && (
            <div className="mt-6 space-y-3">
              {venue.accessibility_notes && (
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                  <p className="text-sm">
                    <span className="font-medium text-[var(--color-text-primary)]">Accessibility: </span>
                    <span className="text-[var(--color-text-secondary)]">{venue.accessibility_notes}</span>
                  </p>
                </div>
              )}
              {venue.parking_notes && (
                <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                  <p className="text-sm">
                    <span className="font-medium text-[var(--color-text-primary)]">Parking: </span>
                    <span className="text-[var(--color-text-secondary)]">{venue.parking_notes}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Photos Section */}
        {venueImages && venueImages.length > 0 && (
          <section className="mt-8 mb-12" data-testid="venue-photos-section">
            <h2 className="text-2xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-6">
              Photos
            </h2>
            <PhotoGallery images={venueImages as Array<{ id: string; image_url: string }>} />
          </section>
        )}

        {/* Happenings Section */}
        <section className="mt-8">
          <h2 className="text-2xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-6">
            Happenings at {venue.name}
          </h2>

          {!hasHappenings ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
              <p>No upcoming happenings at this venue.</p>
              <p className="text-sm mt-2">
                <Link href="/happenings" className="text-[var(--color-link)] hover:underline">
                  Browse all happenings
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Recurring Series */}
              {recurringSeries.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                    Recurring Series
                  </h3>
                  <div className="space-y-3">
                    {recurringSeries.map((entry) => (
                      <SeriesCard key={entry.event.id} series={entry} />
                    ))}
                  </div>
                </div>
              )}

              {/* One-Time Events */}
              {oneTimeSeries.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                    {recurringSeries.length > 0 ? "One-Time Events" : "Upcoming Events"}
                  </h3>
                  <div className="space-y-3">
                    {oneTimeSeries.map((entry) => (
                      <SeriesCard key={entry.event.id} series={entry} />
                    ))}
                  </div>
                </div>
              )}

              {/* Unknown Schedule */}
              {unknownEvents.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-tertiary)] mb-4">
                    Schedule Unknown
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    These events don&apos;t have a computable next occurrence.
                  </p>
                  <div className="space-y-3">
                    {unknownEvents.map((event) => (
                      <div
                        key={event.id}
                        className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
                      >
                        <Link
                          href={`/events/${event.slug || event.id}`}
                          className="text-[var(--color-text-primary)] hover:text-[var(--color-link)] font-medium"
                        >
                          {event.title}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
