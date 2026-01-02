import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdminRole, checkHostStatus } from "@/lib/auth/adminAuth";

// Helper to check if user can manage event
async function canManageEvent(supabase: SupabaseClient, userId: string, eventId: string): Promise<boolean> {
  // Check admin (using profiles.role, not app_metadata)
  const isAdmin = await checkAdminRole(supabase, userId);
  if (isAdmin) return true;

  // Check host
  const { data: hostEntry } = await supabase
    .from("event_hosts")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("invitation_status", "accepted")
    .maybeSingle();

  return !!hostEntry;
}

// GET - Get single event with full details (for editing)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEvent(supabase, session.user.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Note: event_hosts.user_id references auth.users, not profiles
  // So we fetch hosts without profile join, then fetch profiles separately
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(id, user_id, role, invitation_status)
    `)
    .eq("id", eventId)
    .eq("is_dsc_event", true)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Fetch profiles for all host user_ids
  const hostUserIds = (event.event_hosts as { user_id: string }[])?.map(h => h.user_id) || [];
  let hostsWithProfiles = event.event_hosts;

  if (hostUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", hostUserIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    hostsWithProfiles = (event.event_hosts as { id: string; user_id: string; role: string; invitation_status: string }[])?.map(h => ({
      ...h,
      user: profileMap.get(h.user_id) || undefined
    })) || [];
  }

  // Replace event_hosts with enriched version
  const enrichedEvent = { ...event, event_hosts: hostsWithProfiles };

  // Get RSVPs
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select(`
      *,
      user:profiles(id, full_name, avatar_url)
    `)
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ...enrichedEvent,
    rsvps: rsvps || []
  });
}

// PATCH - Update event
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEvent(supabase, session.user.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check host/admin status for DSC branding permission
  const isApprovedHost = await checkHostStatus(supabase, session.user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const canCreateDSC = isApprovedHost || isAdmin;

  const body = await request.json();

  // Handle restore action for cancelled drafts
  if (body.action === "restore") {
    // Fetch current event to check eligibility
    const { data: currentEvent, error: fetchError } = await supabase
      .from("events")
      .select("status, published_at, is_published")
      .eq("id", eventId)
      .single();

    if (fetchError || !currentEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Only allow restoring cancelled events
    if (currentEvent.status !== "cancelled") {
      return NextResponse.json(
        { error: "Only cancelled events can be restored" },
        { status: 400 }
      );
    }

    // Only allow restoring events that were never published
    // published_at being set means it was published at some point
    if (currentEvent.published_at) {
      return NextResponse.json(
        { error: "Cannot restore events that were previously published. Only cancelled drafts can be restored." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Restore to draft status
    const { data: restoredEvent, error: restoreError } = await supabase
      .from("events")
      .update({
        status: "draft",
        cancelled_at: null,
        cancel_reason: null,
        is_published: false,
        updated_at: now,
      })
      .eq("id", eventId)
      .select()
      .single();

    if (restoreError) {
      return NextResponse.json({ error: restoreError.message }, { status: 500 });
    }

    return NextResponse.json(restoredEvent);
  }

  // Validate online_url required for online/hybrid events
  if ((body.location_mode === "online" || body.location_mode === "hybrid") && !body.online_url) {
    return NextResponse.json(
      { error: "Online URL is required for online or hybrid events" },
      { status: 400 }
    );
  }

  // Phase 4.0: Handle mutual exclusivity of venue_id and custom_location_name
  const hasVenue = !!body.venue_id;
  const hasCustomLocation = !!body.custom_location_name;

  // Validate mutual exclusivity
  if (hasVenue && hasCustomLocation) {
    return NextResponse.json({ error: "Cannot have both venue_id and custom_location_name" }, { status: 400 });
  }

  // Only allow updating specific fields
  const allowedFields = [
    "title", "description", "event_type", "capacity", "host_notes",
    "day_of_week", "start_time", "event_date",
    "end_time", "status", "recurrence_rule", "cover_image_url", "is_published",
    // Phase 3 fields
    "timezone", "location_mode", "online_url", "is_free", "cost_label",
    "signup_mode", "signup_url", "signup_deadline", "age_policy"
  ];

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Phase 4.0: Handle location selection changes with invariant enforcement
  if (hasVenue) {
    // Venue selection path: set venue, clear all custom location fields
    updates.venue_id = body.venue_id;
    updates.custom_location_name = null;
    updates.custom_address = null;
    updates.custom_city = null;
    updates.custom_state = null;
    updates.custom_latitude = null;
    updates.custom_longitude = null;
    updates.location_notes = null;

    // Lookup venue info
    const { data: venue } = await supabase
      .from("venues")
      .select("name, address, city, state")
      .eq("id", body.venue_id)
      .single();

    if (venue) {
      updates.venue_name = venue.name;
      const addressParts = [venue.address, venue.city, venue.state].filter(Boolean);
      updates.venue_address = addressParts.length > 0 ? addressParts.join(", ") : null;
    }
  } else if (hasCustomLocation) {
    // Custom location path: clear venue, set custom fields
    updates.venue_id = null;
    updates.venue_name = null;
    updates.venue_address = null;
    updates.custom_location_name = body.custom_location_name;
    updates.custom_address = body.custom_address || null;
    updates.custom_city = body.custom_city || null;
    updates.custom_state = body.custom_state || null;
    updates.custom_latitude = body.custom_latitude || null;
    updates.custom_longitude = body.custom_longitude || null;
    updates.location_notes = body.location_notes || null;
  } else if (body.venue_id === null) {
    // Explicit venue clearing without custom location (for online-only events)
    updates.venue_id = null;
    updates.venue_name = null;
    updates.venue_address = null;
  }

  // Handle location_notes updates even when not changing location mode
  if (body.location_notes !== undefined && !hasCustomLocation) {
    updates.location_notes = body.location_notes || null;
  }

  // Handle is_dsc_event separately - only allow if canCreateDSC
  if (body.is_dsc_event !== undefined) {
    if (body.is_dsc_event === true && !canCreateDSC) {
      return NextResponse.json(
        { error: "Only approved hosts and admins can create DSC events" },
        { status: 403 }
      );
    }
    updates.is_dsc_event = body.is_dsc_event;
  }

  // Track major updates (date/time/venue/location_mode changes)
  const majorFields = ["event_date", "start_time", "end_time", "venue_id", "location_mode", "day_of_week"];
  const hasMajorChange = majorFields.some(field => body[field] !== undefined);
  if (hasMajorChange) {
    updates.last_major_update_at = now;
  }

  // Track cancellation with timestamp and reason
  if (body.status === "cancelled") {
    updates.cancelled_at = now;
    if (body.cancel_reason) {
      updates.cancel_reason = body.cancel_reason;
    }
  }

  // Track first publish
  if (body.is_published === true) {
    // Only set published_at if not already published
    const { data: existingEvent } = await supabase
      .from("events")
      .select("published_at")
      .eq("id", eventId)
      .single();

    if (!existingEvent?.published_at) {
      updates.published_at = now;
    }
    // Also set status to active when publishing
    if (!updates.status) {
      updates.status = "active";
    }
  }

  const { data: event, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(event);
}

// DELETE - Cancel/hide event (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEvent(supabase, session.user.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get event title and RSVPed users before cancelling
  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single();

  const { data: rsvpUsers } = await supabase
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .in("status", ["confirmed", "waitlist"]);

  // Parse optional cancel_reason from request body
  let cancelReason: string | null = null;
  try {
    const body = await request.json();
    cancelReason = body.cancel_reason || null;
  } catch {
    // No body provided, that's fine
  }

  const now = new Date().toISOString();

  // Soft delete - set status to cancelled with timestamp
  const { error } = await supabase
    .from("events")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: cancelReason,
      updated_at: now
    })
    .eq("id", eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify all RSVPed users that the event was cancelled
  if (rsvpUsers && rsvpUsers.length > 0 && event?.title) {
    const notificationResults = await Promise.allSettled(
      rsvpUsers.map((rsvp) =>
        supabase.rpc("create_user_notification", {
          p_user_id: rsvp.user_id,
          p_type: "event_cancelled",
          p_title: "Event Cancelled",
          p_message: `"${event.title}" has been cancelled by the host.`,
          p_link: null
        })
      )
    );

    // Log any notification failures without failing the request
    const failures = notificationResults.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`Failed to send ${failures.length} event cancellation notifications`);
    }
  }

  return NextResponse.json({ success: true });
}
