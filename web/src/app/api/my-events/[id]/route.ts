import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdminRole, checkHostStatus } from "@/lib/auth/adminAuth";
import { sendEventUpdatedNotifications } from "@/lib/notifications/eventUpdated";

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
    "signup_mode", "signup_url", "signup_deadline", "age_policy",
    // Timeslot configuration fields
    "has_timeslots", "total_slots", "slot_duration_minutes"
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

  // Handle allow_guests → allow_guest_slots mapping (form sends allow_guests, DB uses allow_guest_slots)
  if (body.allow_guests !== undefined) {
    updates.allow_guest_slots = body.allow_guests;
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

  // Get current event state before update (for first publish check, timeslot regeneration, and notifications)
  const { data: prevEvent } = await supabase
    .from("events")
    .select(`
      is_published, published_at, status,
      has_timeslots, total_slots, slot_duration_minutes,
      event_date, start_time, end_time, venue_id, location_mode, day_of_week,
      title, venue_name, venue_address, slug
    `)
    .eq("id", eventId)
    .single();

  // Phase 4.36: Require publish confirmation when transitioning from unpublished to published
  const wasPublished = prevEvent?.is_published ?? false;
  const willPublish = body.is_published === true;
  const isNewPublish = willPublish && !wasPublished;

  if (isNewPublish && body.host_publish_confirmed !== true) {
    return NextResponse.json(
      { error: "Publish confirmation required. Please confirm you're ready to publish." },
      { status: 400 }
    );
  }

  // Track first publish
  if (body.is_published === true) {
    if (!prevEvent?.published_at) {
      updates.published_at = now;
    }
    // Also set status to active when publishing
    if (!updates.status) {
      updates.status = "active";
    }
  }

  // Alias for backward compat with timeslot logic
  const currentEvent = prevEvent;

  // Determine if this update requires timeslot regeneration
  const timeslotsNowEnabled = body.has_timeslots === true;
  const timeslotsWereDisabled = currentEvent?.has_timeslots === false;
  const totalSlotsChanged = body.total_slots !== undefined && body.total_slots !== currentEvent?.total_slots;
  const slotDurationChanged = body.slot_duration_minutes !== undefined && body.slot_duration_minutes !== currentEvent?.slot_duration_minutes;

  const regenNeeded = timeslotsNowEnabled && (timeslotsWereDisabled || totalSlotsChanged || slotDurationChanged);

  // If regen needed, check for existing claims BEFORE applying update (fail fast)
  if (regenNeeded) {
    const { data: existingSlots } = await supabase
      .from("event_timeslots")
      .select("id")
      .eq("event_id", eventId);

    if (existingSlots && existingSlots.length > 0) {
      const slotIds = existingSlots.map(s => s.id);
      const { count: claimCount } = await supabase
        .from("timeslot_claims")
        .select("*", { count: "exact", head: true })
        .in("timeslot_id", slotIds)
        .in("status", ["confirmed", "performed", "waitlist"]);

      if (claimCount && claimCount > 0) {
        // Has existing claims - reject the entire update with 409
        return NextResponse.json(
          { error: "Slot configuration can't be changed after signups exist. Unclaim all slots first." },
          { status: 409 }
        );
      }
    }
  }

  // Now safe to apply the update
  const { data: event, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Regenerate timeslots if needed (we already verified no claims exist)
  if (regenNeeded) {
    const { data: existingSlots } = await supabase
      .from("event_timeslots")
      .select("id")
      .eq("event_id", eventId);

    if (existingSlots && existingSlots.length > 0) {
      // Slots exist but no claims - safe to regenerate
      const { error: regenError } = await supabase.rpc("generate_event_timeslots", { p_event_id: eventId });
      if (regenError) {
        console.error(`[PATCH /api/my-events/${eventId}] Timeslot regeneration error:`, regenError.message);
      } else {
        console.log(`[PATCH /api/my-events/${eventId}] Timeslots regenerated (${body.total_slots} slots)`);
      }
    } else {
      // No existing slots - generate fresh
      const { error: genError } = await supabase.rpc("generate_event_timeslots", { p_event_id: eventId });
      if (genError) {
        console.error(`[PATCH /api/my-events/${eventId}] Timeslot generation error:`, genError.message);
      } else {
        console.log(`[PATCH /api/my-events/${eventId}] Timeslots generated (${body.total_slots} slots)`);
      }
    }
  }

  // Phase 4.36: Send event updated notifications if major fields changed
  // Skip if: first publish (no attendees yet), or cancellation (handled by DELETE)
  const statusBecomingCancelled = body.status === "cancelled" && prevEvent?.status !== "cancelled";
  const shouldNotifyUpdate = hasMajorChange && wasPublished && !isNewPublish && !statusBecomingCancelled;

  if (shouldNotifyUpdate && prevEvent) {
    // Build changes object comparing prev to new values
    const changes: {
      date?: { old: string; new: string };
      time?: { old: string; new: string };
      venue?: { old: string; new: string };
      address?: { old: string; new: string };
    } = {};

    // Only include fields that actually changed
    if (body.event_date !== undefined && body.event_date !== prevEvent.event_date) {
      changes.date = {
        old: prevEvent.event_date || "TBD",
        new: body.event_date || "TBD"
      };
    }

    if (body.start_time !== undefined && body.start_time !== prevEvent.start_time) {
      changes.time = {
        old: prevEvent.start_time || "TBD",
        new: body.start_time || "TBD"
      };
    }

    if (body.day_of_week !== undefined && body.day_of_week !== prevEvent.day_of_week) {
      // Treat day change as a date change
      changes.date = {
        old: prevEvent.day_of_week || prevEvent.event_date || "TBD",
        new: body.day_of_week || body.event_date || "TBD"
      };
    }

    // Venue change - use venue_name for display
    const prevVenueName = prevEvent.venue_name || "TBD";
    const newVenueName = (updates.venue_name as string) || prevVenueName;
    if (body.venue_id !== undefined && body.venue_id !== prevEvent.venue_id) {
      changes.venue = {
        old: prevVenueName,
        new: newVenueName
      };
    }

    // Only notify if there are actual visible changes
    if (Object.keys(changes).length > 0) {
      // Fire-and-forget - don't block the response
      sendEventUpdatedNotifications(supabase, {
        eventId,
        eventSlug: prevEvent.slug,
        eventTitle: prevEvent.title || "Event",
        changes,
        eventDate: body.event_date || prevEvent.event_date || body.day_of_week || prevEvent.day_of_week || "",
        eventTime: body.start_time || prevEvent.start_time || "",
        venueName: newVenueName,
        venueAddress: (updates.venue_address as string) || prevEvent.venue_address || undefined
      }).catch((err) => {
        console.error(`[PATCH /api/my-events/${eventId}] Failed to send update notifications:`, err);
      });
    }
  }

  return NextResponse.json(event);
}

// DELETE - Cancel/hide event (soft delete) OR hard delete drafts
//
// Phase 4.42l: Users can hard delete their own draft events.
// - Drafts (is_published=false) with no RSVPs/claims: hard delete allowed
// - Published events: soft delete (cancel) only
// - Pass ?hard=true query param to request hard delete
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

  // Check if hard delete requested via query param
  const url = new URL(request.url);
  const hardDelete = url.searchParams.get("hard") === "true";

  // Get event details including publish status
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, is_published, host_id")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Phase 4.42l: Hard delete for drafts only
  if (hardDelete) {
    // Only allow hard delete for unpublished (draft) events
    if (event.is_published) {
      return NextResponse.json(
        { error: "Cannot delete published events. Cancel them instead." },
        { status: 400 }
      );
    }

    // Check for RSVPs (shouldn't exist for drafts, but be safe)
    const { count: rsvpCount } = await supabase
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (rsvpCount && rsvpCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: event has ${rsvpCount} RSVP${rsvpCount > 1 ? "s" : ""}` },
        { status: 409 }
      );
    }

    // Check for timeslot claims
    const { data: eventTimeslots } = await supabase
      .from("event_timeslots")
      .select("id")
      .eq("event_id", eventId);

    const timeslotIds = (eventTimeslots || []).map((t) => t.id);

    if (timeslotIds.length > 0) {
      const { count: claimCount } = await supabase
        .from("timeslot_claims")
        .select("id", { count: "exact", head: true })
        .in("timeslot_id", timeslotIds);

      if (claimCount && claimCount > 0) {
        return NextResponse.json(
          { error: `Cannot delete: event has ${claimCount} timeslot claim${claimCount > 1 ? "s" : ""}` },
          { status: 409 }
        );
      }
    }

    // Safe to hard delete
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (deleteError) {
      console.error(`[DELETE /api/my-events/${eventId}] Hard delete error:`, deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: true });
  }

  // Soft delete (cancel) - existing behavior for published events
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
