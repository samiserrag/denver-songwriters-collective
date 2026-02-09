import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { resolveEffectiveDateKey, dateKeyErrorResponse } from "@/lib/events/dateKeyContract";
import { promoteNextWaitlistPerson, sendOfferNotifications } from "@/lib/waitlistOffer";

// GET - Get all RSVPs for an event (host view)
// Phase ABC7: Requires date_key to return occurrence-specific RSVPs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Phase ABC7: Get date_key from query params
  const url = new URL(request.url);
  const providedDateKey = url.searchParams.get("date_key");

  // Resolve effective date_key (required for per-occurrence RSVP list)
  const dateKeyResult = await resolveEffectiveDateKey(eventId, providedDateKey);
  if (!dateKeyResult.success) {
    return dateKeyErrorResponse(dateKeyResult.error);
  }
  const { effectiveDateKey } = dateKeyResult;

  // Check if user is host or admin (using profiles.role, not app_metadata)
  const isAdmin = await checkAdminRole(supabase, sessionUser.id);

  if (!isAdmin) {
    const { data: hostEntry } = await supabase
      .from("event_hosts")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", sessionUser.id)
      .eq("invitation_status", "accepted")
      .maybeSingle();

    if (!hostEntry) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Phase ABC7: Filter RSVPs by (event_id, date_key) for per-occurrence results
  const { data: rsvps, error } = await supabase
    .from("event_rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("date_key", effectiveDateKey)
    .order("status", { ascending: true })
    .order("waitlist_position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch profiles for all RSVP user_ids (filter out nulls from guest RSVPs)
  const rsvpUserIds = rsvps?.map(r => r.user_id).filter((id): id is string => id !== null) || [];
  let profileMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();

  if (rsvpUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", rsvpUserIds);

    profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
  }

  // Enrich RSVPs with profile data
  const enrichedRsvps = rsvps?.map(r => ({
    ...r,
    user: profileMap.get(r.user_id) || undefined
  })) || [];

  // Group by status
  const confirmed = enrichedRsvps.filter(r => r.status === "confirmed");
  const waitlist = enrichedRsvps.filter(r => r.status === "waitlist");
  const cancelled = enrichedRsvps.filter(r => r.status === "cancelled");

  // Phase ABC7: Include date_key in response for client awareness
  return NextResponse.json({
    confirmed,
    waitlist,
    cancelled,
    total_confirmed: confirmed.length,
    total_waitlist: waitlist.length,
    date_key: effectiveDateKey,
  });
}

// DELETE - Host/admin removes an RSVP (soft-delete + waitlist auto-promotion)
// Only primary hosts and admins can remove RSVPs (not cohosts)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorization: admin or primary host only (not cohosts)
  const isAdmin = await checkAdminRole(supabase, sessionUser.id);

  if (!isAdmin) {
    // Check if user is PRIMARY host (role = 'host', not 'cohost')
    const { data: hostEntry } = await supabase
      .from("event_hosts")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", sessionUser.id)
      .eq("invitation_status", "accepted")
      .eq("role", "host")
      .maybeSingle();

    if (!hostEntry) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Get rsvp_id from request body
  let rsvpId: string;
  try {
    const body = await request.json();
    rsvpId = body.rsvp_id;
  } catch {
    return NextResponse.json({ error: "rsvp_id required in body" }, { status: 400 });
  }

  if (!rsvpId) {
    return NextResponse.json({ error: "rsvp_id required" }, { status: 400 });
  }

  // Verify the RSVP belongs to this event
  const { data: rsvp, error: rsvpError } = await supabase
    .from("event_rsvps")
    .select("id, user_id, guest_name, status, date_key")
    .eq("id", rsvpId)
    .eq("event_id", eventId)
    .single();

  if (rsvpError || !rsvp) {
    return NextResponse.json({ error: "RSVP not found" }, { status: 404 });
  }

  // Only cancel active RSVPs (confirmed, waitlist, offered)
  if (!["confirmed", "waitlist", "offered"].includes(rsvp.status)) {
    return NextResponse.json({ error: `RSVP is already ${rsvp.status}` }, { status: 400 });
  }

  const opensSpot = rsvp.status === "confirmed" || rsvp.status === "offered";

  // Soft-delete: set status to "cancelled"
  const { error: updateError } = await supabase
    .from("event_rsvps")
    .update({
      status: "cancelled",
      offer_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rsvpId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If this opened a confirmed spot, promote next waitlisted person
  if (opensSpot) {
    try {
      const promotedRsvpId = await promoteNextWaitlistPerson(
        supabase, eventId, rsvp.date_key, rsvpId
      );
      if (promotedRsvpId) {
        const { data: promotedRsvp } = await supabase
          .from("event_rsvps")
          .select("user_id, offer_expires_at")
          .eq("id", promotedRsvpId)
          .single();
        if (promotedRsvp?.user_id && promotedRsvp.offer_expires_at) {
          await sendOfferNotifications(
            supabase, eventId, promotedRsvp.user_id,
            promotedRsvp.offer_expires_at, rsvp.date_key
          );
        }
      }
    } catch (err) {
      console.error(`[DELETE /api/my-events/${eventId}/rsvps] Waitlist promotion error:`, err);
    }
  }

  // Notify the removed member (if not a guest RSVP)
  if (rsvp.user_id) {
    const { data: event } = await supabase
      .from("events")
      .select("title, slug")
      .eq("id", eventId)
      .single();

    if (event) {
      try {
        await supabase.rpc("create_user_notification", {
          p_user_id: rsvp.user_id,
          p_type: "rsvp_removed",
          p_title: "Your RSVP was removed",
          p_message: `Your RSVP for "${event.title}" was removed by the host.`,
          p_link: `/events/${event.slug || eventId}`,
        });
      } catch (err) {
        console.error(`[DELETE /api/my-events/${eventId}/rsvps] Failed to notify user:`, err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    rsvpId,
    previousStatus: rsvp.status,
  });
}
