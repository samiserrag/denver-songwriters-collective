import * as React from "react";
import { VenueCard } from "./VenueCard";

interface VenueWithCount {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  google_maps_url?: string | null;
  website_url?: string | null;
  eventCount: number;
}

interface VenueGridProps {
  venues: VenueWithCount[];
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
              eventCount={venue.eventCount}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
