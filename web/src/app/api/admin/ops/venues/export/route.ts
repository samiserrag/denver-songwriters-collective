/**
 * Venue CSV Export API
 *
 * GET /api/admin/ops/venues/export
 *
 * Returns all venues as a downloadable CSV file.
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { serializeVenueCsv } from "@/lib/ops/venueCsvParser";
import { opsAudit } from "@/lib/audit/opsAudit";

export async function GET() {
  // Auth check
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

  // Fetch all venues
  const serviceClient = createServiceRoleClient();

  const { data: venues, error } = await serviceClient
    .from("venues")
    .select("id, name, address, city, state, zip, website_url, phone, google_maps_url, notes")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Serialize to CSV
  const csv = serializeVenueCsv(venues || []);

  // Log the export action
  await opsAudit.venuesCsvExport(user.id, { rowCount: venues?.length || 0 });

  // Generate filename with date
  const today = new Date().toISOString().split("T")[0];
  const filename = `venues-export-${today}.csv`;

  // Return CSV with download headers
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
