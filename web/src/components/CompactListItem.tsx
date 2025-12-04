import Link from "next/link";
import React from "react";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";

type Props = {
  id: string;
  title: string;
  slug?: string | null;
  day_of_week?: string | null;
  recurrence_rule?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_city?: string | null;
  venue_state?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  map_url?: string | null;
  // optional searchQuery for future highlighting (not required)
  searchQuery?: string | null;
};

export default function CompactListItem({
  id,
  title,
  slug,
  day_of_week,
  recurrence_rule,
  venue_name,
  venue_address,
  venue_city,
  venue_state,
  start_time,
  end_time,
  map_url,
}: Props) {
  const humanRecurrence = humanizeRecurrence(recurrence_rule ?? null, day_of_week ?? null);
  const start = formatTimeToAMPM(start_time ?? null);
  const end = formatTimeToAMPM(end_time ?? null);

  const addressParts = [venue_address, venue_city, venue_state].filter(Boolean).join(", ");
  const mapUrl =
    map_url ??
    (addressParts ? `https://maps.google.com/?q=${encodeURIComponent(addressParts)}` : undefined);

  const detailsHref = slug ? `/open-mics/${slug}` : `/open-mics/${id}`;

  // friendly location for display (omit UNKNOWN)
  const _city = venue_city?.trim() ?? null;
  const _state = venue_state?.trim() ?? null;
  const displayLocation =
    _city && String(_city).toUpperCase() !== "UNKNOWN" ? (_state ? `${_city}, ${_state}` : _city) : null;

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-white/6 bg-white/2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
        <div className="mt-1">
          {/* Block 2: replace recurrence display with clean numeric/ordinal text */}
          <p className="text-sm text-gray-400">{humanRecurrence ?? "Schedule TBD"}</p>
          {/* City / State (clean, hide UNKNOWN) */}
          {displayLocation ? (
            <div className="text-xs text-[var(--color-warm-gray-light)] mt-1">
              📍 {displayLocation}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm text-white font-medium">{start}{end && end !== "TBD" ? ` — ${end}` : ""}</div>
          <div className="text-xs text-[var(--color-warm-gray-light)]">{addressParts}</div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {mapUrl ? (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded bg-white/5 text-[#00FFCC] hover:bg-white/6"
            >
              Map
            </a>
          ) : null}
          <Link href={detailsHref} className="text-xs px-2 py-1 rounded bg-white/5 text-white hover:bg-white/6">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
