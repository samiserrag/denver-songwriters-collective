import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { venueAudit } from "@/lib/audit/venueAudit";
import { MANAGER_EDITABLE_VENUE_FIELDS } from "@/lib/venue/managerAuth";

// GET - Get a single venue (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    .from("venues")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH - Update a venue (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: venueId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const updates: Record<string, string | null> = {};

  // Admin uses same allowlist as managers for consistency
  for (const field of MANAGER_EDITABLE_VENUE_FIELDS) {
    if (body[field] !== undefined) {
      const value = body[field];
      if (typeof value === "string") {
        const trimmed = value.trim();
        // Required fields (name, address, city, state) get empty string, others get null
        if (["name", "address", "city", "state"].includes(field)) {
          updates[field] = trimmed || "";
        } else {
          updates[field] = trimmed || null;
        }
      } else {
        updates[field] = value;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Fetch current venue values for audit trail (before snapshot)
  const { data: existingVenue, error: checkError } = await serviceClient
    .from("venues")
    .select(
      "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes"
    )
    .eq("id", venueId)
    .single();

  if (checkError || !existingVenue) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  // Capture previous values for changed fields only
  const previousValues: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    previousValues[key] = existingVenue[key as keyof typeof existingVenue];
  }

  const { data, error } = await serviceClient
    .from("venues")
    .update(updates)
    .eq("id", venueId)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Venue not found or update failed" }, { status: 404 });
  }

  // Log the edit for audit trail (async, non-blocking)
  venueAudit.venueEdited(user.id, {
    venueId,
    venueName: existingVenue.name,
    updatedFields: Object.keys(updates),
    previousValues,
    newValues: updates,
    actorRole: "admin",
  });

  return NextResponse.json(data[0]);
}

// DELETE - Delete a venue (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Use service role client for admin operations that bypass RLS
  const serviceClient = createServiceRoleClient();

  const { error } = await serviceClient.from("venues").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
