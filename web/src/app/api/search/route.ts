import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SearchResult {
  type: "event" | "open_mic" | "member" | "blog" | "venue";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  image?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim().slice(0, 100);

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createSupabaseServerClient();
  const like = `%${query.replace(/[%_]/g, "")}%`;

  // Run all searches in parallel
  const [openMicsRes, eventsRes, membersRes, blogsRes, venuesRes] = await Promise.all([
    // Open mics - search title, venue name, city
    supabase
      .from("events")
      .select(`
        id,
        slug,
        title,
        day_of_week,
        venues(name, city)
      `)
      .eq("event_type", "open_mic")
      .eq("status", "active")
      .or(`title.ilike.${like}`)
      .limit(5),

    // Events (non-open-mic) - search title, description
    supabase
      .from("events")
      .select(`
        id,
        slug,
        title,
        event_date,
        venue_name
      `)
      .neq("event_type", "open_mic")
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(5),

    // Members - search name, bio (using identity flags with legacy role fallback)
    supabase
      .from("profiles")
      .select(`
        id,
        slug,
        full_name,
        role,
        is_songwriter,
        is_host,
        is_studio,
        avatar_url,
        location
      `)
      .eq("is_public", true)
      .ilike("full_name", like)
      .limit(5),

    // Blog posts - search title, excerpt
    supabase
      .from("blog_posts")
      .select(`
        id,
        slug,
        title,
        excerpt,
        cover_image_url
      `)
      .eq("is_published", true)
      .or(`title.ilike.${like},excerpt.ilike.${like}`)
      .limit(3),

    // Venues - search name, city
    supabase
      .from("venues")
      .select(`
        id,
        slug,
        name,
        city,
        state
      `)
      .or(`name.ilike.${like},city.ilike.${like}`)
      .limit(5),
  ]);

  // Also find open mics at matching venues (for venue name searches)
  let venueOpenMics: Array<{
    id: string;
    slug: string | null;
    title: string;
    day_of_week: string | null;
    venues: { name: string; city: string | null } | { name: string; city: string | null }[] | null;
  }> = [];
  if (venuesRes.data && venuesRes.data.length > 0) {
    const venueIds = venuesRes.data.map((v) => v.id);
    const { data: venueEvents } = await supabase
      .from("events")
      .select(`
        id,
        slug,
        title,
        day_of_week,
        venues(name, city)
      `)
      .eq("event_type", "open_mic")
      .eq("status", "active")
      .in("venue_id", venueIds)
      .limit(5);

    venueOpenMics = venueEvents ?? [];
  }

  const results: SearchResult[] = [];

  // Format open mics (combine direct matches + venue matches)
  // Use slug || id for correct detail page navigation
  const openMicIds = new Set<string>();
  const allOpenMics = [...(openMicsRes.data ?? []), ...venueOpenMics];
  for (const om of allOpenMics) {
    if (openMicIds.has(om.id)) continue;
    openMicIds.add(om.id);

    const venue = Array.isArray(om.venues) ? om.venues[0] : om.venues;
    results.push({
      type: "open_mic",
      id: om.id,
      title: om.title,
      subtitle: venue
        ? `${venue.name}${venue.city ? `, ${venue.city}` : ""} • ${om.day_of_week || "Weekly"}`
        : om.day_of_week || "Weekly",
      url: `/events/${om.slug || om.id}`,
    });
  }

  // Format events (non-open-mic)
  // Use slug || id for correct detail page navigation
  for (const event of eventsRes.data ?? []) {
    results.push({
      type: "event",
      id: event.id,
      title: event.title,
      subtitle:
        event.venue_name ||
        (event.event_date
          ? new Date(event.event_date + "T12:00:00Z").toLocaleDateString("en-US", {
              timeZone: "America/Denver",
            })
          : undefined),
      url: `/events/${event.slug || event.id}`,
    });
  }

  // Format venues
  // Use slug || id for correct detail page navigation
  for (const venue of venuesRes.data ?? []) {
    const location = [venue.city, venue.state].filter(Boolean).join(", ");
    results.push({
      type: "venue",
      id: venue.id,
      title: venue.name,
      subtitle: location || undefined,
      url: `/venues/${venue.slug || venue.id}`,
    });
  }

  // Format members
  // Use slug || id for correct detail page navigation to /songwriters/
  for (const member of membersRes.data ?? []) {
    // Build subtitle from identity flags, fallback to role
    let subtitle = "";
    if (member.is_songwriter || member.is_host || member.is_studio) {
      const flags: string[] = [];
      if (member.is_songwriter) flags.push("Songwriter");
      if (member.is_host) flags.push("Host");
      if (member.is_studio) flags.push("Studio");
      subtitle = flags.join(", ");
    } else if (member.role) {
      subtitle = member.role;
    }
    if (member.location) {
      subtitle = subtitle ? `${subtitle} • ${member.location}` : member.location;
    }

    results.push({
      type: "member",
      id: member.id,
      title: member.full_name || "Unknown",
      subtitle: subtitle || undefined,
      url: `/songwriters/${member.slug || member.id}`,
      image: member.avatar_url || undefined,
    });
  }

  // Format blog posts
  for (const post of blogsRes.data ?? []) {
    results.push({
      type: "blog",
      id: post.id,
      title: post.title,
      subtitle: post.excerpt?.slice(0, 60) || undefined,
      url: `/blog/${post.slug}`,
      image: post.cover_image_url || undefined,
    });
  }

  return NextResponse.json({
    results: results.slice(0, 15), // Limit total results
    query,
  });
}
