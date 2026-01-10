"use client";

/**
 * @deprecated This component is deprecated. Use HappeningCard from @/components/happenings/HappeningCard instead.
 * Kept for backward compatibility during migration. Will be removed in a future version.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event as EventType, Venue } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { highlight } from "@/lib/highlight";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import { VenueLink } from "@/components/venue/VenueLink";

const CATEGORY_COLORS: Record<string, string> = {
  music: "bg-emerald-900/60 text-emerald-200 border-emerald-500/40",
  comedy: "bg-yellow-900/60 text-yellow-200 border-yellow-500/40",
  poetry: "bg-purple-900/60 text-purple-200 border-purple-500/40",
  mixed: "bg-sky-900/60 text-sky-200 border-sky-500/40",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active: { bg: "bg-emerald-900/60", text: "text-emerald-300", border: "border-emerald-500/40", label: "Active" },
  inactive: { bg: "bg-red-900/60", text: "text-red-300", border: "border-red-500/40", label: "Inactive" },
  cancelled: { bg: "bg-red-900/60", text: "text-red-300", border: "border-red-500/40", label: "Cancelled" },
  unverified: { bg: "bg-amber-900/60", text: "text-amber-300", border: "border-amber-500/40", label: "Schedule TBD" },
  needs_verification: { bg: "bg-amber-900/60", text: "text-amber-300", border: "border-amber-500/40", label: "Schedule TBD" },
  seasonal: { bg: "bg-sky-900/60", text: "text-sky-300", border: "border-sky-500/40", label: "Seasonal" },
};

type MaybeVenue = Venue | string | undefined | null;

function getVenueName(v: MaybeVenue) {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  return v.name ?? undefined;
}

function isValidMapUrl(url?: string | null): boolean {
  if (!url) return false;
  // goo.gl and maps.app.goo.gl shortened URLs are broken (Dynamic Link Not Found)
  if (url.includes("goo.gl")) return false;
  return true;
}

function getVenueMapsUrl(v: MaybeVenue) {
  if (!v) return undefined;
  if (typeof v === "string") return undefined;
  // Prefer google_maps_url, then map_link, but only if they're valid (not goo.gl)
  if (isValidMapUrl(v.google_maps_url)) return v.google_maps_url;
  if (isValidMapUrl(v.map_link)) return v.map_link;
  if (isValidMapUrl(v.website)) return v.website;
  return undefined;
}

// Phase 4.52: Extract venue URLs for VenueLink component
function getVenueForLink(v: MaybeVenue): { google_maps_url?: string | null; website_url?: string | null } | null {
  if (!v) return null;
  if (typeof v === "string") return null;
  return {
    google_maps_url: v.google_maps_url,
    website_url: v.website_url ?? v.website,
  };
}

function getMapUrl(venueName: string, address?: string) {
  const query = address
    ? `${venueName}, ${address}`
    : venueName;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

interface EventCardProps {
  event: EventType;
  searchQuery?: string | null;
  /** Display variant: "grid" for card layout, "list" for compact row layout */
  variant?: "grid" | "list";
}

export default function EventCard({ event, searchQuery, variant = "grid" }: EventCardProps) {
  const venueObj: MaybeVenue = event.venue ?? undefined;
  const venueName = getVenueName(venueObj) ?? "";
  const venueForLink = getVenueForLink(venueObj);

  const eventMapUrl = ((): string | undefined => {
    // prefer explicit mapUrl field if present on event (but only if valid)
    const maybeMapUrl = (event as unknown as { mapUrl?: string | undefined }).mapUrl;
    if (isValidMapUrl(maybeMapUrl)) return maybeMapUrl;
    const fromVenue = getVenueMapsUrl(venueObj);
    if (fromVenue) return fromVenue;
    // fallback to generated map URL
    if (venueName) {
      return getMapUrl(venueName, event.location);
    }
    return undefined;
  })();

  const dayOfWeek = ((): string | null => {
    const d = (event as unknown as { day_of_week?: string | null }).day_of_week ?? (event as unknown as { dayOfWeek?: string | null }).dayOfWeek ?? null;
    return d ?? null;
  })();

  const recurrenceText = humanizeRecurrence((event as unknown as { recurrence_rule?: string | null }).recurrence_rule ?? (event as unknown as { recurrenceRule?: string | null }).recurrenceRule ?? null, dayOfWeek ?? null);
  const startTime = formatTimeToAMPM((event as unknown as { start_time?: string | null }).start_time ?? (event.time ?? null));
  const endTime = formatTimeToAMPM((event as unknown as { end_time?: string | null }).end_time ?? null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [favorited, setFavorited] = useState<boolean>(false);
  const [loadingFav, setLoadingFav] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkFavorite() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setFavorited(false);
          return;
        }
        const { data, error } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", user.id)
          .eq("event_id", event.id)
          .single();
        if (!error && mounted) {
          setFavorited(!!data);
        }
      } catch {
        /* ignore */
      }
    }
    checkFavorite();
    return () => {
      mounted = false;
    };
  }, [event.id, supabase]);

  async function toggleFavorite() {
    setLoadingFav(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      if (!favorited) {
        // optimistic
        setFavorited(true);
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id,
          event_id: event.id,
        });
        if (error) {
          // rollback
          setFavorited(false);
        }
      } else {
        // optimistic
        setFavorited(false);
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("event_id", event.id);
        if (error) {
          setFavorited(true);
        }
      }
    } catch {
      // on unexpected error, redirect to login as fallback
      router.push("/login");
    } finally {
      setLoadingFav(false);
    }
  }

  // Normalize venue text for highlighting and map queries
  const venueText: string | undefined = getVenueName(venueObj);

  // friendly city/state display (prefer joined venue relation when available)
  const _city = ((): string | null => {
    const v = venueObj;
    if (typeof v === "object" && v && "city" in v) return (v.city ?? null) as string | null;
    return (event as unknown as { venue_city?: string | null }).venue_city?.trim() ?? null;
  })();
  const _state = ((): string | null => {
    const v = venueObj;
    if (typeof v === "object" && v && "state" in v) return (v.state ?? null) as string | null;
    return (event as unknown as { venue_state?: string | null }).venue_state?.trim() ?? null;
  })();

  const displayLocation =
    _city && String(_city).toUpperCase() !== "UNKNOWN" ? (_state ? `${_city}, ${_state}` : _city) : null;

  // Get status for visual treatment
  const eventStatus = (event as unknown as { status?: string | null }).status ?? null;
  const statusStyle = eventStatus ? STATUS_STYLES[eventStatus] : null;
  const showStatusBadge = eventStatus && eventStatus !== "active";

  return (
    <article
      className={`group rounded-xl bg-[var(--color-bg-secondary)] border overflow-hidden transition-all duration-200 card-hover ${
        showStatusBadge
          ? "border-amber-500/30 hover:border-amber-500/50"
          : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
      }`}
      role="article"
      data-testid="event-card"
    >
      {/* Image/Placeholder - hidden in list variant for compact display */}
      {variant === "grid" && (
        <div className="h-32 relative">
          <PlaceholderImage type="open-mic" className="w-full h-full" alt={event.title} />
          {/* Day badge */}
          {dayOfWeek && (
            <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 backdrop-blur rounded-full">
              <span className="text-[var(--color-text-accent)] text-sm font-medium">{dayOfWeek}</span>
            </div>
          )}
          {/* Status badge - show prominently for non-active */}
          {showStatusBadge && statusStyle && (
            <div className={`absolute bottom-3 left-3 px-3 py-1 backdrop-blur rounded-full ${statusStyle.bg} border ${statusStyle.border}`}>
              <span className={`text-sm font-semibold uppercase tracking-wide ${statusStyle.text}`}>{statusStyle.label}</span>
            </div>
          )}
          {/* Favorite button */}
          <button
            onClick={toggleFavorite}
            aria-label={favorited ? "Remove favorite" : "Add favorite"}
            className="absolute top-3 right-3 text-xl leading-none px-2 py-1 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 transition text-[var(--color-text-accent)]"
            disabled={loadingFav}
          >
            {favorited ? "★" : "☆"}
          </button>
        </div>
      )}

      {/* Content */}
      <div data-testid="event-card-content" className={variant === "list" ? "p-3 space-y-1" : "p-5 space-y-3"}>
        {/* List variant: inline status badge + favorite button */}
        {variant === "list" && (showStatusBadge || true) && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {showStatusBadge && statusStyle && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                  {statusStyle.label}
                </span>
              )}
            </div>
            <button
              onClick={toggleFavorite}
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
              className="text-lg leading-none px-1.5 py-0.5 rounded-full hover:bg-black/10 transition text-[var(--color-text-accent)]"
              disabled={loadingFav}
            >
              {favorited ? "★" : "☆"}
            </button>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <h3 className={`font-[var(--font-family-serif)] text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors leading-tight break-words ${variant === "list" ? "text-base" : "text-lg"}`}
            dangerouslySetInnerHTML={{ __html: highlight(event.title, searchQuery ?? "") }}
          />
          {event.category && (
            <span
              className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-sm font-semibold uppercase tracking-wide ${CATEGORY_COLORS[(event.category as string)] ?? "bg-slate-900/60 text-slate-200 border-slate-500/40"}`}
            >
              {event.category}
            </span>
          )}
        </div>

        <div className="text-base text-[var(--color-text-secondary)] flex items-center gap-2">
          <span>📍</span>
          {searchQuery ? (
            <span
              className="break-words"
              dangerouslySetInnerHTML={{ __html: highlight(venueText ?? "TBA", searchQuery ?? "") }}
            />
          ) : (
            <VenueLink
              name={venueText ?? "TBA"}
              venue={venueForLink}
              className="break-words"
            />
          )}
        </div>

        {displayLocation && (
          <div className="text-base text-[var(--color-text-secondary)]">
            {displayLocation}
          </div>
        )}

        <div className="text-base text-[var(--color-text-accent)]">
          {startTime}{endTime && endTime !== "TBD" ? ` — ${endTime}` : ""}
          {/* Hide recurrence text in list variant - group headers already show the day */}
          {variant === "grid" && recurrenceText && recurrenceText !== "Every week" && (
            <span className="text-[var(--color-text-secondary)] ml-2">• {recurrenceText}</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
          <Link
            href={event.slug ? `/open-mics/${event.slug}` : `/open-mics/${event.id}`}
            className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-base font-medium transition-colors"
          >
            View Details →
          </Link>
          {eventMapUrl && (
            <a
              href={eventMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-base font-medium transition-colors"
            >
              Map
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
