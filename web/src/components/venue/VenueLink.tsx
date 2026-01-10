import { chooseVenueLink } from "@/lib/venue/chooseVenueLink";
import { cn } from "@/lib/utils";

interface VenueLinkProps {
  /** Display name for the venue */
  name: string;
  /** Venue data with optional URLs */
  venue?: {
    google_maps_url?: string | null;
    website_url?: string | null;
  } | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * VenueLink - Renders venue name as a link (to maps/website) or plain text
 *
 * Uses chooseVenueLink() to determine the best URL:
 * 1. google_maps_url (preferred)
 * 2. website_url (fallback)
 * 3. Plain text (no link available)
 *
 * Opens in new tab with security attributes (noopener noreferrer).
 *
 * NOTE: This is for venue NAME links only.
 * "Get Directions" buttons use separate getGoogleMapsUrl() logic.
 */
export function VenueLink({ name, venue, className }: VenueLinkProps) {
  const href = chooseVenueLink(venue);

  if (!href) {
    return <span className={className}>{name}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "hover:underline text-[var(--color-link)]",
        className
      )}
    >
      {name}
    </a>
  );
}
