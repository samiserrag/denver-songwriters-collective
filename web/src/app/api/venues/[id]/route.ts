/**
 * Venue API - ABC9
 *
 * GET: Get venue details (public)
 * PATCH: Update venue (managers + admins + event hosts/cohosts)
 *
 * Phase 0.6: Trust-First Model
 * - Event hosts/cohosts can edit venues for their events
 * - Auto-geocoding when address changes
 * - Manual coordinate override supported
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import {
  canEditVenue,
  sanitizeVenuePatch,
  getDisallowedFields,
  MANAGER_EDITABLE_VENUE_FIELDS,
} from "@/lib/venue/managerAuth";
import { venueAudit } from "@/lib/audit/venueAudit";
import { processVenueGeocodingWithStatus } from "@/lib/venue/geocoding";
import { upsertMediaEmbeds } from "@/lib/mediaEmbedsServer";
import {
  buildGeocodingWarning,
  notifyVenueGeocodingFailure,
} from "@/lib/venue/geocodingMonitoring";

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
        "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes, cover_image_url"
      )
      .eq("id", id)
      .single();

    if (error || !venue) {
      // Try slug lookup
      const { data: venueBySlug, error: slugError } = await supabase
        .from("venues")
        .select(
          "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes, cover_image_url"
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

    // Authorization: must be venue manager OR admin OR event host at this venue
    // Phase 0.6: canEditVenue now includes event host check
    const [canEdit, isAdmin] = await Promise.all([
      canEditVenue(supabase, venueId, user.id),
      checkAdminRole(supabase, user.id),
    ]);

    if (!canEdit && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to edit this venue" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Extract media_embed_urls before sanitizing venue fields
    // (sanitizeVenuePatch strips unknown keys, including media_embed_urls)
    const mediaEmbedUrls: string[] | undefined = Array.isArray(body.media_embed_urls)
      ? body.media_embed_urls
      : undefined;

    // Check for disallowed fields (warn in response)
    // Exclude media_embed_urls from the disallowed check — it's handled separately
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { media_embed_urls: _mediaUrls, ...bodyForFieldCheck } = body;
    const disallowedFields = getDisallowedFields(bodyForFieldCheck);

    // Sanitize patch to only allowed fields
    const sanitizedPatch = sanitizeVenuePatch(body);

    const hasVenueFieldChanges = Object.keys(sanitizedPatch).length > 0;
    const hasMediaChanges = mediaEmbedUrls !== undefined;

    if (!hasVenueFieldChanges && !hasMediaChanges) {
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

    // Use service role for the update to bypass RLS
    // (RLS allows public SELECT but requires admin for UPDATE)
    const serviceClient = createServiceRoleClient();

    let updatedVenue = null;
    let geocodingApplied = false;
    let geocodingWarning:
      | ReturnType<typeof buildGeocodingWarning>
      | undefined;
    let updatedFields: string[] = [];

    // --- Venue field update (only if there are venue field changes) ---
    if (hasVenueFieldChanges) {
      // Trim string values and convert empty strings to null
      const updates: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(sanitizedPatch)) {
        if (typeof value === "string") {
          const trimmed = value.trim();
          updates[key] = trimmed === "" ? null : trimmed;
        } else {
          // Value is null or undefined from sanitized patch
          updates[key] = value as string | null;
        }
      }

      // Fetch current venue values for audit trail (before snapshot)
      // Phase 0.6: Include coordinate fields for geocoding logic
      const { data: existingVenue, error: checkError } = await serviceClient
        .from("venues")
        .select(
          "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes, cover_image_url, latitude, longitude, geocode_source"
        )
        .eq("id", venueId)
        .single();

      if (checkError || !existingVenue) {
        return NextResponse.json({ error: "Venue not found" }, { status: 404 });
      }

      // Phase 0.6: Process geocoding if address fields changed
      const { updates: updatesWithGeo, geocodingStatus } = await processVenueGeocodingWithStatus(
        existingVenue,
        updates as Record<string, unknown>
      );

      // Capture previous values for changed fields only
      const previousValues: Record<string, unknown> = {};
      for (const key of Object.keys(updatesWithGeo)) {
        previousValues[key] = existingVenue[key as keyof typeof existingVenue];
      }

      // Perform the update
      const { data: venueResult, error: updateError } = await serviceClient
        .from("venues")
        .update(updatesWithGeo)
        .eq("id", venueId)
        .select(
          "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes, cover_image_url, latitude, longitude, geocode_source, geocoded_at"
        )
        .single();

      if (updateError) {
        console.error("[VenueAPI] Update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update venue" },
          { status: 500 }
        );
      }

      updatedVenue = venueResult;
      updatedFields = Object.keys(updatesWithGeo);
      geocodingApplied = geocodingStatus.success;

      if (geocodingStatus.attempted && !geocodingStatus.success) {
        geocodingWarning = buildGeocodingWarning(geocodingStatus);
        await notifyVenueGeocodingFailure({
          route: "PATCH /api/venues/[id]",
          actorId: user.id,
          actorEmail: user.email,
          venueId,
          venueName: existingVenue.name,
          address:
            (updatesWithGeo.address as string | null | undefined) ??
            existingVenue.address,
          city:
            (updatesWithGeo.city as string | null | undefined) ??
            existingVenue.city,
          state:
            (updatesWithGeo.state as string | null | undefined) ??
            existingVenue.state,
          zip:
            (updatesWithGeo.zip as string | null | undefined) ??
            existingVenue.zip,
          googleMapsUrl:
            (updatesWithGeo.google_maps_url as string | null | undefined) ??
            existingVenue.google_maps_url,
          geocodingStatus,
        });
      }

      // Log the edit for audit trail (async, non-blocking)
      venueAudit.venueEdited(user.id, {
        venueId,
        venueName: existingVenue.name,
        updatedFields,
        previousValues,
        newValues: updatesWithGeo,
        actorRole: isAdmin ? "admin" : (canEdit ? "host" : "manager"),
      });
    }

    // --- Media embeds upsert (if media_embed_urls was provided) ---
    if (hasMediaChanges && mediaEmbedUrls) {
      try {
        await upsertMediaEmbeds(
          serviceClient,
          { type: "venue", id: venueId },
          mediaEmbedUrls,
          user.id
        );
      } catch (embedError) {
        console.error("[VenueAPI] Media embed upsert error:", embedError);
        // Non-blocking: venue fields were already saved.
        // Return success with a warning about embeds.
        return NextResponse.json({
          success: true,
          venue: updatedVenue,
          updatedFields,
          geocodingApplied,
          geocodingWarning,
          mediaEmbedsError: embedError instanceof Error ? embedError.message : "Failed to save media embeds",
          disallowedFields:
            disallowedFields.length > 0 ? disallowedFields : undefined,
        });
      }
    }

    return NextResponse.json({
      success: true,
      venue: updatedVenue,
      updatedFields,
      geocodingApplied,
      geocodingWarning,
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
