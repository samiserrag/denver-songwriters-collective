/**
 * Events Bulk Verify/Unverify API
 *
 * POST /api/admin/ops/events/bulk-verify
 *
 * Bulk verify or unverify events by setting last_verified_at and verified_by.
 * Admin-only endpoint.
 *
 * Request body:
 *   - eventIds: string[] - UUIDs of events to update
 *   - action: "verify" | "unverify"
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { opsAudit } from "@/lib/audit/opsAudit";

export async function POST(request: NextRequest) {
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

  // Parse request body
  let eventIds: string[];
  let action: "verify" | "unverify";
  try {
    const body = await request.json();
    eventIds = body.eventIds;
    action = body.action;

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { error: "eventIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (action !== "verify" && action !== "unverify") {
      return NextResponse.json(
        { error: "action must be 'verify' or 'unverify'" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  // Apply bulk update
  const serviceClient = createServiceRoleClient();

  const updatePayload =
    action === "verify"
      ? {
          last_verified_at: new Date().toISOString(),
          verified_by: user.id,
        }
      : {
          last_verified_at: null,
          verified_by: null,
        };

  const { data, error } = await serviceClient
    .from("events")
    .update(updatePayload)
    .in("id", eventIds)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 }
    );
  }

  const updatedCount = data?.length || 0;

  // Log the action
  if (action === "verify") {
    await opsAudit.eventsBulkVerify(user.id, {
      updatedCount,
      eventIds,
    });
  } else {
    await opsAudit.eventsBulkUnverify(user.id, {
      updatedCount,
      eventIds,
    });
  }

  return NextResponse.json({
    success: true,
    action,
    updated: updatedCount,
  });
}
