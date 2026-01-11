import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HappeningCard, type HappeningEvent } from "@/components/happenings";
import { PageContainer } from "@/components/layout";
import { chooseVenueLink } from "@/lib/venue/chooseVenueLink";
import { getTodayDenver } from "@/lib/events/nextOccurrence";

interface VenueDetailParams {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: VenueDetailParams): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("name, city, state")
    .eq("id", id)
    .single();

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

  // Query venue details (excluding admin-only 'notes' field)
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select(`
      id,
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
      parking_notes
    `)
    .eq("id", id)
    .single();

  if (venueError || !venue) {
    notFound();
  }

  // Query upcoming events at this venue
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
      status,
      cover_image_url,
      cover_image_card_url,
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
    .eq("venue_id", id)
    .eq("is_published", true)
    .in("status", ["active", "needs_verification"])
    .or(`event_date.gte.${today},event_date.is.null`)
    .order("event_date", { ascending: true, nullsFirst: false });

  if (eventsError) {
    console.error("Error fetching events:", eventsError);
  }

  // Map events to HappeningEvent format
  const happenings: HappeningEvent[] = (events ?? []).map((event) => ({
    ...event,
    venue_name: event.venue_name || venue.name,
    venue_address: event.venue_address || venue.address,
    venue: {
      id: venue.id,
      name: venue.name,
      address: venue.address,
      city: venue.city,
      state: venue.state,
      google_maps_url: venue.google_maps_url,
      website_url: venue.website_url,
    },
  }));

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
  const getDirectionsUrl = venue.google_maps_url || (
    fullAddress ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}` : null
  );

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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-medium transition-colors"
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

        {/* Happenings Section */}
        <section className="mt-8">
          <h2 className="text-2xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-6">
            Happenings at {venue.name}
          </h2>

          {happenings.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
              <p>No upcoming happenings at this venue.</p>
              <p className="text-sm mt-2">
                <Link href="/happenings" className="text-[var(--color-link)] hover:underline">
                  Browse all happenings
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {happenings.map((event) => (
                <HappeningCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
