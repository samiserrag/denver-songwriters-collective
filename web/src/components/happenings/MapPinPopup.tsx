/**
 * Phase 1.2b: Map Pin Popup Component
 *
 * Pure presentational component for map pin popup content.
 * Extracted from MapView.tsx for testability without Leaflet DOM.
 *
 * Contract:
 * - Venue name links to /venues/{slug} when venueSlug exists
 * - Venue name renders as plain text when venueSlug is null
 * - Each event links to its href (includes ?date= param)
 * - Shows max 5 events, then "+X more happening(s)" overflow
 * - Events container has scroll styling for overflow
 */

import Link from "next/link";
import type { MapPinData } from "@/lib/map";

interface MapPinPopupProps {
  pin: MapPinData;
}

/**
 * MapPinPopup - Popup content for a map pin
 *
 * Shows venue name and list of events at that venue.
 */
export function MapPinPopup({ pin }: MapPinPopupProps) {
  return (
    <div className="min-w-[200px] max-w-[280px]">
      {/* Venue header */}
      <div className="mb-2 pb-2 border-b border-gray-200">
        {pin.venueSlug ? (
          <Link
            href={`/venues/${pin.venueSlug}`}
            className="font-semibold text-blue-600 hover:underline"
          >
            {pin.venueName}
          </Link>
        ) : (
          <span className="font-semibold text-gray-900">{pin.venueName}</span>
        )}
        <div className="text-xs text-gray-500">
          {pin.events.length} happening{pin.events.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Events list */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {pin.events.slice(0, 5).map((event) => (
          <div key={`${event.eventId}-${event.dateKey}`} className="text-sm">
            <Link
              href={event.href}
              className="text-blue-600 hover:underline font-medium block"
            >
              {event.title}
            </Link>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <span>{event.displayDate}</span>
              {event.startTime && (
                <>
                  <span>·</span>
                  <span>{event.startTime}</span>
                </>
              )}
              {event.isCancelled && (
                <span className="text-red-600 font-medium ml-1">CANCELLED</span>
              )}
              {event.isRescheduled && !event.isCancelled && (
                <span className="text-amber-600 font-medium ml-1">RESCHEDULED</span>
              )}
            </div>
          </div>
        ))}
        {pin.events.length > 5 && (
          <div className="text-xs text-gray-500 pt-1">
            +{pin.events.length - 5} more happening{pin.events.length - 5 !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

export default MapPinPopup;
