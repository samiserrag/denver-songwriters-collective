import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET - Get all venues (admin only)
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabase.auth.getUser();
  if (user?.user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST - Create a new venue (admin only)
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabase.auth.getUser();
  if (user?.user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, address, city, state, zip, website_url, phone, google_maps_url } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
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
