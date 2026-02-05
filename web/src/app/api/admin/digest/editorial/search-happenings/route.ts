/**
 * Admin Editorial — Search Happenings
 *
 * GET /api/admin/digest/editorial/search-happenings?q=<query>
 *
 * Returns up to 10 published, active events matching the query by title.
 * Used by the editorial editor to pick featured happenings.
 *
 * Admin-only.
 *
 * Phase: GTM-3
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const serviceClient = createServiceRoleClient();

  const { data, error } = await serviceClient
    .from("events")
    .select("id, title, event_date, venues!left(name)")
    .eq("is_published", true)
    .eq("status", "active")
    .ilike("title", `%${query}%`)
    .order("title", { ascending: true })
    .limit(10);

  if (error) {
    console.error("[SearchHappenings] Error:", error);
    return NextResponse.json(
      { error: "Failed to search happenings" },
      { status: 500 }
    );
  }

  const results = (data || []).map((event) => ({
    id: event.id,
    title: event.title,
    event_date: event.event_date,
    venue_name: Array.isArray(event.venues)
      ? event.venues[0]?.name ?? null
      : (event.venues as { name: string } | null)?.name ?? null,
  }));

  return NextResponse.json({ results });
}
