/**
 * Overrides CSV Export API
 *
 * GET /api/admin/ops/overrides/export
 *
 * Returns occurrence overrides as a downloadable CSV file.
 * Supports optional query parameters for filtering:
 *   - event_id: UUID - filter by specific event
 *   - status: "normal" | "cancelled" - filter by override status
 *
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { serializeOverrideCsv } from "@/lib/ops/overrideCsvParser";
import { opsAudit } from "@/lib/audit/opsAudit";

export async function GET(request: NextRequest) {
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

  // Parse query parameters for filtering
  const searchParams = request.nextUrl.searchParams;
  const eventIdFilter = searchParams.get("event_id");
  const statusFilter = searchParams.get("status");

  // Fetch overrides with optional filters
  const serviceClient = createServiceRoleClient();

  let query = serviceClient
    .from("occurrence_overrides")
    .select(
      "id, event_id, date_key, status, override_start_time, override_notes, override_cover_image_url, created_at, updated_at, created_by"
    )
    .order("event_id", { ascending: true })
    .order("date_key", { ascending: true });

  // Apply filters
  if (eventIdFilter) {
    query = query.eq("event_id", eventIdFilter);
  }
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: overrides, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Serialize to CSV
  const csv = serializeOverrideCsv(overrides || []);

  // Log the export action
  await opsAudit.overridesCsvExport(user.id, {
    rowCount: overrides?.length || 0,
    filters: {
      event_id: eventIdFilter,
      status: statusFilter,
    },
  });

  // Generate filename with date
  const today = new Date().toISOString().split("T")[0];
  const filename = `overrides-export-${today}.csv`;

  // Return CSV with download headers
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
