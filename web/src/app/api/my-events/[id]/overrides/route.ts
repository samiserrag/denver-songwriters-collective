import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { getTodayDenver } from "@/lib/events/nextOccurrence";

/**
 * Occurrence Override API — Per-occurrence field overrides for recurring events.
 *
 * Auth: Host (event_hosts accepted) OR event owner (host_id) OR admin.
 * Same authorization pattern as /dashboard/my-events/[id] edit page.
 *
 * GET  — List overrides for an event within a date range
 * POST — Upsert override for a specific date_key (override_patch + legacy columns)
 * DELETE — Revert override (delete the row entirely)
 */

// Allowlist of fields that can be overridden per-occurrence.
// Series-level fields (event_type, recurrence_rule, etc.) are BLOCKED.
const ALLOWED_OVERRIDE_FIELDS = new Set([
  "title",
  "description",
  "event_date",
  "start_time",
  "end_time",
  "venue_id",
  "location_mode",
  "custom_location_name",
  "custom_address",
  "custom_city",
  "custom_state",
  "online_url",
  "location_notes",
  "capacity",
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
  "is_free",
  "cost_label",
  "signup_url",
  "signup_deadline",
  "signup_time", // Phase 5.10: Per-occurrence signup time override
  "age_policy",
  "external_url",
  "categories",
  "cover_image_url",
  "host_notes",
  "is_published",
]);

/**
 * Sanitize override_patch: only keep keys in the allowlist.
 */
function sanitizeOverridePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    if (ALLOWED_OVERRIDE_FIELDS.has(key)) {
      sanitized[key] = patch[key];
    }
  }
  return sanitized;
}

/**
 * Check if user is authorized to manage overrides for this event.
 * Returns { authorized, isAdmin } or null on error.
 */
async function checkOverrideAuth(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  userId: string
): Promise<{ authorized: boolean; isAdmin: boolean }> {
  const isAdmin = await checkAdminRole(supabase, userId);

  if (isAdmin) return { authorized: true, isAdmin: true };

  // Check event ownership (host_id) or event_hosts membership
  const { data: event } = await supabase
    .from("events")
    .select("host_id, event_hosts(user_id, invitation_status)")
    .eq("id", eventId)
    .single();

  if (!event) return { authorized: false, isAdmin: false };

  // Is event owner?
  if (event.host_id === userId) return { authorized: true, isAdmin: false };

  // Is accepted host?
  const hosts = event.event_hosts as Array<{ user_id: string; invitation_status: string }> | null;
  const isAcceptedHost = hosts?.some(
    (h) => h.user_id === userId && h.invitation_status === "accepted"
  );

  return { authorized: !!isAcceptedHost, isAdmin: false };
}

// ─── GET: List overrides for event in date range ────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { authorized } = await checkOverrideAuth(supabase, eventId, session.user.id);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const startKey = searchParams.get("startKey");
  const endKey = searchParams.get("endKey");

  // Build query
  let query = supabase
    .from("occurrence_overrides")
    .select("*")
    .eq("event_id", eventId)
    .order("date_key", { ascending: true });

  if (startKey) query = query.gte("date_key", startKey);
  if (endKey) query = query.lte("date_key", endKey);

  const { data: overrides, error } = await query;

  if (error) {
    console.error("[Overrides GET] Query error:", error);
    return NextResponse.json({ error: "Failed to fetch overrides" }, { status: 500 });
  }

  return NextResponse.json({ overrides: overrides || [] });
}

// ─── POST: Upsert override for a specific date_key ─────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { authorized } = await checkOverrideAuth(supabase, eventId, session.user.id);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { date_key, status, override_start_time, override_cover_image_url, override_notes, override_patch } = body;

  if (!date_key || typeof date_key !== "string") {
    return NextResponse.json({ error: "date_key is required" }, { status: 400 });
  }

  // Validate date_key format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_key)) {
    return NextResponse.json({ error: "date_key must be YYYY-MM-DD format" }, { status: 400 });
  }

  // Build upsert payload
  const upsertPayload: Record<string, unknown> = {
    event_id: eventId,
    date_key,
  };

  // Legacy columns (backward compatible)
  if (status !== undefined) {
    if (status !== "normal" && status !== "cancelled") {
      return NextResponse.json({ error: "status must be 'normal' or 'cancelled'" }, { status: 400 });
    }
    upsertPayload.status = status;
  }

  if (override_start_time !== undefined) {
    upsertPayload.override_start_time = override_start_time || null;
  }
  if (override_cover_image_url !== undefined) {
    upsertPayload.override_cover_image_url = override_cover_image_url || null;
  }
  if (override_notes !== undefined) {
    upsertPayload.override_notes = override_notes || null;
  }

  // New JSONB patch column — sanitize against allowlist
  if (override_patch !== undefined && override_patch !== null) {
    if (typeof override_patch !== "object" || Array.isArray(override_patch)) {
      return NextResponse.json({ error: "override_patch must be a JSON object" }, { status: 400 });
    }
    const sanitized = sanitizeOverridePatch(override_patch as Record<string, unknown>);

    // Validate event_date if present (rescheduling)
    if (sanitized.event_date !== undefined) {
      const newDate = sanitized.event_date as string;
      if (typeof newDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        return NextResponse.json({ error: "Invalid date format for event_date" }, { status: 400 });
      }
      // Strip if same as date_key (not a reschedule)
      if (newDate === date_key) {
        delete sanitized.event_date;
      } else {
        // Reject past dates
        const today = getTodayDenver();
        if (newDate < today) {
          return NextResponse.json({ error: "Cannot reschedule to a past date" }, { status: 400 });
        }
      }
    }

    // Only store if there are actual allowed keys
    upsertPayload.override_patch = Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  // If everything is "empty" (normal status, no overrides, no patch), delete instead
  const isEmptyOverride =
    (upsertPayload.status === "normal" || upsertPayload.status === undefined) &&
    !upsertPayload.override_start_time &&
    !upsertPayload.override_cover_image_url &&
    !upsertPayload.override_notes &&
    !upsertPayload.override_patch;

  if (isEmptyOverride) {
    // Delete existing override if any
    await supabase
      .from("occurrence_overrides")
      .delete()
      .eq("event_id", eventId)
      .eq("date_key", date_key);

    return NextResponse.json({ success: true, action: "reverted" });
  }

  const { error } = await supabase
    .from("occurrence_overrides")
    .upsert(upsertPayload, { onConflict: "event_id,date_key" });

  if (error) {
    console.error("[Overrides POST] Upsert error:", error);
    return NextResponse.json({ error: "Failed to save override" }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: "upserted" });
}

// ─── DELETE: Revert override (remove row entirely) ──────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { authorized } = await checkOverrideAuth(supabase, eventId, session.user.id);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { date_key } = body;

  if (!date_key || typeof date_key !== "string") {
    return NextResponse.json({ error: "date_key is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("occurrence_overrides")
    .delete()
    .eq("event_id", eventId)
    .eq("date_key", date_key);

  if (error) {
    console.error("[Overrides DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete override" }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: "reverted" });
}
