import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { canManageEvent } from "@/lib/events/eventManageAuth";
import { getTodayDenver } from "@/lib/events/nextOccurrence";

/**
 * Phase 5.02: Host claims management API
 *
 * GET /api/my-events/[id]/claims - List all timeslot claims for an event
 * DELETE /api/my-events/[id]/claims - Remove a specific claim (via claim_id in body)
 */

// GET - List claims for event, grouped by date
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

  const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse optional date_key filter from query params
  const url = new URL(request.url);
  const dateKeyFilter = url.searchParams.get("date_key");

  // Get all timeslots for this event
  let timeslotQuery = supabase
    .from("event_timeslots")
    .select("id, slot_index, date_key, start_offset_minutes, duration_minutes")
    .eq("event_id", eventId)
    .order("date_key", { ascending: true })
    .order("slot_index", { ascending: true });

  if (dateKeyFilter) {
    timeslotQuery = timeslotQuery.eq("date_key", dateKeyFilter);
  }

  const { data: timeslots, error: timeslotError } = await timeslotQuery;

  if (timeslotError) {
    return NextResponse.json({ error: timeslotError.message }, { status: 500 });
  }

  if (!timeslots || timeslots.length === 0) {
    return NextResponse.json({
      claims: [],
      byDate: {},
      totalClaims: 0,
      futureClaims: 0,
      pastClaims: 0,
    });
  }

  const slotIds = timeslots.map(s => s.id);

  // Get claims for these timeslots with performer info
  const { data: claims, error: claimsError } = await supabase
    .from("timeslot_claims")
    .select(`
      id,
      timeslot_id,
      member_id,
      guest_name,
      guest_email,
      status,
      created_at,
      profiles:member_id(id, full_name, avatar_url, slug)
    `)
    .in("timeslot_id", slotIds)
    .in("status", ["confirmed", "performed", "waitlist", "cancelled", "no_show"])
    .order("created_at", { ascending: true });

  if (claimsError) {
    return NextResponse.json({ error: claimsError.message }, { status: 500 });
  }

  // Build a map of timeslot_id to timeslot data
  const slotMap = new Map(timeslots.map(s => [s.id, s]));

  // Enrich claims with slot data
  const enrichedClaims = (claims || []).map(claim => {
    const slot = slotMap.get(claim.timeslot_id);
    return {
      ...claim,
      slot_index: slot?.slot_index ?? null,
      date_key: slot?.date_key ?? null,
      start_offset_minutes: slot?.start_offset_minutes ?? null,
      duration_minutes: slot?.duration_minutes ?? null,
      // Indicate if this is a guest claim (no member_id)
      is_guest: !claim.member_id,
    };
  });

  // Group by date_key
  const byDate: Record<string, typeof enrichedClaims> = {};
  for (const claim of enrichedClaims) {
    const dateKey = claim.date_key || "unknown";
    if (!byDate[dateKey]) {
      byDate[dateKey] = [];
    }
    byDate[dateKey].push(claim);
  }

  // Sort each date's claims by slot_index
  for (const dateKey of Object.keys(byDate)) {
    byDate[dateKey].sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0));
  }

  // Count future vs past claims
  const todayKey = getTodayDenver();
  const activeClaims = enrichedClaims.filter(c =>
    c.status === "confirmed" || c.status === "performed" || c.status === "waitlist"
  );
  const futureClaims = activeClaims.filter(c => (c.date_key || "") >= todayKey).length;
  const pastClaims = activeClaims.filter(c => (c.date_key || "") < todayKey).length;

  return NextResponse.json({
    claims: enrichedClaims,
    byDate,
    totalClaims: enrichedClaims.length,
    activeClaims: activeClaims.length,
    futureClaims,
    pastClaims,
    todayKey,
  });
}

// DELETE - Remove/cancel a claim
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

  const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get claim_id from request body
  let claimId: string;
  try {
    const body = await request.json();
    claimId = body.claim_id;
  } catch {
    return NextResponse.json({ error: "claim_id required in body" }, { status: 400 });
  }

  if (!claimId) {
    return NextResponse.json({ error: "claim_id required" }, { status: 400 });
  }

  // Verify the claim belongs to a timeslot of this event
  const { data: claim, error: claimError } = await supabase
    .from("timeslot_claims")
    .select(`
      id,
      member_id,
      guest_name,
      status,
      timeslot_id,
      event_timeslots!inner(event_id)
    `)
    .eq("id", claimId)
    .single();

  if (claimError || !claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  // Type-safe access to nested data (inner join returns array with one element)
  const eventTimeslots = claim.event_timeslots as unknown as Array<{ event_id: string }> | null;
  const claimEventId = eventTimeslots?.[0]?.event_id;
  if (claimEventId !== eventId) {
    return NextResponse.json({ error: "Claim does not belong to this event" }, { status: 403 });
  }

  // Cancel the claim (soft delete preserves history)
  const { error: updateError } = await supabase
    .from("timeslot_claims")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If this was a member claim (not guest), notify them
  if (claim.member_id) {
    // Get event title for notification
    const { data: event } = await supabase
      .from("events")
      .select("title, slug")
      .eq("id", eventId)
      .single();

    if (event) {
      try {
        await supabase.rpc("create_user_notification", {
          p_user_id: claim.member_id,
          p_type: "claim_removed",
          p_title: "Your signup was removed",
          p_message: `Your performer slot for "${event.title}" was removed by the host.`,
          p_link: `/events/${event.slug || eventId}`,
        });
      } catch (err) {
        console.error(`[DELETE /api/my-events/${eventId}/claims] Failed to notify user:`, err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    claimId,
    previousStatus: claim.status,
    performerName: claim.guest_name || "Unknown",
  });
}
