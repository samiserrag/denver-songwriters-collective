import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { EventWithVenue } from "@/types/db";
import Link from "next/link";
import { highlight, escapeHtml } from "@/lib/highlight";
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

  const searchQuery = (searchParamsObj?.search ?? "").trim();
  // Prepare highlighted HTML (safe — highlight/escapeHtml escape input)
  const titleHtml = searchQuery ? highlight(event.title ?? "", searchQuery) : escapeHtml(event.title ?? "");
  const descriptionHtml = event.description ? (searchQuery ? highlight(event.description, searchQuery) : escapeHtml(event.description)) : "";
  const venueNameHtml = venue?.name ? (searchQuery ? highlight(venue.name, searchQuery) : escapeHtml(venue.name)) : "";
  const venueAddressHtml = venue?.address ? (searchQuery ? highlight(venue.address, searchQuery) : escapeHtml(venue.address)) : "";
  const notesHtml = event.notes ? (searchQuery ? highlight(event.notes, searchQuery) : escapeHtml(event.notes)) : "";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/open-mics" className="text-[#00FFCC] hover:underline">
        ← Back to Directory
      </Link>

      <div className="mt-6 rounded-2xl bg-white/5 p-6 shadow-xl border border-white/10">
        <h1
          className="text-3xl font-semibold text-white tracking-wide"
          dangerouslySetInnerHTML={{ __html: titleHtml }}
        />

        {venue && (
          <div className="mt-4 space-y-2">
            <h2 className="text-lg font-medium text-[#00FFCC]">Venue</h2>
            <p className="text-white font-semibold" dangerouslySetInnerHTML={{ __html: venueNameHtml }} />
            {venueAddressHtml ? (
              <p className="text-[var(--color-warm-gray-light)]" dangerouslySetInnerHTML={{ __html: venueAddressHtml }} />
            ) : null}
            <p className="text-[var(--color-warm-gray-light)]">
              {venue.city}, {venue.state}
            </p>
            {venue.map_link ? (
              <a
                href={venue.map_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 px-3 py-1 rounded-full bg-white/5 text-[#00FFCC] hover:bg-[#00FFCC]/10 transition"
              >
                View Map
              </a>
            ) : null}
          </div>
        )}

        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-medium text-white">Details</h2>
          <div className="text-[var(--color-warm-gray-light)] space-y-1">
            {event.day_of_week && <p><strong className="text-white">Day:</strong> {event.day_of_week}</p>}
            {event.start_time && <p><strong className="text-white">Starts:</strong> {event.start_time}</p>}
            {event.end_time && <p><strong className="text-white">Ends:</strong> {event.end_time}</p>}
            {event.recurrence_rule && (
              <p><strong className="text-white">Recurrence:</strong> {event.recurrence_rule}</p>
            )}
            {event.status && <p><strong className="text-white">Status:</strong> {event.status}</p>}
          </div>
        </div>

        {notesHtml ? (
          <div className="mt-6">
            <h2 className="text-lg font-medium text-white">Notes</h2>
            <div className="text-[var(--color-warm-gray-light)]" dangerouslySetInnerHTML={{ __html: notesHtml }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
