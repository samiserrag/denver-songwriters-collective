import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { formatTimeToAMPM } from "@/lib/recurrenceHumanizer";

/**
 * Phase 4.43d: Open Mics Slug Route
 *
 * This route serves as the slug entrypoint for legacy URLs and SEO crawlers.
 * All requests immediately redirect to /events/[id] which is the canonical
 * detail page with full functionality (RSVP, attendee list, timeslots, etc.)
 *
 * The metadata function still provides proper SEO for the redirect.
 */

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const { data: event } = isUUID
    ? await supabase.from("events").select("*, venue:venues(name, city)").eq("id", slug).single()
    : await supabase.from("events").select("*, venue:venues(name, city)").eq("slug", slug).single();

  if (!event) {
    return {
      title: "Open Mic Not Found | Denver Songwriters Collective",
      description: "This open mic could not be found.",
    };
  }

  const venueName = event.venue?.name ?? "Denver";
  const venueCity = event.venue?.city ?? "Denver";
  const dayText = event.day_of_week ? `${event.day_of_week}s` : "";
  const timeText = event.start_time ? formatTimeToAMPM(event.start_time) : "";

  const title = `${event.title} | Open Mic in ${venueCity}`;
  const description = event.description
    ? event.description.slice(0, 155) + (event.description.length > 155 ? "..." : "")
    : `Join ${event.title} at ${venueName}${dayText ? ` every ${dayText}` : ""}${timeText ? ` at ${timeText}` : ""}. Find open mics in Denver with the Denver Songwriters Collective.`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://denver-songwriters-collective.vercel.app";
  // Canonical URL points to /events/ since that's where users land
  const canonicalUrl = `${siteUrl}/events/${event.slug || event.id}`;

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

export const dynamic = "force-dynamic";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OpenMicSlugRedirect({ params }: EventPageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const { data: event, error } = isUUID
    ? await supabase.from("events").select("id, slug").eq("id", slug).single()
    : await supabase.from("events").select("id, slug").eq("slug", slug).single();

  if (error || !event) {
    notFound();
  }

  // Phase 4.43d: /open-mics/[slug] is the slug entrypoint for legacy URLs and SEO.
  // /events/[id] is the canonical detail page with RSVP, attendee list, timeslots, etc.
  // ALL events (DSC + community) redirect to the canonical page for full functionality.
  redirect(`/events/${event.slug || event.id}`);
}
