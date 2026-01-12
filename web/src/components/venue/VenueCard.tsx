"use client";

/**
 * VenueCard - Venue Directory MVP
 *
 * Card component for displaying venue in grid layout.
 * Shows venue name, location, event count, and link icons.
 *
 * Uses card-spotlight surface pattern (same as SongwriterCard, StudioCard).
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { chooseVenueLink } from "@/lib/venue/chooseVenueLink";
import { ImagePlaceholder } from "@/components/ui";

interface VenueCardProps {
  venue: {
    id: string;
    slug?: string | null;  // Phase ABC4: Add slug for friendly URLs
    name: string;
    city?: string | null;
    state?: string | null;
    google_maps_url?: string | null;
    website_url?: string | null;
  };
  /** Number of events at this venue */
  eventCount: number;
  className?: string;
}

function getInitials(name: string): string {
  if (!name) return "VEN";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function VenueCard({ venue, eventCount, className }: VenueCardProps) {
  // Phase ABC4: Use slug if available, fall back to id for backward compatibility
  const venuePath = `/venues/${venue.slug || venue.id}`;
  const externalLink = chooseVenueLink(venue);
  const locationText = [venue.city, venue.state].filter(Boolean).join(", ") || "Denver, CO";

  return (
    <Link href={venuePath} className="block h-full group focus-visible:outline-none">
      <article
        className={cn(
          "h-full overflow-hidden card-spotlight",
          "transition-shadow transition-colors duration-200 ease-out",
          "hover:shadow-md hover:border-[var(--color-accent-primary)]/30",
          "hover:-translate-y-1",
          "group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)]",
          className
        )}
      >
        {/* Placeholder Section - No venue images in schema */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <ImagePlaceholder
            initials={getInitials(venue.name)}
            className="w-full h-full"
          />

          {/* Event count badge */}
          <div className="absolute bottom-3 right-3">
            <span className="px-2 py-1 text-sm font-medium rounded-full bg-[var(--color-bg-primary)]/90 text-[var(--color-text-primary)] border border-[var(--color-border-default)]">
              {eventCount === 0
                ? "0 upcoming"
                : eventCount === 1
                ? "1 happening"
                : `${eventCount} happenings`}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 space-y-2">
          <h3 className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight line-clamp-2">
            {venue.name}
          </h3>

          <p className="text-sm text-[var(--color-text-secondary)]">
            {locationText}
          </p>

          {/* Link icons row */}
          {externalLink && (
            <div className="flex items-center gap-3 pt-1">
              {venue.google_maps_url && (
                <span
                  className="text-[var(--color-text-tertiary)]"
                  title="Has Google Maps link"
                  aria-label="Has Google Maps link"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
              )}
              {venue.website_url && (
                <span
                  className="text-[var(--color-text-tertiary)]"
                  title="Has website"
                  aria-label="Has website"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </span>
              )}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
