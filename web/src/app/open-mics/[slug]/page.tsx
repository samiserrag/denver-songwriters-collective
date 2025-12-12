import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { EventWithVenue } from "@/types/db";
import Link from "next/link";
import { highlight, escapeHtml, linkifyUrls } from "@/lib/highlight";
import { humanizeRecurrence, formatTimeToAMPM } from "@/lib/recurrenceHumanizer";
import PlaceholderImage from "@/components/ui/PlaceholderImage";

const CATEGORY_COLORS: Record<string, string> = {
  "comedy": "bg-pink-900/40 text-pink-300",
  "poetry": "bg-purple-900/40 text-purple-300",
  "all-acts": "bg-yellow-900/40 text-yellow-300",
  "music": "bg-emerald-900/40 text-emerald-300",
  "mixed": "bg-sky-900/40 text-sky-300",
};

function isValidMapUrl(url?: string | null): boolean {
  if (!url) return false;
  // goo.gl and maps.app.goo.gl shortened URLs are broken (Dynamic Link Not Found)
  if (url.includes("goo.gl")) return false;
  return true;
}

function resolveMapUrl(googleMapsUrl?: string | null, mapLink?: string | null, venueName?: string | null, venueAddress?: string): string | undefined {
  // Prefer explicit google_maps_url if valid
  if (isValidMapUrl(googleMapsUrl)) return googleMapsUrl!;
  // Fall back to map_link if it's not a broken goo.gl URL
  if (isValidMapUrl(mapLink)) return mapLink!;
  // Otherwise construct from venue name + address
  const parts: string[] = [];
  if (venueName && venueName !== "TBA" && venueName !== "Venue") parts.push(venueName);
  if (venueAddress) parts.push(venueAddress);
  if (parts.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
  }
  return undefined;
}

export const dynamic = "force-dynamic";

interface EventPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ search?: string }>;
}

export default async function EventBySlugPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const searchParamsObj = searchParams ? await searchParams : undefined;
  const supabase = await createSupabaseServerClient();

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const { data, error } = isUUID
    ? await supabase.from("events").select("*, venue:venues(*)").eq("id", slug).single<EventWithVenue>()
    : await supabase.from("events").select("*, venue:venues(*)").eq("slug", slug).single<EventWithVenue>();

  if (error || !data) {
    notFound();
  }

  const event = data;
  if (!event) {
    notFound();
  }

  if (isUUID && event.slug) {
    // If the user accessed by UUID and the event has a canonical slug, redirect there.
    redirect(`/open-mics/${event.slug}`);
  }

  if (!isUUID && (!event.slug || event.slug !== slug)) {
    notFound();
  }

  const venue = event.venue;
  const venueAddress = [venue?.address, venue?.city, venue?.state].filter(Boolean).join(", ");
  const mapUrl = resolveMapUrl(
    venue?.google_maps_url,
    venue?.map_link,
    venue?.name,
    venueAddress || undefined
  );

  const recurrenceText = humanizeRecurrence(event.recurrence_rule ?? null, event.day_of_week ?? null);
  const startFormatted = formatTimeToAMPM(event.start_time ?? null);
  const endFormatted = formatTimeToAMPM((event as any).end_time ?? null);
  const signupFormatted = formatTimeToAMPM((event as any).signup_time ?? null);

  const searchQuery = (searchParamsObj?.search ?? "").trim();
  // Prepare highlighted HTML (safe — highlight/escapeHtml escape input)
  const titleHtml = searchQuery ? highlight(event.title ?? "", searchQuery) : escapeHtml(event.title ?? "");
  const descriptionHtml = event.description ? linkifyUrls(searchQuery ? highlight(event.description, searchQuery) : escapeHtml(event.description)) : "";
  const venueNameHtml = venue?.name ? (searchQuery ? highlight(venue.name, searchQuery) : escapeHtml(venue.name)) : "";
  const venueAddressHtml = venue?.address ? (searchQuery ? highlight(venue.address, searchQuery) : escapeHtml(venue.address)) : "";
  const notesHtml = event.notes ? linkifyUrls(searchQuery ? highlight(event.notes, searchQuery) : escapeHtml(event.notes)) : "";

  // Combine description and notes for unified "About" section
  const hasDescription = Boolean(event.description?.trim());
  const hasNotes = Boolean(event.notes?.trim());

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/open-mics" className="inline-flex items-center gap-2 text-[var(--color-gold)] hover:text-[var(--color-gold-400)] transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Directory
      </Link>

      {/* Hero section with placeholder image */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-[var(--color-indigo-950)]/50">
        <div className="h-48 md:h-64 relative">
          <PlaceholderImage type="open-mic" className="w-full h-full" alt={event.title ?? "Open Mic"} />
          {/* Day badge */}
          {event.day_of_week && (
            <div className="absolute top-4 left-4 px-4 py-2 bg-black/70 backdrop-blur rounded-lg">
              <span className="text-[var(--color-gold)] font-semibold">{event.day_of_week}s</span>
            </div>
          )}
          {/* Category badge */}
          {event.category && (
            <div className="absolute top-4 right-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[(event.category as string)] || "bg-slate-900/60 text-slate-300"}`}>
                {event.category}
              </span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8">
          <h1
            className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-warm-white)] mb-4"
            dangerouslySetInnerHTML={{ __html: titleHtml }}
          />

          {/* Quick info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Time Card */}
            <div className="p-4 rounded-xl bg-[var(--color-background)]/50 border border-white/5">
              <div className="flex items-center gap-2 text-[var(--color-warm-gray)] text-sm mb-1">
                <span>🕐</span> Time
              </div>
              <p className="text-[var(--color-warm-white)] font-medium">
                {startFormatted}{endFormatted && endFormatted !== "TBD" ? ` — ${endFormatted}` : ""}
              </p>
              {signupFormatted && signupFormatted !== "TBD" && (
                <p className="text-teal-400 text-sm mt-1">Signup: {signupFormatted}</p>
              )}
            </div>

            {/* Venue Card */}
            {venue && (
              <div className="p-4 rounded-xl bg-[var(--color-background)]/50 border border-white/5">
                <div className="flex items-center gap-2 text-[var(--color-warm-gray)] text-sm mb-1">
                  <span>📍</span> Venue
                </div>
                <p className="text-[var(--color-warm-white)] font-medium" dangerouslySetInnerHTML={{ __html: venueNameHtml }} />
                <p className="text-[var(--color-warm-gray-light)] text-sm mt-1">
                  {venue.city}{venue.state ? `, ${venue.state}` : ""}
                </p>
              </div>
            )}

            {/* Schedule Card */}
            <div className="p-4 rounded-xl bg-[var(--color-background)]/50 border border-white/5">
              <div className="flex items-center gap-2 text-[var(--color-warm-gray)] text-sm mb-1">
                <span>📅</span> Schedule
              </div>
              <p className="text-[var(--color-warm-white)] font-medium">
                {recurrenceText || "Weekly"}
              </p>
              {event.status && (
                <p className={`text-sm mt-1 ${event.status === "active" ? "text-green-400" : "text-[var(--color-warm-gray)]"}`}>
                  {event.status === "active" ? "✓ Active" : event.status}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-8">
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Get Directions
              </a>
            )}
            {venue?.website_url && (
              <a
                href={venue.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border-2 border-white/20 hover:border-white/40 text-[var(--color-warm-white)] font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Venue Website
              </a>
            )}
          </div>

          {/* About This Open Mic - merged description and notes */}
          {(hasDescription || hasNotes) && (
            <div className="mb-8">
              <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-warm-white)] mb-3">About This Open Mic</h2>
              <div className="space-y-4">
                {descriptionHtml && (
                  <div
                    className="text-[var(--color-warm-gray-light)] whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                )}
                {notesHtml && (
                  <div
                    className="text-[var(--color-warm-gray-light)] whitespace-pre-wrap leading-relaxed text-sm"
                    dangerouslySetInnerHTML={{ __html: notesHtml }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Address */}
          {venueAddressHtml && (
            <div className="mb-8">
              <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-warm-white)] mb-3">Location</h2>
              <p className="text-[var(--color-warm-gray-light)]" dangerouslySetInnerHTML={{ __html: venueAddressHtml }} />
              {venue && (
                <p className="text-[var(--color-warm-gray-light)]">
                  {venue.city}{venue.state ? `, ${venue.state}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Community Comments */}
      <OpenMicComments eventId={event.id} />

      {/* Suggestion form */}
      <div className="mt-8">
        <EventSuggestionForm
          event={{
            id: event.id,
            title: event.title ?? "",
            venue_name: venue?.name ?? (event as any).venue_name ?? null,
            day_of_week: event.day_of_week ?? null,
            start_time: event.start_time ?? null,
            end_time: (event as any).end_time ?? null,
            signup_time: (event as any).signup_time ?? null,
            recurrence_rule: event.recurrence_rule ?? null,
            category: event.category ?? null,
            description: event.description ?? null,
            slug: event.slug ?? null,
          }}
        />
      </div>
    </div>
  );
}

import EventSuggestionForm from "@/components/events/EventSuggestionForm";
import { OpenMicComments } from "@/components/events";
