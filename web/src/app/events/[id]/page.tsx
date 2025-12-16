import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { EVENT_TYPE_CONFIG } from "@/types/events";
import type { EventType } from "@/types/events";

export const dynamic = "force-dynamic";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("title, description, event_type, venue_name")
    .eq("id", id)
    .single();

  if (!event) {
    return {
      title: "Event Not Found | Denver Songwriters Collective",
      description: "This event could not be found.",
    };
  }

  const config = EVENT_TYPE_CONFIG[event.event_type as EventType] || EVENT_TYPE_CONFIG.other;
  const title = `${event.title} | ${config.label} | Denver Songwriters Collective`;
  const description = event.description
    ? event.description.slice(0, 155) + (event.description.length > 155 ? "..." : "")
    : `Join us for ${event.title}${event.venue_name ? ` at ${event.venue_name}` : ""}. A ${config.label.toLowerCase()} hosted by the Denver Songwriters Collective.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Denver Songwriters Collective",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function getGoogleMapsUrl(address: string | null): string | null {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default async function EventDetailPage({ params }: EventPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event, error } = await supabase
    .from("events")
    .select(`
      id, title, description, event_type, venue_name, venue_address,
      day_of_week, start_time, end_time, capacity, cover_image_url,
      is_dsc_event, status, created_at,
      event_hosts(user:profiles(id, full_name, avatar_url))
    `)
    .eq("id", id)
    .single();

  if (error || !event) {
    notFound();
  }

  const { count: rsvpCount } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id)
    .eq("status", "confirmed");

  const config = EVENT_TYPE_CONFIG[event.event_type as EventType] || EVENT_TYPE_CONFIG.other;
  const mapsUrl = getGoogleMapsUrl(event.venue_address);
  const remaining = event.capacity ? Math.max(0, event.capacity - (rsvpCount || 0)) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventHosts = event.event_hosts as any[] | null;
  const hosts: Array<{ id: string; full_name: string | null; avatar_url: string | null }> =
    eventHosts?.map((h) => h.user).filter(Boolean) || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-[var(--color-text-accent)] hover:text-[var(--color-gold-400)] transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Happenings
      </Link>

      <div className="rounded-2xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
        {event.cover_image_url && (
          <div className="h-48 md:h-64 relative">
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-3 py-1 bg-black/70 backdrop-blur rounded-lg text-white font-medium text-sm">
                {config.icon} {config.label}
              </span>
              {event.is_dsc_event && (
                <span className="px-3 py-1 bg-[var(--color-accent-primary)]/90 backdrop-blur rounded-lg text-[var(--color-background)] font-medium text-sm">
                  DSC Event
                </span>
              )}
            </div>
          </div>
        )}

        <div className="p-6 md:p-8">
          {!event.cover_image_url && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl">{config.icon}</span>
              <span className="px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] text-sm rounded">
                {config.label}
              </span>
              {event.is_dsc_event && (
                <span className="px-2 py-1 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm rounded">
                  DSC Event
                </span>
              )}
            </div>
          )}

          <h1 className="font-[var(--font-family-serif)] text-3xl md:text-4xl text-[var(--color-text-primary)] mb-4">
            {event.title}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-default)]">
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-sm mb-1">
                <span>When</span>
              </div>
              <p className="text-[var(--color-text-primary)] font-medium">
                {event.day_of_week ? `${event.day_of_week}s` : "Schedule TBA"}
              </p>
              {event.start_time && (
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                  {event.start_time}{event.end_time ? ` - ${event.end_time}` : ""}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-default)]">
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-sm mb-1">
                <span>Where</span>
              </div>
              <p className="text-[var(--color-text-primary)] font-medium">
                {event.venue_name || "Venue TBA"}
              </p>
              {event.venue_address && (
                <p className="text-[var(--color-text-secondary)] text-sm mt-1 line-clamp-2">
                  {event.venue_address}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-default)]">
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-sm mb-1">
                <span>Attendance</span>
              </div>
              <p className="text-[var(--color-text-primary)] font-medium">
                {rsvpCount || 0} going
              </p>
              {remaining !== null && (
                <p className={`text-sm mt-1 ${remaining === 0 ? "text-amber-400" : "text-[var(--color-text-secondary)]"}`}>
                  {remaining === 0 ? "Event is full" : `${remaining} spots left`}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-8">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Get Directions
              </a>
            )}
          </div>

          {event.description && (
            <div className="mb-8">
              <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">About This Event</h2>
              <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {hosts.length > 0 && (
            <div className="mb-8">
              <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">
                {hosts.length === 1 ? "Host" : "Hosts"}
              </h2>
              <div className="flex flex-wrap gap-4">
                {hosts.map((host) => host && (
                  <Link
                    key={host.id}
                    href={`/songwriters/${host.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] transition-colors"
                  >
                    {host.avatar_url ? (
                      <img
                        src={host.avatar_url}
                        alt={host.full_name || "Host"}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                        <span className="text-[var(--color-text-accent)]">
                          {host.full_name?.[0] || "?"}
                        </span>
                      </div>
                    )}
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {host.full_name || "Anonymous Host"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[var(--color-bg-tertiary)]/30 border border-[var(--color-border-default)]">
            <p className="text-[var(--color-text-secondary)] text-sm">
              <span className="font-medium text-[var(--color-text-primary)]">{config.label}:</span> {config.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
