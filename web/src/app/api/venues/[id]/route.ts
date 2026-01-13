/**
 * Venue API - ABC9
 *
 * GET: Get venue details (public)
 * PATCH: Update venue (managers + admins)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import {
  isVenueManager,
  sanitizeVenuePatch,
  getDisallowedFields,
  MANAGER_EDITABLE_VENUE_FIELDS,
} from "@/lib/venue/managerAuth";
import { venueAudit } from "@/lib/audit/venueAudit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    // Public venue data - anyone can read
    const { data: venue, error } = await supabase
      .from("venues")
      .select(
        "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes"
      )
      .eq("id", id)
      .single();

    if (error || !venue) {
      // Try slug lookup
      const { data: venueBySlug, error: slugError } = await supabase
        .from("venues")
        .select(
          "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes"
        )
        .eq("slug", id)
        .single();

      if (slugError || !venueBySlug) {
        return NextResponse.json({ error: "Venue not found" }, { status: 404 });
      }

      return NextResponse.json(venueBySlug);
    }

    return NextResponse.json(venue);
  } catch (error) {
    console.error("[VenueAPI] GET error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await params;
    const supabase = await createSupabaseServerClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Authorization: must be venue manager OR admin
    const [isManager, isAdmin] = await Promise.all([
      isVenueManager(supabase, venueId, user.id),
      checkAdminRole(supabase, user.id),
    ]);

    if (!isManager && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to edit this venue" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Check for disallowed fields (warn in response)
    const disallowedFields = getDisallowedFields(body);

    // Sanitize patch to only allowed fields
    const sanitizedPatch = sanitizeVenuePatch(body);

    if (Object.keys(sanitizedPatch).length === 0) {
      return NextResponse.json(
        {
          error: "No valid fields to update",
          allowedFields: MANAGER_EDITABLE_VENUE_FIELDS,
          disallowedFields:
            disallowedFields.length > 0 ? disallowedFields : undefined,
        },
        { status: 400 }
      );
    }

    // Trim string values and convert empty strings to null
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(sanitizedPatch)) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        updates[key] = trimmed === "" ? null : trimmed;
      } else {
        updates[key] = value;
      }
    }

    // Use service role for the update to bypass RLS
    // (RLS allows public SELECT but requires admin for UPDATE)
    const serviceClient = createServiceRoleClient();

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

    // Perform the update
    const { data: updatedVenue, error: updateError } = await serviceClient
      .from("venues")
      .update(updates)
      .eq("id", venueId)
      .select(
        "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes"
      )
      .single();

    if (updateError) {
      console.error("[VenueAPI] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update venue" },
        { status: 500 }
      );
    }

    // Log the edit for audit trail (async, non-blocking)
    venueAudit.venueEdited(user.id, {
      venueId,
      venueName: existingVenue.name,
      updatedFields: Object.keys(updates),
      previousValues,
      newValues: updates,
      actorRole: isAdmin ? "admin" : "manager",
    });

    return NextResponse.json({
      success: true,
      venue: updatedVenue,
      updatedFields: Object.keys(updates),
      disallowedFields:
        disallowedFields.length > 0 ? disallowedFields : undefined,
    });
  } catch (error) {
    console.error("[VenueAPI] PATCH error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
