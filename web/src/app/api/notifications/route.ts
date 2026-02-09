import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - Get user's notifications with pagination and filters
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor"); // ISO date string for pagination
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const type = searchParams.get("type"); // Filter by notification type
  const unreadOnly = searchParams.get("unread") === "true";

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", sessionUser.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Apply cursor-based pagination
  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  // Apply type filter
  if (type) {
    query = query.eq("type", type);
  }

  // Apply unread filter
  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Determine next cursor (last item's created_at)
  const nextCursor = data && data.length === limit ? data[data.length - 1].created_at : null;

  return NextResponse.json({
    notifications: data || [],
    nextCursor,
    total: count,
    hasMore: !!nextCursor
  });
}

// PATCH - Mark notifications as read
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids, markAll } = await request.json();

  if (markAll) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", sessionUser.id)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }
  } else if (ids?.length) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", sessionUser.id)
      .in("id", ids);

    if (error) {
      console.error("Error marking notifications as read:", error);
      return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE - Delete notifications (by ids, older than date, or all read)
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids, olderThan, deleteAllRead } = await request.json();

  let deletedCount = 0;

  if (deleteAllRead) {
    // Delete all read notifications
    const { error, count } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .eq("user_id", sessionUser.id)
      .eq("is_read", true);

    if (error) {
      console.error("Error deleting read notifications:", error);
      return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 });
    }
    deletedCount = count || 0;
  } else if (olderThan) {
    // Delete notifications older than a specific date (ISO string)
    const { error, count } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .eq("user_id", sessionUser.id)
      .lt("created_at", olderThan);

    if (error) {
      console.error("Error deleting old notifications:", error);
      return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 });
    }
    deletedCount = count || 0;
  } else if (ids?.length) {
    // Delete specific notifications by ID
    const { error, count } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .eq("user_id", sessionUser.id)
      .in("id", ids);

    if (error) {
      console.error("Error deleting notifications:", error);
      return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 });
    }
    deletedCount = count || 0;
  }

  return NextResponse.json({ success: true, deletedCount });
}
