import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";

// GET all highlights
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role client for admin operations that bypass RLS
    const serviceClient = createServiceRoleClient();

    const { data, error } = await serviceClient
      .from("monthly_highlights")
      .select(`
        *,
        event:events(id, title),
        performer:profiles(id, full_name),
        venue:venues(id, name)
      `)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching highlights:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Highlights GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST new highlight
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role client for admin operations that bypass RLS
    const serviceClient = createServiceRoleClient();

    const body = await request.json();

    const { data, error } = await serviceClient
      .from("monthly_highlights")
      .insert({
        title: body.title,
        description: body.description,
        highlight_type: body.highlight_type,
        event_id: body.event_id || null,
        performer_id: body.performer_id || null,
        venue_id: body.venue_id || null,
        image_url: body.image_url || null,
        link_url: body.link_url || null,
        link_text: body.link_text || "Learn More",
        display_order: body.display_order || 0,
        is_active: body.is_active !== false,
        start_date: body.start_date || new Date().toISOString().split("T")[0],
        end_date: body.end_date || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating highlight:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Highlights POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
