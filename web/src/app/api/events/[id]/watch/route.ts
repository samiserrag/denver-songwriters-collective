import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

/**
 * GET /api/events/[id]/watch
 * Check if current user is watching this event
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ watching: false });
  }

  const { data } = await supabase
    .from("event_watchers")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  return NextResponse.json({ watching: !!data });
}

/**
 * POST /api/events/[id]/watch
 * Add current user as watcher (admin only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-only guard
  const isAdmin = await checkAdminRole(supabase, sessionUser.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Verify event exists
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("event_watchers")
    .insert({ event_id: eventId, user_id: sessionUser.id })
    .select()
    .single();

  if (error?.code === "23505") {
    // Already watching (unique constraint violation)
    return NextResponse.json({ success: true, watching: true });
  }

  if (error) {
    console.error("Watch event error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, watching: true });
}

/**
 * DELETE /api/events/[id]/watch
 * Remove current user as watcher
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("event_watchers")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", sessionUser.id);

  return NextResponse.json({ success: true, watching: false });
}
