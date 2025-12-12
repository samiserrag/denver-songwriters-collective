import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET - Get comments for event
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("event_comments")
    .select(
      `
      *,
      user:profiles(id, full_name, avatar_url)
    `
    )
    .eq("event_id", eventId)
    .eq("is_hidden", false)
    .eq("is_host_only", false)
    .is("parent_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST - Create comment
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

  const { content, parent_id } = await request.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  // Limit comment length to prevent abuse
  if (content.length > 2000) {
    return NextResponse.json({ error: "Comment too long (max 2000 characters)" }, { status: 400 });
  }

  // Rate limiting: Check how many comments user has posted in last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: recentCommentCount } = await supabase
    .from("event_comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .gte("created_at", fiveMinutesAgo);

  // Limit to 10 comments per 5 minutes per user
  if ((recentCommentCount || 0) >= 10) {
    return NextResponse.json(
      { error: "Too many comments. Please wait a few minutes before posting again." },
      { status: 429 }
    );
  }

  // Verify event exists and is a DSC event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, is_dsc_event")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!event.is_dsc_event) {
    return NextResponse.json({ error: "Comments only available for DSC events" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("event_comments")
    .insert({
      event_id: eventId,
      user_id: session.user.id,
      content: content.trim(),
      parent_id: parent_id || null,
    })
    .select(
      `
      *,
      user:profiles(id, full_name, avatar_url)
    `
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
