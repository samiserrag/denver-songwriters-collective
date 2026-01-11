import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

// GET - Get all venues (admin only)
export async function GET() {
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

  // Fetch all venues
  const { data: venues, error: venuesError } = await serviceClient
    .from("venues")
    .select("*")
    .order("name", { ascending: true });

  if (venuesError) {
    return NextResponse.json({ error: venuesError.message }, { status: 500 });
  }

  // Fetch event counts per venue (active, published only)
  const { data: eventCounts } = await serviceClient
    .from("events")
    .select("venue_id")
    .not("venue_id", "is", null)
    .neq("status", "cancelled")
    .eq("is_published", true);

  // Build count map
  const countMap = new Map<string, number>();
  if (eventCounts) {
    for (const event of eventCounts) {
      if (event.venue_id) {
        countMap.set(event.venue_id, (countMap.get(event.venue_id) || 0) + 1);
      }
    }
  }

  // Merge counts into venues
  const venuesWithCounts = (venues ?? []).map((venue) => ({
    ...venue,
    happenings_count: countMap.get(venue.id) || 0,
  }));

  return NextResponse.json(venuesWithCounts);
}

// POST - Create a new venue (admin only)
export async function POST(request: Request) {
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
  const { name, address, city, state, zip, website_url, phone, google_maps_url } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("venues")
    .insert({
      name: name.trim(),
      address: address?.trim() || "",
      city: city?.trim() || "Denver",
      state: state?.trim() || "CO",
      zip: zip?.trim() || null,
      website_url: website_url?.trim() || null,
      phone: phone?.trim() || null,
      google_maps_url: google_maps_url?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
