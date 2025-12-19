import Link from "next/link";
import React from "react";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";

const CATEGORY_COLORS: Record<string, string> = {
  "comedy": "bg-pink-900/40 text-pink-300",
  "poetry": "bg-purple-900/40 text-purple-300",
  "all-acts": "bg-yellow-900/40 text-yellow-300",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-900/60", text: "text-emerald-300", label: "Active" },
  inactive: { bg: "bg-red-900/60", text: "text-red-300", label: "Inactive" },
  cancelled: { bg: "bg-red-900/60", text: "text-red-300", label: "Cancelled" },
  unverified: { bg: "bg-amber-900/60", text: "text-amber-300", label: "Schedule TBD" },
  needs_verification: { bg: "bg-amber-900/60", text: "text-amber-300", label: "Schedule TBD" },
  seasonal: { bg: "bg-sky-900/60", text: "text-sky-300", label: "Seasonal" },
};

function isValidMapUrl(url?: string | null): boolean {
  if (!url) return false;
  // goo.gl and maps.app.goo.gl shortened URLs are broken (Dynamic Link Not Found)
  if (url.includes("goo.gl")) return false;
  return true;
}

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
  status?: string | null;
  last_verified_at?: string | null;
};

// Format verification date for display
function formatVerifiedDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? "s" : ""} ago`;
    }
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

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
  status,
  last_verified_at,
}: Props) {
  const humanRecurrence = humanizeRecurrence(recurrence_rule ?? null, day_of_week ?? null);
  const start = formatTimeToAMPM(start_time ?? null);
  const end = formatTimeToAMPM(end_time ?? null);
  const signup = formatTimeToAMPM(signup_time ?? null);
  const signupDisplay = signup && signup !== "TBD" ? signup : "Contact venue";

  const addressParts = [venue_address, venue_city, venue_state].filter(Boolean).join(", ");
  const mapUrl = (() => {
    if (isValidMapUrl(map_url)) return map_url;
    // Construct from venue name + address
    const parts: string[] = [];
    if (venue_name) parts.push(venue_name);
    if (addressParts) parts.push(addressParts);
    if (parts.length > 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
    }
    return undefined;
  })();

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

  // Get status styling - show badge for non-active statuses
  const statusStyle = status ? STATUS_STYLES[status] : null;
  const showStatusBadge = status && status !== "active";

  // Verification display
  const verifiedText = formatVerifiedDate(last_verified_at);
  const showUnverified = status === "unverified" && !last_verified_at;

  return (
    <div className={`flex items-center justify-between gap-4 p-3 rounded-lg border ${showStatusBadge ? "border-amber-500/30 bg-amber-950/10" : "border-white/6 bg-white/2"}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{title}</h3>
          {showStatusBadge && statusStyle && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
          )}
        </div>

        {category && (
          <span className={`text-xs px-2 py-0.5 rounded inline-block mt-1 ${CATEGORY_COLORS[category] || ""}`}>
            {category}
          </span>
        )}

        <div className="mt-1">
          {/* Block 2: replace recurrence display with clean numeric/ordinal text */}
          <p className="text-sm text-[var(--color-text-tertiary)]">{humanRecurrence ?? "Schedule TBD"}</p>
          {/* City / State (clean, hide UNKNOWN) */}
          {displayLocation ? (
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              📍 {displayLocation}
            </div>
          ) : null}
          {/* Verification status */}
          {verifiedText && (
            <div className="text-xs text-emerald-400 mt-1" title={`Last verified: ${last_verified_at}`}>
              ✓ Verified {verifiedText}
            </div>
          )}
          {showUnverified && (
            <div className="text-xs text-amber-400 mt-1">
              Not yet verified
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm text-[var(--color-text-primary)] font-medium">{start}{end && end !== "TBD" ? ` — ${end}` : ""}</div>
          <div className="text-xs text-[var(--color-gold-400)]">Signup: {signupDisplay}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">{venue_name}</div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {mapUrl ? (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded bg-white/5 text-[var(--color-text-accent)] hover:bg-white/6"
            >
              Map
            </a>
          ) : null}
          <Link href={detailsHref} className="text-xs px-2 py-1 rounded bg-white/5 text-[var(--color-text-primary)] hover:bg-white/6">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
