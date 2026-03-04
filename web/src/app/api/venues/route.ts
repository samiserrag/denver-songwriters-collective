import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkHostStatus } from "@/lib/auth/adminAuth";
import { processVenueGeocodingWithStatus } from "@/lib/venue/geocoding";
import { Database } from "@/lib/supabase/database.types";
import {
  buildGeocodingWarning,
  notifyVenueGeocodingFailure,
} from "@/lib/venue/geocodingMonitoring";

// ---------------------------------------------------------------------------
// POST /api/venues — Create a new venue (approved hosts + admins).
//
// UX-13: Hosts need to create venues during event creation when the venue
// isn't in the catalog. This endpoint mirrors /api/admin/venues POST but
// relaxes the auth gate from admin-only to approved-host-or-admin.
//
// Auth: authenticated + (checkHostStatus → approved_hosts.active OR admin).
// RLS bypass: uses service role client (same pattern as admin route).
// Geocoding: same pipeline as admin route.
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // UX-13: Allow approved hosts (not just admins) to create venues.
  // checkHostStatus returns true for admins AND active approved_hosts.
  const isHost = await checkHostStatus(supabase, user.id);
  if (!isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = createServiceRoleClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, address, city, state, zip, website_url, phone, google_maps_url } = body as {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    website_url?: string;
    phone?: string;
    google_maps_url?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
  }

  if (!address?.trim()) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  const baseInsert: Database["public"]["Tables"]["venues"]["Insert"] = {
    name: name.trim(),
    address: address.trim(),
    city: city?.trim() || "Denver",
    state: state?.trim() || "CO",
    zip: zip?.trim() || null,
    website_url: website_url?.trim() || null,
    phone: phone?.trim() || null,
    google_maps_url: google_maps_url?.trim() || null,
  };

  // Run through same geocoding pipeline as admin venue creation.
  const { updates: geocodedInsertRaw, geocodingStatus } =
    await processVenueGeocodingWithStatus(null, baseInsert);
  const geocodedInsert =
    geocodedInsertRaw as Database["public"]["Tables"]["venues"]["Insert"];

  const { data, error } = await serviceClient
    .from("venues")
    .insert(geocodedInsert)
    .select()
    .single();

  if (error) {
    console.error("[POST /api/venues] Insert error:", error.message, "| actor:", user.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info("[POST /api/venues] Venue created:", data.id, "| name:", data.name, "| actor:", user.id, "| email:", user.email);

  let geocodingWarning:
    | ReturnType<typeof buildGeocodingWarning>
    | undefined;

  if (geocodingStatus.attempted && !geocodingStatus.success) {
    geocodingWarning = buildGeocodingWarning(geocodingStatus);
    await notifyVenueGeocodingFailure({
      route: "POST /api/venues",
      actorId: user.id,
      actorEmail: user.email,
      venueId: data.id,
      venueName: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      googleMapsUrl: data.google_maps_url,
      geocodingStatus,
    });
  }

  return NextResponse.json(
    {
      ...data,
      geocodingApplied: geocodingStatus.success,
      geocodingWarning,
    },
    { status: 201 }
  );
}
