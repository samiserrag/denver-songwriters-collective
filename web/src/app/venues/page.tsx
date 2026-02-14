import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VenueGrid } from "@/components/venue/VenueGrid";
import { PageContainer, HeroSection } from "@/components/layout";
import {
  computeVenueCountsFromEvents,
  type EventForCounts,
} from "@/lib/venue/computeVenueCounts";

export const metadata: Metadata = {
  title: "Venues | The Colorado Songwriters Collective",
  description: "Discover venues hosting open mics, showcases, and music events across the Denver area.",
};

export const dynamic = "force-dynamic";

interface VenueRow {
  id: string;
  slug: string | null;  // Phase ABC4: Add slug for friendly URLs
  name: string;
  city: string;
  state: string;
  google_maps_url: string | null;
  website_url: string | null;
  cover_image_url: string | null;  // Cover image for thumbnail display
}

export default async function VenuesPage() {
  const supabase = await createSupabaseServerClient();

  // Query all venues sorted alphabetically
  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("id, slug, name, city, state, google_maps_url, website_url, cover_image_url")
    .order("name", { ascending: true });

  if (venuesError) {
    console.error("Error fetching venues:", venuesError);
  }

  // Query ALL events with venue_id for series/oneoff count computation
  // Must match venue detail page filters: is_published=true + status in (active, needs_verification, unverified)
  // Performance note: Single query, then client-side grouping per venue.
  // The 90-day window is applied during occurrence expansion, not here.
  const { data: allEvents, error: eventsError } = await supabase
    .from("events")
    .select(`
      id,
      venue_id,
      title,
      event_type,
      event_date,
      day_of_week,
      start_time,
      end_time,
      recurrence_rule,
      is_recurring,
      status
    `)
    .not("venue_id", "is", null)
    .eq("is_published", true)
    .in("status", ["active", "needs_verification", "unverified"]);

  if (eventsError) {
    console.error("Error fetching events:", eventsError);
  }

  // Compute series/oneoff counts per venue using same logic as venue detail page
  const venueCountsMap = computeVenueCountsFromEvents(
    (allEvents ?? []) as EventForCounts[]
  );

  // Map venues with structured counts
  const venuesWithCounts = (venues ?? []).map((venue: VenueRow) => {
    const counts = venueCountsMap.get(venue.id) || {
      seriesCount: 0,
      seriesUpcomingTotal: 0,
      oneoffCount: 0,
    };
    return {
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      city: venue.city,
      state: venue.state,
      google_maps_url: venue.google_maps_url,
      website_url: venue.website_url,
      cover_image_url: venue.cover_image_url,
      counts,
    };
  });

  return (
    <>
      {/* Hero Header */}
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-4 py-6">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] font-bold text-white tracking-tight drop-shadow-lg">
            Venues
          </h1>
          <p className="text-lg text-white/90 mt-2 drop-shadow">
            Discover places hosting happenings across the Denver area
          </p>
        </div>
      </HeroSection>

      <PageContainer>
        <div className="py-12">
          {venuesWithCounts.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <p>No venues found.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
                {venuesWithCounts.length} venues
              </p>
              <VenueGrid venues={venuesWithCounts} />
            </>
          )}

          <div className="mt-8 pt-6 border-t border-[var(--color-border-subtle)] text-center">
            <p className="text-[var(--color-text-secondary)]">
              Are you a venue or open mic host?{" "}
              <Link href="/host" className="text-[var(--color-text-accent)] hover:underline font-medium">
                Learn how to manage your listing on CSC →
              </Link>
            </p>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
