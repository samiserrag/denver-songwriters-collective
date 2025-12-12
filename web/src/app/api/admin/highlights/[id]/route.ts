import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET single highlight
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("monthly_highlights")
      .select(`
        *,
        event:events(id, title),
        performer:profiles(id, full_name),
        venue:venues(id, name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching highlight:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Highlight not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Highlight GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH update highlight
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Only include fields that are present in the request
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.highlight_type !== undefined) updates.highlight_type = body.highlight_type;
    if (body.event_id !== undefined) updates.event_id = body.event_id || null;
    if (body.performer_id !== undefined) updates.performer_id = body.performer_id || null;
    if (body.venue_id !== undefined) updates.venue_id = body.venue_id || null;
    if (body.image_url !== undefined) updates.image_url = body.image_url || null;
    if (body.link_url !== undefined) updates.link_url = body.link_url || null;
    if (body.link_text !== undefined) updates.link_text = body.link_text;
    if (body.display_order !== undefined) updates.display_order = body.display_order;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.end_date !== undefined) updates.end_date = body.end_date || null;

    const { data, error } = await supabase
      .from("monthly_highlights")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error updating highlight:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Highlight not found or update failed" }, { status: 404 });
    }

    return NextResponse.json(data[0]);
  } catch (err) {
    console.error("Highlight PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE highlight
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("monthly_highlights")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting highlight:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Highlight DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
