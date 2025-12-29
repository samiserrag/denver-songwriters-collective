import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkHostStatus } from "@/lib/auth/adminAuth";

// GET - Get events where user is host/cohost
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get events where user is a host
  const { data: hostEntries, error: hostError } = await supabase
    .from("event_hosts")
    .select("event_id, role, invitation_status")
    .eq("user_id", session.user.id)
    .eq("invitation_status", "accepted");

  if (hostError) {
    return NextResponse.json({ error: hostError.message }, { status: 500 });
  }

  if (!hostEntries || hostEntries.length === 0) {
    return NextResponse.json([]);
  }

  const eventIds = hostEntries.map(h => h.event_id);

  // Get full event data
  // Note: event_hosts.user_id references auth.users, not profiles
  // So we fetch hosts without profile join, then fetch profiles separately
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(id, user_id, role, invitation_status)
    `)
    .in("id", eventIds)
    .eq("is_dsc_event", true)
    .order("created_at", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  // Collect all host user_ids across all events and fetch profiles
  const allHostUserIds = (events || []).flatMap(e =>
    (e.event_hosts as { user_id: string }[])?.map(h => h.user_id) || []
  );
  const uniqueHostUserIds = [...new Set(allHostUserIds)];

  let profileMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();
  if (uniqueHostUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", uniqueHostUserIds);

    profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
  }

  // Enrich events with host profiles
  const enrichedEvents = (events || []).map(event => ({
    ...event,
    event_hosts: (event.event_hosts as { id: string; user_id: string; role: string; invitation_status: string }[])?.map(h => ({
      ...h,
      user: profileMap.get(h.user_id) || undefined
    })) || []
  }));

  // Add RSVP counts to enriched events
  const eventsWithCounts = await Promise.all(
    enrichedEvents.map(async (event) => {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      const hostEntry = hostEntries.find(h => h.event_id === event.id);

      return {
        ...event,
        rsvp_count: count || 0,
        user_role: hostEntry?.role || "host"
      };
    })
  );

  return NextResponse.json(eventsWithCounts);
}

// Generate dates for a recurring series (weekly)
function generateSeriesDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");

  for (let i = 0; i < count; i++) {
    const eventDate = new Date(start);
    eventDate.setDate(start.getDate() + (i * 7)); // Weekly
    dates.push(eventDate.toISOString().split("T")[0]);
  }

  return dates;
}

// POST - Create new DSC event (or series of events)
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check host/admin status for DSC branding permission (not creation blocking)
  const isApprovedHost = await checkHostStatus(supabase, session.user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const canCreateDSC = isApprovedHost || isAdmin;

  const body = await request.json();

  // Validate required fields
  const required = ["title", "event_type", "start_time"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  // Validate online_url required for online/hybrid events
  if ((body.location_mode === "online" || body.location_mode === "hybrid") && !body.online_url) {
    return NextResponse.json(
      { error: "Online URL is required for online or hybrid events" },
      { status: 400 }
    );
  }

  // Phase 4.0: Determine location selection mode
  // User can either select a venue OR provide a custom location (mutually exclusive)
  const hasVenue = !!body.venue_id;
  const hasCustomLocation = !!body.custom_location_name;

  // Validate: exactly one of venue_id or custom_location_name must be set for in-person/hybrid events
  if (body.location_mode === "venue" || body.location_mode === "hybrid" || !body.location_mode) {
    if (!hasVenue && !hasCustomLocation) {
      return NextResponse.json({ error: "Either venue_id or custom_location_name is required for in-person events" }, { status: 400 });
    }
    if (hasVenue && hasCustomLocation) {
      return NextResponse.json({ error: "Cannot have both venue_id and custom_location_name" }, { status: 400 });
    }
  }

  // Lookup venue name and address from venues table (only if venue selected)
  let venueName: string | null = null;
  let venueAddress: string | null = null;
  let finalVenueId: string | null = null;
  let customLocationFields = {
    custom_location_name: null as string | null,
    custom_address: null as string | null,
    custom_city: null as string | null,
    custom_state: null as string | null,
    custom_latitude: null as number | null,
    custom_longitude: null as number | null,
    location_notes: null as string | null,
  };

  if (hasVenue) {
    // Venue selection path: clear all custom location fields
    finalVenueId = body.venue_id;
    const { data: venue } = await supabase
      .from("venues")
      .select("name, address, city, state")
      .eq("id", body.venue_id)
      .single();

    if (venue) {
      venueName = venue.name;
      // Combine address with city/state for full address
      const addressParts = [venue.address, venue.city, venue.state].filter(Boolean);
      venueAddress = addressParts.length > 0 ? addressParts.join(", ") : null;
    }
    // customLocationFields stays all null (cleared)
  } else if (hasCustomLocation) {
    // Custom location path: clear venue fields
    finalVenueId = null;
    venueName = null;
    venueAddress = null;
    customLocationFields = {
      custom_location_name: body.custom_location_name,
      custom_address: body.custom_address || null,
      custom_city: body.custom_city || null,
      custom_state: body.custom_state || null,
      custom_latitude: body.custom_latitude || null,
      custom_longitude: body.custom_longitude || null,
      location_notes: body.location_notes || null,
    };
  }

  // Determine series configuration
  const occurrenceCount = Math.min(Math.max(body.occurrence_count || 1, 1), 12); // Clamp between 1-12
  const startDate = body.start_date;

  if (!startDate) {
    return NextResponse.json({ error: "start_date is required" }, { status: 400 });
  }

  // Generate series_id if creating multiple events
  const seriesId = occurrenceCount > 1 ? crypto.randomUUID() : null;
  const eventDates = generateSeriesDates(startDate, occurrenceCount);

  console.log("[POST /api/my-events] Creating", occurrenceCount, "event(s), series_id:", seriesId);

  // Create all events in the series
  const createdEvents: { id: string; event_date: string | null }[] = [];

  for (let i = 0; i < eventDates.length; i++) {
    const eventDate = eventDates[i];

    // Determine if this should be a DSC event
    const isDSCEvent = canCreateDSC && body.is_dsc_event === true;

    // Determine status: draft by default, active if explicitly publishing
    const eventStatus = body.is_published === true ? "active" : "draft";
    const publishedAt = body.is_published === true ? new Date().toISOString() : null;

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        title: body.title,
        description: body.description || null,
        event_type: body.event_type,
        // Only approved hosts/admins can create DSC events
        is_dsc_event: isDSCEvent,
        capacity: body.has_timeslots ? body.total_slots : (body.capacity || null),
        host_notes: body.host_notes || null,
        // Phase 4.0: Venue fields (mutually exclusive with custom location)
        venue_id: finalVenueId,
        venue_name: venueName,
        venue_address: venueAddress,
        // Phase 4.0: Custom location fields (mutually exclusive with venue)
        custom_location_name: customLocationFields.custom_location_name,
        custom_address: customLocationFields.custom_address,
        custom_city: customLocationFields.custom_city,
        custom_state: customLocationFields.custom_state,
        custom_latitude: customLocationFields.custom_latitude,
        custom_longitude: customLocationFields.custom_longitude,
        location_notes: customLocationFields.location_notes,
        day_of_week: body.day_of_week || null,
        start_time: body.start_time,
        end_time: body.end_time || null,
        recurrence_rule: body.recurrence_rule || null,
        cover_image_url: body.cover_image_url || null,
        // Status defaults to draft; publish is explicit action
        status: eventStatus,
        is_published: body.is_published ?? false,
        published_at: publishedAt,
        has_timeslots: body.has_timeslots ?? false,
        total_slots: body.has_timeslots ? body.total_slots : null,
        slot_duration_minutes: body.has_timeslots ? body.slot_duration_minutes : null,
        allow_guest_slots: body.has_timeslots ? (body.allow_guests ?? false) : false,
        // Series fields
        event_date: eventDate,
        series_id: seriesId,
        series_index: seriesId ? i : null,
        // Phase 3 scan-first fields
        timezone: body.timezone || "America/Denver",
        location_mode: body.location_mode || "venue",
        online_url: body.online_url || null,
        is_free: body.is_free ?? null,
        cost_label: body.cost_label || null,
        signup_mode: body.signup_mode || null,
        signup_url: body.signup_url || null,
        signup_deadline: body.signup_deadline || null,
        age_policy: body.age_policy || (isDSCEvent ? "18+ only" : null),
        source: "community",
      })
      .select()
      .single();

    if (eventError) {
      console.error("[POST /api/my-events] Event creation error:", eventError.message, "| Code:", eventError.code);
      // If this is not the first event, we've already created some - return partial success
      if (createdEvents.length > 0) {
        return NextResponse.json({
          ...createdEvents[0],
          series_count: createdEvents.length,
          error: `Created ${createdEvents.length} of ${occurrenceCount} events. Error: ${eventError.message}`
        });
      }
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    console.log("[POST /api/my-events] Event created:", event.id, "| date:", eventDate, "| series_index:", i);
    createdEvents.push({ id: event.id, event_date: event.event_date });

    // Add creator as host
    const { error: hostError } = await supabase
      .from("event_hosts")
      .insert({
        event_id: event.id,
        user_id: session.user.id,
        role: "host",
        invitation_status: "accepted",
        invited_by: session.user.id,
        responded_at: new Date().toISOString()
      });

    if (hostError) {
      console.error("[POST /api/my-events] Host assignment error:", hostError.message, "| Code:", hostError.code);
    }

    // Generate timeslots using the database function if has_timeslots is enabled
    if (body.has_timeslots && body.total_slots) {
      const { error: timeslotsError } = await supabase
        .rpc("generate_event_timeslots", { p_event_id: event.id });

      if (timeslotsError) {
        console.error("[POST /api/my-events] Timeslot generation error:", timeslotsError.message);
      } else {
        console.log("[POST /api/my-events] Timeslots generated for event:", event.id);
      }
    }
  }

  // Return the first event with series info
  const firstEvent = createdEvents[0];
  return NextResponse.json({
    id: firstEvent.id,
    event_date: firstEvent.event_date,
    series_id: seriesId,
    series_count: createdEvents.length,
  });
}
