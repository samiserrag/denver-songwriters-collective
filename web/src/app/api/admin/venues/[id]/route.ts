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

  // Pre-delete check: verify venue exists
  const { data: preDelete, error: preError } = await serviceClient
    .from("venues")
    .select("id, name, slug")
    .eq("id", id)
    .maybeSingle();

  if (preError) {
    console.error("[VENUE DELETE] Pre-delete check failed:", preError);
    return NextResponse.json({ error: preError.message }, { status: 500 });
  }

  if (!preDelete) {
    // Venue doesn't exist - already deleted or wrong ID
    return NextResponse.json(
      { error: "Venue not found", detail: "No venue exists with this ID" },
      { status: 404 }
    );
  }

  // Perform delete and return deleted rows to verify
  const { data: deleted, error } = await serviceClient
    .from("venues")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[VENUE DELETE] Delete failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Verify deletion actually happened
  if (!deleted || deleted.length === 0) {
    console.error("[VENUE DELETE] Delete returned 0 rows for venue:", preDelete.name);
    return NextResponse.json(
      { error: "Delete failed", detail: "Venue existed but delete returned 0 rows" },
      { status: 500 }
    );
  }

  // Post-delete verification: confirm venue is gone
  const { data: postDelete } = await serviceClient
    .from("venues")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (postDelete) {
    // This should never happen - delete succeeded but row still exists
    console.error("[VENUE DELETE] CRITICAL: Venue still exists after delete:", preDelete.name);
    return NextResponse.json(
      { error: "Delete verification failed", detail: "Row still exists after delete" },
      { status: 500 }
    );
  }

  // Log successful deletion
  console.log(`[VENUE DELETE] Successfully deleted venue: ${preDelete.name} (${id})`);

  return NextResponse.json({
    success: true,
    deletedId: id,
    deletedName: preDelete.name,
    deletedSlug: preDelete.slug,
  });
}
