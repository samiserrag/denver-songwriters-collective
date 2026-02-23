/**
 * Events CSV Export API
 *
 * GET /api/admin/ops/events/export
 *
 * Returns events as a downloadable CSV file.
 * Supports optional query parameters for filtering:
 *   - status: "active" | "draft" | "cancelled"
 *   - event_type: database event_type enum value
 *   - venue_id: UUID
 *   - is_recurring: "true" | "false"
 *
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { serializeEventCsv } from "@/lib/ops/eventCsvParser";
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
  const statusFilter = searchParams.get("status");
  const eventTypeFilter = searchParams.get("event_type");
  const venueIdFilter = searchParams.get("venue_id");
  const isRecurringFilter = searchParams.get("is_recurring");

  // Fetch events with optional filters
  const serviceClient = createServiceRoleClient();

  let query = serviceClient
    .from("events")
    .select(
      "id, title, event_type, status, is_recurring, event_date, day_of_week, start_time, end_time, venue_id, is_published, host_notes"
    )
    .order("title", { ascending: true });

  // Apply filters
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (eventTypeFilter) {
    query = query.contains("event_type", [eventTypeFilter]);
  }
  if (venueIdFilter) {
    query = query.eq("venue_id", venueIdFilter);
  }
  if (isRecurringFilter !== null) {
    if (isRecurringFilter === "true") {
      query = query.eq("is_recurring", true);
    } else if (isRecurringFilter === "false") {
      query = query.or("is_recurring.eq.false,is_recurring.is.null");
    }
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Serialize to CSV
  const csv = serializeEventCsv(events || []);

  // Log the export action
  await opsAudit.eventsCsvExport(user.id, {
    rowCount: events?.length || 0,
    filters: {
      status: statusFilter,
      event_type: eventTypeFilter,
      venue_id: venueIdFilter,
      is_recurring: isRecurringFilter,
    },
  });

  // Generate filename with date
  const today = new Date().toISOString().split("T")[0];
  const filename = `events-export-${today}.csv`;

  // Return CSV with download headers
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
