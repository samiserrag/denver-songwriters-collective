import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { getTodayDenver } from "@/lib/events/nextOccurrence";
import { upsertMediaEmbeds } from "@/lib/mediaEmbedsServer";
import { formatDateKeyForEmail } from "@/lib/events/dateKeyContract";
import { sendEventUpdatedNotifications } from "@/lib/notifications/eventUpdated";
import { sendOccurrenceCancelledNotifications } from "@/lib/notifications/occurrenceCancelled";

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

function formatTimeForEmail(timeValue: string | null | undefined): string {
  if (!timeValue) return "TBD";
  const [rawHours, rawMinutes] = timeValue.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeValue;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function normalizeForCompare(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

function valuesChanged(before: unknown, after: unknown): boolean {
  return normalizeForCompare(before) !== normalizeForCompare(after);
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
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();
  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { authorized } = await checkOverrideAuth(supabase, eventId, sessionUser.id);
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
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();
  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { authorized } = await checkOverrideAuth(supabase, eventId, sessionUser.id);
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

  const { data: baseEvent } = await supabase
    .from("events")
    .select("id, slug, title, is_published, start_time, venue_name, venue_address")
    .eq("id", eventId)
    .single();

  const { data: existingOverride } = await supabase
    .from("occurrence_overrides")
    .select("*")
    .eq("event_id", eventId)
    .eq("date_key", date_key)
    .maybeSingle();

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

  let action: "reverted" | "upserted" = "upserted";

  if (isEmptyOverride) {
    const { error: deleteError } = await supabase
      .from("occurrence_overrides")
      .delete()
      .eq("event_id", eventId)
      .eq("date_key", date_key);

    if (deleteError) {
      console.error("[Overrides POST] Delete error:", deleteError);
      return NextResponse.json({ error: "Failed to revert override" }, { status: 500 });
    }
    action = "reverted";
  } else {
    const { error } = await supabase
      .from("occurrence_overrides")
      .upsert(upsertPayload, { onConflict: "event_id,date_key" });

    if (error) {
      console.error("[Overrides POST] Upsert error:", error);
      return NextResponse.json({ error: "Failed to save override" }, { status: 500 });
    }

    // Upsert override-scoped media embeds (non-fatal on error)
    if (Array.isArray(body.media_embed_urls)) {
      try {
        await upsertMediaEmbeds(
          supabase,
          { type: "event_override", id: eventId, date_key },
          body.media_embed_urls as string[],
          sessionUser.id
        );
      } catch (err) {
        console.error(`[Overrides POST] Media embed upsert error for ${date_key}:`, err);
      }
    }
  }

  const { data: currentOverride } = await supabase
    .from("occurrence_overrides")
    .select("*")
    .eq("event_id", eventId)
    .eq("date_key", date_key)
    .maybeSingle();

  // Notify signed-up attendees on occurrence-level host edits.
  // - cancelled transition => occurrence cancellation notification
  // - modified/reverted changes => standard event update notification (date_key scoped)
  if (baseEvent?.is_published) {
    const previousStatus = existingOverride?.status ?? "normal";
    const nextStatus = currentOverride?.status ?? "normal";

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", sessionUser.id)
      .maybeSingle();

    if (previousStatus !== "cancelled" && nextStatus === "cancelled") {
      sendOccurrenceCancelledNotifications(supabase, {
        eventId,
        eventSlug: baseEvent.slug,
        eventTitle: baseEvent.title,
        dateKey: date_key,
        occurrenceDateLabel: formatDateKeyForEmail(date_key),
        venueName: baseEvent.venue_name || "TBD",
        reason: typeof override_notes === "string" ? override_notes : null,
        hostName: actorProfile?.full_name ?? null,
      }).catch((err) => {
        console.error(`[Overrides POST] Failed to send occurrence cancellation notifications for ${date_key}:`, err);
      });
    } else {
      const beforePatch = (existingOverride as { override_patch?: Record<string, unknown> | null } | null)?.override_patch || {};
      const afterPatch = (currentOverride as { override_patch?: Record<string, unknown> | null } | null)?.override_patch || {};

      const beforeDate = typeof beforePatch.event_date === "string" ? beforePatch.event_date : date_key;
      const afterDate = typeof afterPatch.event_date === "string" ? afterPatch.event_date : date_key;

      const beforeStartTime =
        (typeof beforePatch.start_time === "string" ? beforePatch.start_time : null)
        || existingOverride?.override_start_time
        || baseEvent.start_time;
      const afterStartTime =
        (typeof afterPatch.start_time === "string" ? afterPatch.start_time : null)
        || currentOverride?.override_start_time
        || baseEvent.start_time;

      const beforeVenueName =
        (typeof beforePatch.custom_location_name === "string" ? beforePatch.custom_location_name : null)
        || baseEvent.venue_name;
      const afterVenueName =
        (typeof afterPatch.custom_location_name === "string" ? afterPatch.custom_location_name : null)
        || baseEvent.venue_name;

      const beforeAddress = beforePatch.custom_address || baseEvent.venue_address;
      const afterAddress = afterPatch.custom_address || baseEvent.venue_address;

      const changes: {
        date?: { old: string; new: string };
        time?: { old: string; new: string };
        venue?: { old: string; new: string };
        address?: { old: string; new: string };
        details?: string[];
      } = {};

      if (valuesChanged(beforeDate, afterDate)) {
        changes.date = {
          old: formatDateKeyForEmail(beforeDate),
          new: formatDateKeyForEmail(afterDate),
        };
      }

      if (valuesChanged(beforeStartTime, afterStartTime)) {
        changes.time = {
          old: formatTimeForEmail(beforeStartTime),
          new: formatTimeForEmail(afterStartTime),
        };
      }

      if (valuesChanged(beforeVenueName, afterVenueName)) {
        changes.venue = {
          old: String(beforeVenueName || "TBD"),
          new: String(afterVenueName || "TBD"),
        };
      }

      if (valuesChanged(beforeAddress, afterAddress)) {
        changes.address = {
          old: String(beforeAddress || "TBD"),
          new: String(afterAddress || "TBD"),
        };
      }

      const detailLabels: Record<string, string> = {
        title: "Title",
        description: "Description",
        end_time: "End time",
        capacity: "Capacity",
        cost_label: "Cost",
        is_free: "Cost",
        signup_url: "Signup link",
        signup_time: "Signup time",
        age_policy: "Age policy",
        host_notes: "Host notes",
        location_notes: "Location notes",
        external_url: "External link",
        categories: "Categories",
        cover_image_url: "Cover image",
      };

      const detailChanges: string[] = [];
      const keysToCheck = new Set<string>([
        ...Object.keys(beforePatch),
        ...Object.keys(afterPatch),
      ]);

      for (const key of keysToCheck) {
        const label = detailLabels[key];
        if (!label) continue;
        if (["event_date", "start_time", "custom_location_name", "custom_address"].includes(key)) continue;
        if (valuesChanged(beforePatch[key], afterPatch[key])) {
          detailChanges.push(label);
        }
      }

      if (valuesChanged(existingOverride?.override_notes, currentOverride?.override_notes)) {
        detailChanges.push("Host notes");
      }

      if (detailChanges.length > 0) {
        changes.details = [...new Set(detailChanges)];
      }

      const hasMeaningfulChange = !!(
        changes.date
        || changes.time
        || changes.venue
        || changes.address
        || (changes.details && changes.details.length > 0)
      );

      if (hasMeaningfulChange) {
        sendEventUpdatedNotifications(supabase, {
          eventId,
          eventSlug: baseEvent.slug,
          dateKey: date_key,
          eventTitle: baseEvent.title,
          changes,
          eventDate: formatDateKeyForEmail(afterDate),
          eventTime: formatTimeForEmail(afterStartTime),
          venueName: String(afterVenueName || "TBD"),
          venueAddress: afterAddress ? String(afterAddress) : undefined,
        }).catch((err) => {
          console.error(`[Overrides POST] Failed to send occurrence update notifications for ${date_key}:`, err);
        });
      }
    }
  }

  return NextResponse.json({ success: true, action });
}

// ─── DELETE: Revert override (remove row entirely) ──────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();
  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { authorized } = await checkOverrideAuth(supabase, eventId, sessionUser.id);
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
