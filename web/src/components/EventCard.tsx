"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event as EventType, Venue } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { highlight } from "@/lib/highlight";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";

const CATEGORY_COLORS: Record<string, string> = {
  music: "bg-emerald-900/60 text-emerald-200 border-emerald-500/40",
  comedy: "bg-yellow-900/60 text-yellow-200 border-yellow-500/40",
  poetry: "bg-purple-900/60 text-purple-200 border-purple-500/40",
  mixed: "bg-sky-900/60 text-sky-200 border-sky-500/40",
};

type MaybeVenue = Venue | string | undefined | null;

function getVenueName(v: MaybeVenue) {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  return v.name ?? undefined;
}

function getVenueMapsUrl(v: MaybeVenue) {
  if (!v) return undefined;
  if (typeof v === "string") return undefined;
  return (v.google_maps_url ?? v.map_link ?? v.website) ?? undefined;
}

export default function EventCard({ event, searchQuery }: { event: EventType; searchQuery?: string | null }) {
  const venueObj: MaybeVenue = event.venue ?? undefined;
  const venueName = getVenueName(venueObj) ?? "";
  const mapQuery = encodeURIComponent([venueName, event.location].filter(Boolean).join(", "));
  const mapsUrl = `https://maps.google.com/?q=${mapQuery}`;

  const eventMapUrl = ((): string | undefined => {
    // prefer explicit mapUrl field if present on event
    const maybeMapUrl = (event as unknown as { mapUrl?: string | undefined }).mapUrl;
    if (maybeMapUrl) return maybeMapUrl;
    const fromVenue = getVenueMapsUrl(venueObj);
    return fromVenue ?? mapsUrl;
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

  return (
    <article
      className="rounded-2xl bg-white/5 p-4 shadow-xl border border-white/10 hover:border-[#00FFCC]/40 hover:shadow-[0_8px_30px_rgba(0,255,204,0.08)] transition-all duration-200 flex flex-col justify-between space-y-3 break-words"
      role="article"
    >
      <div className="flex flex-col space-y-2 break-words">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight leading-tight break-words"
              dangerouslySetInnerHTML={{ __html: highlight(event.title, searchQuery ?? "") }}
            />

            {event.category && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mt-1 ${CATEGORY_COLORS[(event.category as string)] ?? "bg-slate-900/60 text-slate-200 border-slate-500/40"}`}
              >
                {event.category}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(event.eventType ?? event.event_type) && (
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-[#00FFCC] whitespace-nowrap">
                {event.eventType ?? event.event_type}
              </span>
            )}

            <button
              onClick={toggleFavorite}
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
              className="text-xl leading-none px-2 py-1 rounded hover:bg-white/5 transition"
              disabled={loadingFav}
            >
              {favorited ? "★" : "☆"}
            </button>
          </div>
        </div>

        <div className="mt-1">
          <p className="text-sm text-gray-400">{recurrenceText}</p>
        </div>

        <div className="text-sm text-[#80D9FF] break-words">
          {event.date ? <span className="block">{event.date}</span> : null}
          <span className="block font-medium text-[#80D9FF]">
            {dayOfWeek ? `${dayOfWeek} • ${startTime}${endTime && endTime !== "TBD" ? ` — ${endTime}` : ""}` : `${startTime}${endTime && endTime !== "TBD" ? ` — ${endTime}` : ""}`}
          </span>
        </div>

          <div className="text-sm">
            <div
              className="text-base font-medium text-white break-words"
              dangerouslySetInnerHTML={{ __html: highlight(venueText ?? "", searchQuery ?? "") }}
            />
            {/* City / State display */}
            <div className="text-sm text-[var(--color-warm-gray-light)]">
              {displayLocation ? <span>{displayLocation}</span> : null}
            </div>
            {event.location && (
              <div className="text-[var(--color-warm-gray-light)] break-words">{event.location}</div>
            )}
          </div>
      </div>

      <div className="mt-2 flex gap-3">
        <Link
          href={event.slug ? `/open-mics/${event.slug}` : `/open-mics/${event.id}`}
          className="w-full inline-flex items-center justify-center rounded-lg bg-[#001e20] px-3 py-2 text-sm font-semibold text-[#00FFCC] hover:brightness-105 transition ring-1 ring-[#00FFCC]/20 text-center"
        >
          View Details
        </Link>

        {eventMapUrl ? (
          <a
            href={eventMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-[#00FFCC] border border-[#00FFCC]/20 hover:shadow-[0_0_12px_rgba(0,255,204,0.12)] transition text-center"
          >
            View Map
          </a>
        ) : null}
      </div>
    </article>
  );
}
