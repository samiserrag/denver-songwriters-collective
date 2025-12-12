import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { RSVPButton, EventComments } from "@/components/events";
import { EVENT_TYPE_CONFIG } from "@/types/events";

interface EventHost {
  id: string;
  user_id: string;
  role: string;
  invitation_status: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("title, description, venue_name, day_of_week, start_time, event_type")
    .eq("id", id)
    .single();

  if (!event) {
    return {
      title: "Event Not Found | Denver Songwriters Collective",
      description: "This event could not be found.",
    };
  }

  const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
    || EVENT_TYPE_CONFIG.other;

  const title = `${event.title} | ${config.label} in Denver`;
  const description = event.description
    ? event.description.slice(0, 155) + (event.description.length > 155 ? "..." : "")
    : `Join ${event.title} at ${event.venue_name || "Denver"}${event.day_of_week ? ` on ${event.day_of_week}s` : ""}${event.start_time ? ` at ${event.start_time}` : ""}. Find events with the Denver Songwriters Collective.`;

  const canonicalUrl = `https://denver-songwriters-collective.vercel.app/events/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Denver Songwriters Collective",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function EventPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch event with hosts
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(
        id, user_id, role, invitation_status,
        user:profiles(id, full_name, avatar_url)
      )
    `)
    .eq("id", eventId)
    .single();

  if (error || !event) notFound();

  // Get RSVP count for DSC events
  let confirmedCount = 0;
  if (event.is_dsc_event) {
    const { count } = await supabase
      .from("event_rsvps")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "confirmed");
    confirmedCount = count || 0;
  }

  const config = EVENT_TYPE_CONFIG[event.event_type as keyof typeof EVENT_TYPE_CONFIG]
    || EVENT_TYPE_CONFIG.other;

  const acceptedHosts = ((event.event_hosts as EventHost[]) || []).filter(
    (h) => h.invitation_status === "accepted"
  );

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">{config.icon}</span>
            <span className="px-2 py-1 bg-[var(--color-indigo-950)]/50 text-[var(--color-warm-gray-light)] text-xs rounded">
              {config.label}
            </span>
            {event.is_dsc_event && (
              <span className="px-2 py-1 bg-[var(--color-gold)]/20 text-[var(--color-gold)] text-xs rounded">
                DSC Event
              </span>
            )}
          </div>
          <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-warm-white)]">{event.title}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {event.description && (
              <section>
                <h2 className="text-lg font-semibold text-[var(--color-warm-white)] mb-2">About</h2>
                <p className="text-[var(--color-warm-gray-light)] whitespace-pre-wrap">{event.description}</p>
              </section>
            )}

            {/* Hosts */}
            {acceptedHosts.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-[var(--color-warm-white)] mb-3">Hosted by</h2>
                <div className="flex flex-wrap gap-3">
                  {acceptedHosts.map((host) => (
                    <div key={host.id} className="flex items-center gap-2 p-2 bg-[var(--color-indigo-950)]/50 rounded-lg">
                      <div className="w-8 h-8 bg-[var(--color-indigo-950)] rounded-full flex items-center justify-center text-sm text-[var(--color-warm-white)]">
                        {host.user?.avatar_url ? (
                          <img src={host.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          host.user?.full_name?.[0]?.toUpperCase() || "?"
                        )}
                      </div>
                      <span className="text-[var(--color-warm-white)] text-sm">{host.user?.full_name || "Unknown"}</span>
                      {host.role === "cohost" && (
                        <span className="text-xs text-[var(--color-warm-gray)]">(co-host)</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Comments (DSC events only) */}
            {event.is_dsc_event && (
              <EventComments eventId={eventId} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Details Card */}
            <div className="p-6 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg">
              <h2 className="text-lg font-semibold text-[var(--color-warm-white)] mb-4">Details</h2>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[var(--color-warm-gray)]">Venue</dt>
                  <dd className="text-[var(--color-warm-white)]">{event.venue_name}</dd>
                </div>
                {event.address && (
                  <div>
                    <dt className="text-[var(--color-warm-gray)]">Address</dt>
                    <dd className="text-[var(--color-warm-white)]">{event.address}</dd>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-gold)] hover:text-[var(--color-gold-400)] text-xs"
                    >
                      View on map →
                    </a>
                  </div>
                )}
                <div>
                  <dt className="text-[var(--color-warm-gray)]">When</dt>
                  <dd className="text-[var(--color-warm-white)]">
                    {event.day_of_week && `${event.day_of_week}s`}
                    {event.start_time && ` at ${event.start_time}`}
                    {event.end_time && ` - ${event.end_time}`}
                  </dd>
                </div>
                {event.frequency && event.frequency !== "one_time" && (
                  <div>
                    <dt className="text-[var(--color-warm-gray)]">Frequency</dt>
                    <dd className="text-[var(--color-warm-white)] capitalize">{event.frequency}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* RSVP (DSC events only) */}
            {event.is_dsc_event && (
              <div className="p-6 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg">
                <h2 className="text-lg font-semibold text-[var(--color-warm-white)] mb-4">RSVP</h2>
                <RSVPButton
                  eventId={eventId}
                  capacity={event.capacity}
                  initialConfirmedCount={confirmedCount}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
