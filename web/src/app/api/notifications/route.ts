import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET - Get user's notifications
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH - Mark notifications as read
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids, markAll } = await request.json();

  if (markAll) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", session.user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }
  } else if (ids?.length) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", session.user.id)
      .in("id", ids);

    if (error) {
      console.error("Error marking notifications as read:", error);
      return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
