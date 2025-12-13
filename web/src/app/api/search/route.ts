import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SearchResult {
  type: "event" | "open_mic" | "member" | "blog";
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
  const [openMicsRes, eventsRes, membersRes, blogsRes] = await Promise.all([
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

    // Events - search title, description
    supabase
      .from("events")
      .select(`
        id,
        title,
        event_date,
        venue_name
      `)
      .neq("event_type", "open_mic")
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(5),

    // Members - search name, bio
    supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        role,
        avatar_url,
        location
      `)
      .in("role", ["performer", "host", "studio"])
      .or(`full_name.ilike.${like},bio.ilike.${like}`)
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
  ]);

  // Also search venues and include open mics at those venues
  const { data: venueMatches } = await supabase
    .from("venues")
    .select("id, name, city")
    .or(`name.ilike.${like},city.ilike.${like}`)
    .limit(5);

  let venueOpenMics: any[] = [];
  if (venueMatches && venueMatches.length > 0) {
    const venueIds = venueMatches.map((v) => v.id);
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
      subtitle: venue ? `${venue.name}${venue.city ? `, ${venue.city}` : ""} • ${om.day_of_week || "Weekly"}` : om.day_of_week || "Weekly",
      url: `/open-mics/${om.slug || om.id}`,
    });
  }

  // Format events
  for (const event of eventsRes.data ?? []) {
    results.push({
      type: "event",
      id: event.id,
      title: event.title,
      subtitle: event.venue_name || (event.event_date ? new Date(event.event_date).toLocaleDateString() : undefined),
      url: `/events/${event.id}`,
    });
  }

  // Format members
  for (const member of membersRes.data ?? []) {
    results.push({
      type: "member",
      id: member.id,
      title: member.full_name || "Unknown",
      subtitle: `${member.role}${member.location ? ` • ${member.location}` : ""}`,
      url: `/members?id=${member.id}`,
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
