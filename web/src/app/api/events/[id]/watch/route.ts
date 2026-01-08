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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ watching: false });
  }

  // Query event_watchers table
  // Note: Table exists but not in generated types yet, using type cast
  const { data } = await supabase
    .from("event_watchers" as "events")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", session.user.id)
    .maybeSingle() as unknown as { data: { user_id: string } | null };

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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-only guard
  const isAdmin = await checkAdminRole(supabase, session.user.id);
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

  // Insert watcher entry
  // Note: Table exists but not in generated types yet, using type cast
  const { error } = await supabase
    .from("event_watchers" as "events")
    .insert({ event_id: eventId, user_id: session.user.id } as unknown as Record<string, unknown>)
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
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Note: Table exists but not in generated types yet, using type cast
  await supabase
    .from("event_watchers" as "events")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", session.user.id);

  return NextResponse.json({ success: true, watching: false });
}
