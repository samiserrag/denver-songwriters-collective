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
