import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VenueGrid } from "@/components/venue/VenueGrid";
import { PageContainer, HeroSection } from "@/components/layout";

export const metadata: Metadata = {
  title: "Venues | Denver Songwriters Collective",
  description: "Discover venues hosting open mics, showcases, and music events across the Denver area.",
};

export const dynamic = "force-dynamic";

interface VenueRow {
  id: string;
  name: string;
  city: string;
  state: string;
  google_maps_url: string | null;
  website_url: string | null;
}

export default async function VenuesPage() {
  const supabase = await createSupabaseServerClient();

  // Query all venues sorted alphabetically
  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("id, name, city, state, google_maps_url, website_url")
    .order("name", { ascending: true });

  if (venuesError) {
    console.error("Error fetching venues:", venuesError);
  }

  // Query event counts per venue (upcoming events only)
  // Count events where event_date >= today OR event_date is null (recurring without fixed date)
  const today = new Date().toISOString().split("T")[0];
  const { data: eventCounts, error: countsError } = await supabase
    .from("events")
    .select("venue_id")
    .not("venue_id", "is", null)
    .eq("status", "active")
    .or(`event_date.gte.${today},event_date.is.null`);

  if (countsError) {
    console.error("Error fetching event counts:", countsError);
  }

  // Build count map
  const countMap = new Map<string, number>();
  if (eventCounts) {
    for (const event of eventCounts) {
      if (event.venue_id) {
        countMap.set(event.venue_id, (countMap.get(event.venue_id) || 0) + 1);
      }
    }
  }

  // Map venues with event counts
  const venuesWithCounts = (venues ?? []).map((venue: VenueRow) => ({
    id: venue.id,
    name: venue.name,
    city: venue.city,
    state: venue.state,
    google_maps_url: venue.google_maps_url,
    website_url: venue.website_url,
    eventCount: countMap.get(venue.id) || 0,
  }));

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
        </div>
      </PageContainer>
    </>
  );
}
