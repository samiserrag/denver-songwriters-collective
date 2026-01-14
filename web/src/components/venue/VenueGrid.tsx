import * as React from "react";
import { VenueCard } from "./VenueCard";
import type { VenueEventCounts } from "@/lib/venue/computeVenueCounts";

interface VenueWithCounts {
  id: string;
  slug?: string | null;
  name: string;
  city?: string | null;
  state?: string | null;
  google_maps_url?: string | null;
  website_url?: string | null;
  cover_image_url?: string | null;
  counts: VenueEventCounts;
}

interface VenueGridProps {
  venues: VenueWithCounts[];
  className?: string;
}

export function VenueGrid({ venues, className }: VenueGridProps) {
  return (
    <div
      className={className}
      role="list"
      aria-label="Venue list"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {venues.map((venue) => (
          <div key={venue.id} role="listitem">
            <VenueCard
              venue={venue}
              counts={venue.counts}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
