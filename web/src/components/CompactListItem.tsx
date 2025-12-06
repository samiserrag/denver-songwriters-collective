import Link from "next/link";
import React from "react";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";

const CATEGORY_COLORS: Record<string, string> = {
  "comedy": "bg-pink-900/40 text-pink-300",
  "poetry": "bg-purple-900/40 text-purple-300",
  "all-acts": "bg-yellow-900/40 text-yellow-300",
};

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
  signup_time?: string | null;
  category?: string | null;
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
  signup_time,
  category,
}: Props) {
  const humanRecurrence = humanizeRecurrence(recurrence_rule ?? null, day_of_week ?? null);
  const start = formatTimeToAMPM(start_time ?? null);
  const end = formatTimeToAMPM(end_time ?? null);
  const signup = formatTimeToAMPM(signup_time ?? null);
  const signupDisplay = signup && signup !== "TBD" ? signup : "Contact venue";

  const addressParts = [venue_address, venue_city, venue_state].filter(Boolean).join(", ");
  const mapUrl =
    map_url ??
    (venue_name
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParts ? `${venue_name}, ${addressParts}` : venue_name)}`
      : undefined);

  const detailsHref = slug ? `/open-mics/${slug}` : `/open-mics/${id}`;

  // friendly location for display (require both city and state and omit UNKNOWN)
  const _city = venue_city?.trim() ?? null;
  const _state = venue_state?.trim() ?? null;
  const displayLocation =
    _city &&
    _state &&
    String(_city).toUpperCase() !== "UNKNOWN" &&
    String(_state).toUpperCase() !== "UNKNOWN"
      ? `${_city}, ${_state}`
      : null;

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-white/6 bg-white/2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-white truncate">{title}</h3>

        {category && (
          <span className={`text-xs px-2 py-0.5 rounded inline-block mt-1 ${CATEGORY_COLORS[category] || ""}`}>
            {category}
          </span>
        )}

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
          <div className="text-xs text-teal-400">Signup: {signupDisplay}</div>
          <div className="text-xs text-[var(--color-warm-gray-light)]">{venue_name}</div>
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
