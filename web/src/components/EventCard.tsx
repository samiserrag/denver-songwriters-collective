"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event as EventType } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { highlight } from "@/lib/highlight";

export default function EventCard({ event, searchQuery }: { event: EventType; searchQuery?: string | null }) {
  const mapQuery = encodeURIComponent([typeof event.venue === "string" ? event.venue : (event.venue as any)?.name, event.location].filter(Boolean).join(", "));
  const mapsUrl = `https://maps.google.com?q=${mapQuery}`;
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
  const venueText: string | undefined =
    typeof event.venue === "object" && event.venue?.name
      ? event.venue.name ?? undefined
      : (typeof event.venue === "string" ? event.venue : undefined);

  return (
    <article
      className="rounded-2xl bg-white/5 p-4 shadow-xl border border-white/10 hover:border-[#00FFCC]/40 hover:shadow-[0_8px_30px_rgba(0,255,204,0.08)] transition-all duration-200 flex flex-col justify-between space-y-3 break-words"
      role="article"
    >
      <div className="flex flex-col space-y-2 break-words">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight leading-tight break-words"
            dangerouslySetInnerHTML={{ __html: highlight(event.title, searchQuery ?? "") }}
          />

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

        <div className="text-sm text-[#80D9FF] break-words">
          {event.date ? <span className="block">{event.date}</span> : null}
          <span className="block font-medium text-[#80D9FF]">{event.time ?? ""}</span>
        </div>

          <div className="text-sm">
            <div
              className="text-base font-medium text-white break-words"
              dangerouslySetInnerHTML={{ __html: highlight(venueText ?? "", searchQuery ?? "") }}
            />
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

        {((event as any)?.mapUrl) ? (
          <a
            href={(event as any).mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-[#00FFCC] border border-[#00FFCC]/20 hover:shadow-[0_0_12px_rgba(0,255,204,0.12)] transition text-center"
          >
            View Map
          </a>
        ) : (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center rounded-lg bg-transparent px-3 py-2 text-sm font-semibold text-[#00FFCC] border border-[#00FFCC]/10 hover:shadow-[0_0_12px_rgba(0,255,204,0.08)] transition text-center"
          >
            Map
          </a>
        )}
      </div>
    </article>
  );
}
