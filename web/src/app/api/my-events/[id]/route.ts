import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdminRole, checkHostStatus } from "@/lib/auth/adminAuth";
import { sendEventUpdatedNotifications } from "@/lib/notifications/eventUpdated";
import { canonicalizeDayOfWeek, isOrdinalMonthlyRule } from "@/lib/events/recurrenceCanonicalization";
import { getTodayDenver, expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";
import { formatDateKeyForEmail } from "@/lib/events/dateKeyContract";
import { sendEventRestoredNotifications } from "@/lib/notifications/eventRestored";
import { MediaEmbedValidationError, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";
import { upsertMediaEmbeds } from "@/lib/mediaEmbedsServer";

const LEGACY_VERIFICATION_STATUSES = new Set(["needs_verification", "unverified"]);

// Helper to check if user can manage event
async function canManageEvent(supabase: SupabaseClient, userId: string, eventId: string): Promise<boolean> {
  // Check admin (using profiles.role, not app_metadata)
  const isAdmin = await checkAdminRole(supabase, userId);
  if (isAdmin) return true;

  // Check event owner (events.host_id) — the original creator
  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();

  if (event?.host_id === userId) return true;

  // Check co-host (event_hosts table)
  const { data: hostEntry } = await supabase
    .from("event_hosts")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("invitation_status", "accepted")
    .maybeSingle();

  return !!hostEntry;
}

// Visibility changes are restricted to owner/primary host/admin.
async function canEditEventVisibility(supabase: SupabaseClient, userId: string, eventId: string): Promise<boolean> {
  const isAdmin = await checkAdminRole(supabase, userId);
  if (isAdmin) return true;

  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return false;
  if (event.host_id === userId) return true;

  const { data: primaryHostEntry } = await supabase
    .from("event_hosts")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("role", "host")
    .eq("invitation_status", "accepted")
    .maybeSingle();

  return !!primaryHostEntry;
}

// GET - Get single event with full details (for editing)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Note: event_hosts.user_id references auth.users, not profiles
  // So we fetch hosts without profile join, then fetch profiles separately
  // Phase 4.x: Removed is_dsc_event filter - users should be able to edit ALL their happenings,
  // not just CSC events. Community events (is_dsc_event=false) also editable in My Happenings.
  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(id, user_id, role, invitation_status)
    `)
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Fetch profiles for all host user_ids
  const hostUserIds = (event.event_hosts as { user_id: string }[])?.map(h => h.user_id) || [];
  let hostsWithProfiles = event.event_hosts;

  if (hostUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", hostUserIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    hostsWithProfiles = (event.event_hosts as { id: string; user_id: string; role: string; invitation_status: string }[])?.map(h => ({
      ...h,
      user: profileMap.get(h.user_id) || undefined
    })) || [];
  }

  // Replace event_hosts with enriched version
  const enrichedEvent = { ...event, event_hosts: hostsWithProfiles };

  // Get RSVPs
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select(`
      *,
      user:profiles(id, full_name, avatar_url)
    `)
    .eq("event_id", eventId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ...enrichedEvent,
    rsvps: rsvps || []
  });
}

// PATCH - Update event
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check host/admin status for CSC branding permission
  const isApprovedHost = await checkHostStatus(supabase, sessionUser.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", sessionUser.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const canCreateCSC = isApprovedHost || isAdmin;

  const body = await request.json();

  if (body.visibility !== undefined) {
    if (body.visibility !== "public" && body.visibility !== "invite_only") {
      return NextResponse.json({ error: "Invalid visibility value" }, { status: 400 });
    }

    const canEditVisibility = await canEditEventVisibility(supabase, sessionUser.id, eventId);
    if (!canEditVisibility) {
      return NextResponse.json(
        { error: "Only admins or the primary host can change event privacy" },
        { status: 403 }
      );
    }
  }

  // Verification is now tracked by last_verified_at/verified_by only.
  // Normalize legacy verification statuses to active to avoid reintroducing old status semantics.
  if (LEGACY_VERIFICATION_STATUSES.has(body.status)) {
    body.status = "active";
  }

  // Validate online_url required for online/hybrid events
  if ((body.location_mode === "online" || body.location_mode === "hybrid") && !body.online_url) {
    return NextResponse.json(
      { error: "Online URL is required for online or hybrid events" },
      { status: 400 }
    );
  }

  // Phase 4.0: Handle mutual exclusivity of venue_id and custom_location_name
  const hasVenue = !!body.venue_id;
  const hasCustomLocation = !!body.custom_location_name;

  // Validate mutual exclusivity
  if (hasVenue && hasCustomLocation) {
    return NextResponse.json({ error: "Cannot have both venue_id and custom_location_name" }, { status: 400 });
  }

  // Only allow updating specific fields
  const allowedFields = [
    "title", "description", "event_type", "capacity", "host_notes",
    "day_of_week", "start_time", "event_date", "is_recurring",
    "end_time", "status", "recurrence_rule", "cover_image_url", "is_published",
    "visibility",
    // Phase 3 fields
    "timezone", "location_mode", "online_url", "is_free", "cost_label",
    "signup_mode", "signup_url", "signup_deadline", "signup_time", "age_policy",
    // Timeslot configuration fields
    "has_timeslots", "total_slots", "slot_duration_minutes",
    // External link field
    "external_url",
    // Categories (multi-select array)
    "categories",
    // Series limit (null = infinite, N = stops after N occurrences)
    "max_occurrences",
    // Custom dates (for recurrence_rule="custom" events)
    "custom_dates",
    // Media embeds (admin-only)
    "youtube_url",
    "spotify_url",
  ];

  // Non-admins may send youtube_url/spotify_url as empty strings (form always includes them).
  // Only block when actually setting a non-empty value.
  const hasNonEmptyMediaEmbed = !!(body.youtube_url?.trim?.() || body.spotify_url?.trim?.());

  if (hasNonEmptyMediaEmbed) {
    if (!isAdmin) {
      return NextResponse.json({ error: "Only admins can update media embed fields." }, { status: 403 });
    }

    try {
      body.youtube_url = normalizeMediaEmbedUrl(body.youtube_url, {
        expectedProvider: "youtube",
        field: "youtube_url",
      })?.normalized_url ?? null;
      body.spotify_url = normalizeMediaEmbedUrl(body.spotify_url, {
        expectedProvider: "spotify",
        field: "spotify_url",
      })?.normalized_url ?? null;
    } catch (error) {
      if (error instanceof MediaEmbedValidationError && error.field) {
        return NextResponse.json(
          { error: "Validation failed", fieldErrors: { [error.field]: error.message } },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };

  // Non-admins: strip media embed fields so they don't overwrite existing values
  const mediaEmbedFields = ["youtube_url", "spotify_url"];

  // Fields that should convert empty strings to null (database type constraints)
  const nullableTimeFields = ["start_time", "end_time"];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Skip media embed fields for non-admins
      if (!isAdmin && mediaEmbedFields.includes(field)) continue;
      // Convert empty strings to null for time fields (PostgreSQL time type can't accept "")
      if (nullableTimeFields.includes(field) && body[field] === "") {
        updates[field] = null;
      } else {
        updates[field] = body[field];
      }
    }
  }

  // Validate and canonicalize custom_dates when provided
  if (body.custom_dates !== undefined) {
    if (body.custom_dates === null) {
      // Clearing custom_dates (switching away from custom mode)
      updates.custom_dates = null;
    } else if (!Array.isArray(body.custom_dates)) {
      return NextResponse.json({ error: "custom_dates must be an array" }, { status: 400 });
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const validDates = (body.custom_dates as string[])
        .filter((d: string) => typeof d === "string" && dateRegex.test(d));
      // Dedupe and sort
      const uniqueDates = [...new Set(validDates)].sort();
      if (uniqueDates.length === 0) {
        return NextResponse.json({ error: "At least one valid date is required for custom series" }, { status: 400 });
      }
      updates.custom_dates = uniqueDates;
      updates.recurrence_rule = "custom";
      updates.day_of_week = null;
      updates.event_date = uniqueDates[0]; // Anchor = first date
    }
  }

  // Phase 4.0: Handle location selection changes with invariant enforcement
  if (hasVenue) {
    // Venue selection path: set venue, clear all custom location fields
    updates.venue_id = body.venue_id;
    updates.custom_location_name = null;
    updates.custom_address = null;
    updates.custom_city = null;
    updates.custom_state = null;
    updates.custom_latitude = null;
    updates.custom_longitude = null;
    updates.location_notes = null;

    // Lookup venue info
    const { data: venue } = await supabase
      .from("venues")
      .select("name, address, city, state")
      .eq("id", body.venue_id)
      .single();

    if (venue) {
      updates.venue_name = venue.name;
      const addressParts = [venue.address, venue.city, venue.state].filter(Boolean);
      updates.venue_address = addressParts.length > 0 ? addressParts.join(", ") : null;
    }
  } else if (hasCustomLocation) {
    // Custom location path: clear venue, set custom fields
    updates.venue_id = null;
    updates.venue_name = null;
    updates.venue_address = null;
    updates.custom_location_name = body.custom_location_name;
    updates.custom_address = body.custom_address || null;
    updates.custom_city = body.custom_city || null;
    updates.custom_state = body.custom_state || null;
    updates.custom_latitude = body.custom_latitude || null;
    updates.custom_longitude = body.custom_longitude || null;
    updates.location_notes = body.location_notes || null;
  } else if (body.venue_id === null) {
    // Explicit venue clearing without custom location (for online-only events)
    updates.venue_id = null;
    updates.venue_name = null;
    updates.venue_address = null;
  }

  // Handle location_notes updates even when not changing location mode
  if (body.location_notes !== undefined && !hasCustomLocation) {
    updates.location_notes = body.location_notes || null;
  }

  // Handle admin verification inline (avoids separate bulk-verify call)
  if (body.verify_action !== undefined && isAdmin) {
    if (body.verify_action === "verify") {
      updates.last_verified_at = now;
      updates.verified_by = sessionUser.id;
    } else if (body.verify_action === "unverify") {
      updates.last_verified_at = null;
      updates.verified_by = null;
    }
  }

  // Handle is_dsc_event separately - only allow if canCreateCSC
  if (body.is_dsc_event !== undefined) {
    if (body.is_dsc_event === true && !canCreateCSC) {
      return NextResponse.json(
        { error: "Only approved hosts and admins can create CSC events" },
        { status: 403 }
      );
    }
    updates.is_dsc_event = body.is_dsc_event;
  }

  // Handle allow_guests → allow_guest_slots mapping (form sends allow_guests, DB uses allow_guest_slots)
  if (body.allow_guests !== undefined) {
    updates.allow_guest_slots = body.allow_guests;
  }

  // Track major updates (date/time/venue/location_mode changes)
  const majorFields = ["event_date", "start_time", "end_time", "venue_id", "location_mode", "day_of_week"];
  const hasMajorChange = majorFields.some(field => body[field] !== undefined);
  if (hasMajorChange) {
    updates.last_major_update_at = now;
  }

  // Track cancellation with timestamp and reason
  if (body.status === "cancelled") {
    updates.cancelled_at = now;
    if (body.cancel_reason) {
      updates.cancel_reason = body.cancel_reason;
    }
  }

  // Track restoration (uncancelling an event)
  const isRestoreAction = body.restore === true;

  // Handle restore action - change status from cancelled to active
  if (isRestoreAction) {
    updates.status = "active";
    updates.cancelled_at = null;
    updates.cancel_reason = null;
  }

  // Get current event state before update (for first publish check, timeslot regeneration, and notifications)
  const { data: prevEvent } = await supabase
    .from("events")
    .select(`
      is_published, published_at, status,
      has_timeslots, total_slots, slot_duration_minutes,
      event_date, start_time, end_time, venue_id, location_mode, day_of_week,
      title, venue_name, venue_address, slug,
      recurrence_rule, max_occurrences, custom_dates
    `)
    .eq("id", eventId)
    .single();

  // Phase 4.83: Canonicalize day_of_week for ordinal monthly rules
  // If recurrence_rule is ordinal monthly and day_of_week is missing, derive from anchor date
  const effectiveRecurrenceRule = (updates.recurrence_rule as string | null) ?? prevEvent?.recurrence_rule ?? null;
  const effectiveEventDate = (updates.event_date as string | null) ?? prevEvent?.event_date ?? null;
  const effectiveDayOfWeek = (updates.day_of_week as string | null) ?? prevEvent?.day_of_week ?? null;

  if (isOrdinalMonthlyRule(effectiveRecurrenceRule) && !effectiveDayOfWeek) {
    const derivedDayOfWeek = canonicalizeDayOfWeek(effectiveRecurrenceRule, null, effectiveEventDate);
    if (derivedDayOfWeek) {
      updates.day_of_week = derivedDayOfWeek;
    }
  }

  // Auto-verification on publish: When an event transitions from unpublished to published,
  // set last_verified_at to auto-confirm. This happens both on first publish and republish.
  const wasPublished = prevEvent?.is_published === true;
  const willBePublished = body.is_published === true;
  const isPublishTransition = !wasPublished && willBePublished;

  // Skip auto-confirm when explicit verify_action is present (admin intent takes precedence)
  if (isPublishTransition && body.verify_action === undefined) {
    updates.last_verified_at = now;
    updates.published_at = now;
  }

  // Alias for backward compat with timeslot logic
  const currentEvent = prevEvent;

  // Determine if this update requires timeslot regeneration
  const timeslotsNowEnabled = body.has_timeslots !== undefined
    ? body.has_timeslots === true
    : currentEvent?.has_timeslots === true;
  const timeslotsWereDisabled = currentEvent?.has_timeslots === false;
  const totalSlotsChanged = body.total_slots !== undefined && body.total_slots !== currentEvent?.total_slots;
  const slotDurationChanged = body.slot_duration_minutes !== undefined && body.slot_duration_minutes !== currentEvent?.slot_duration_minutes;
  const eventDateChanged = updates.event_date !== undefined && updates.event_date !== currentEvent?.event_date;
  const dayOfWeekChanged = updates.day_of_week !== undefined && updates.day_of_week !== currentEvent?.day_of_week;
  const recurrenceRuleChanged = updates.recurrence_rule !== undefined && updates.recurrence_rule !== currentEvent?.recurrence_rule;
  const maxOccurrencesChanged = updates.max_occurrences !== undefined && updates.max_occurrences !== currentEvent?.max_occurrences;
  const customDatesChanged = updates.custom_dates !== undefined && (() => {
    const nextCustomDates = Array.isArray(updates.custom_dates) ? updates.custom_dates as string[] : null;
    const prevCustomDates = Array.isArray(currentEvent?.custom_dates) ? currentEvent.custom_dates : null;
    if (!nextCustomDates && !prevCustomDates) return false;
    if (!nextCustomDates || !prevCustomDates) return true;
    if (nextCustomDates.length !== prevCustomDates.length) return true;
    return nextCustomDates.some((dateKey, index) => dateKey !== prevCustomDates[index]);
  })();

  const scheduleChanged = eventDateChanged
    || dayOfWeekChanged
    || recurrenceRuleChanged
    || maxOccurrencesChanged
    || customDatesChanged;

  const regenNeeded = timeslotsNowEnabled
    && (timeslotsWereDisabled || totalSlotsChanged || slotDurationChanged || scheduleChanged);

  // Phase 5.02: If regen needed, check for FUTURE claims only (past claims don't block)
  // The blocking logic uses date_key >= todayKey to allow hosts to modify slot config
  // even when past occurrences have claims.
  if (regenNeeded) {
    const todayKey = getTodayDenver();

    // Query only FUTURE timeslots (today counts as future, >= not >)
    const { data: futureSlots } = await supabase
      .from("event_timeslots")
      .select("id, date_key")
      .eq("event_id", eventId)
      .gte("date_key", todayKey);

    if (futureSlots && futureSlots.length > 0) {
      const futureSlotIds = futureSlots.map(s => s.id);
      const { count: futureClaimCount } = await supabase
        .from("timeslot_claims")
        .select("*", { count: "exact", head: true })
        .in("timeslot_id", futureSlotIds)
        .in("status", ["confirmed", "performed", "waitlist"]);

      if (futureClaimCount && futureClaimCount > 0) {
        // Has FUTURE claims - reject the entire update with actionable error
        // Phase 5.12: Link directly to performer signups section with anchor
        return NextResponse.json(
          {
            error: "Can't change slot configuration while future signups exist.",
            details: `${futureClaimCount} active signup(s) on upcoming dates. Remove them first or wait until those dates pass.`,
            futureClaimCount,
            actionUrl: `/dashboard/my-events/${eventId}#performer-signups`
          },
          { status: 409 }
        );
      }
    }
  }

  // Now safe to apply the update
  const { data: event, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Upsert multi-embed media URLs (non-fatal on error)
  if (Array.isArray(body.media_embed_urls)) {
    try {
      await upsertMediaEmbeds(
        supabase,
        { type: "event", id: eventId },
        body.media_embed_urls as string[],
        sessionUser.id
      );
    } catch (err) {
      console.error(`[PATCH /api/my-events/${eventId}] Media embed upsert error:`, err);
    }
  }

  // Phase 5.02: Regenerate FUTURE timeslots only (preserve past slots with historical data)
  // We already verified no FUTURE claims exist in the blocking check above.
  if (regenNeeded) {
    const todayKey = getTodayDenver();
    const newTotalSlots = body.total_slots ?? event.total_slots ?? 10;
    const newSlotDuration = body.slot_duration_minutes ?? event.slot_duration_minutes ?? 15;

    // 1. Delete ONLY future timeslots (past slots preserved)
    const { error: deleteError } = await supabase
      .from("event_timeslots")
      .delete()
      .eq("event_id", eventId)
      .gte("date_key", todayKey);

    if (deleteError) {
      console.error(`[PATCH /api/my-events/${eventId}] Failed to delete future timeslots:`, deleteError.message);
    }

    // 2. Expand future occurrences and generate new slots
    const occurrences = expandOccurrencesForEvent({
      event_date: event.event_date,
      day_of_week: event.day_of_week ?? updates.day_of_week as string | null,
      recurrence_rule: event.recurrence_rule ?? updates.recurrence_rule as string | null,
      custom_dates: event.custom_dates ?? updates.custom_dates as string[] | null,
      max_occurrences: event.max_occurrences ?? updates.max_occurrences as number | null,
    });

    // Filter to only future dates
    const futureDates = occurrences
      .filter(occ => occ.dateKey >= todayKey)
      .map(occ => occ.dateKey);

    // 3. Generate slots for each future date
    let slotsCreated = 0;
    for (const dateKey of futureDates) {
      const slots = [];
      for (let i = 0; i < newTotalSlots; i++) {
        const offset = event.start_time
          ? i * newSlotDuration
          : null;

        slots.push({
          event_id: eventId,
          slot_index: i,
          start_offset_minutes: offset,
          duration_minutes: newSlotDuration,
          date_key: dateKey,
        });
      }

      const { error: insertError } = await supabase.from("event_timeslots").insert(slots);
      if (insertError) {
        console.error(`[PATCH /api/my-events/${eventId}] Failed to insert slots for ${dateKey}:`, insertError.message);
      } else {
        slotsCreated += slots.length;
      }
    }

    console.log(`[PATCH /api/my-events/${eventId}] Future timeslots regenerated: ${slotsCreated} slots across ${futureDates.length} dates`);
  }

  // Send restore notifications if event was uncancelled
  const wasRestored = isRestoreAction && prevEvent?.status === "cancelled";
  if (wasRestored && prevEvent) {
    // Fire-and-forget - don't block the response
    sendEventRestoredNotifications(supabase, {
      eventId,
      eventSlug: prevEvent.slug,
      eventTitle: prevEvent.title || "Event",
      eventDate: prevEvent.event_date ? formatDateKeyForEmail(prevEvent.event_date) : (prevEvent.day_of_week || ""),
      eventTime: prevEvent.start_time || undefined,
      venueName: prevEvent.venue_name || "TBD",
    }).catch((err) => {
      console.error(`[PATCH /api/my-events/${eventId}] Failed to send restore notifications:`, err);
    });
  }

  // Phase 4.36: Send event updated notifications if major fields changed
  // Skip if: event becoming cancelled (handled by DELETE handler)
  // All events are always published now, so we just check for major changes on active events
  const statusBecomingCancelled = body.status === "cancelled" && prevEvent?.status !== "cancelled";
  const shouldNotifyUpdate = hasMajorChange && prevEvent?.is_published && !statusBecomingCancelled;

  if (shouldNotifyUpdate && prevEvent) {
    // Build changes object comparing prev to new values
    const changes: {
      date?: { old: string; new: string };
      time?: { old: string; new: string };
      venue?: { old: string; new: string };
      address?: { old: string; new: string };
    } = {};

    // Only include fields that actually changed
    if (body.event_date !== undefined && body.event_date !== prevEvent.event_date) {
      changes.date = {
        old: prevEvent.event_date || "TBD",
        new: body.event_date || "TBD"
      };
    }

    if (body.start_time !== undefined && body.start_time !== prevEvent.start_time) {
      changes.time = {
        old: prevEvent.start_time || "TBD",
        new: body.start_time || "TBD"
      };
    }

    if (body.day_of_week !== undefined && body.day_of_week !== prevEvent.day_of_week) {
      // Treat day change as a date change
      changes.date = {
        old: prevEvent.day_of_week || prevEvent.event_date || "TBD",
        new: body.day_of_week || body.event_date || "TBD"
      };
    }

    // Venue change - use venue_name for display
    const prevVenueName = prevEvent.venue_name || "TBD";
    const newVenueName = (updates.venue_name as string) || prevVenueName;
    if (body.venue_id !== undefined && body.venue_id !== prevEvent.venue_id) {
      changes.venue = {
        old: prevVenueName,
        new: newVenueName
      };
    }

    // Only notify if there are actual visible changes
    if (Object.keys(changes).length > 0) {
      // Fire-and-forget - don't block the response
      const effectiveEventDate = body.event_date || prevEvent.event_date;
      sendEventUpdatedNotifications(supabase, {
        eventId,
        eventSlug: prevEvent.slug,
        eventTitle: prevEvent.title || "Event",
        changes,
        eventDate: effectiveEventDate ? formatDateKeyForEmail(effectiveEventDate) : (body.day_of_week || prevEvent.day_of_week || ""),
        eventTime: body.start_time || prevEvent.start_time || "",
        venueName: newVenueName,
        venueAddress: (updates.venue_address as string) || prevEvent.venue_address || undefined
      }).catch((err) => {
        console.error(`[PATCH /api/my-events/${eventId}] Failed to send update notifications:`, err);
      });
    }
  }

  return NextResponse.json(event);
}

// DELETE - Cancel/hide event (soft delete) OR hard delete drafts
//
// Phase 4.42l: Users can hard delete their own draft events.
// - Drafts (is_published=false) with no RSVPs/claims: hard delete allowed
// - Published events: soft delete (cancel) only
// - Pass ?hard=true query param to request hard delete
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if hard delete requested via query param
  const url = new URL(request.url);
  const hardDelete = url.searchParams.get("hard") === "true";

  // Get event details including publish status
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, is_published, host_id")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Phase 4.42l: Hard delete for drafts only
  // Note: RSVPs/claims guardrails removed - users were already notified when event was cancelled
  if (hardDelete) {
    // Only allow hard delete for unpublished (draft) events
    if (event.is_published) {
      return NextResponse.json(
        { error: "Cannot delete published events. Cancel them instead." },
        { status: 400 }
      );
    }

    // Hard delete - database cascades will handle RSVPs, timeslots, claims, etc.
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (deleteError) {
      console.error(`[DELETE /api/my-events/${eventId}] Hard delete error:`, deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: true });
  }

  // Soft delete (cancel) - existing behavior for published events
  const { data: rsvpUsers } = await supabase
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .in("status", ["confirmed", "waitlist"]);

  // Parse optional cancel_reason from request body
  let cancelReason: string | null = null;
  try {
    const body = await request.json();
    cancelReason = body.cancel_reason || null;
  } catch {
    // No body provided, that's fine
  }

  const now = new Date().toISOString();

  // Soft delete - set status to cancelled with timestamp
  const { error } = await supabase
    .from("events")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: cancelReason,
      updated_at: now
    })
    .eq("id", eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify all RSVPed users that the event was cancelled
  if (rsvpUsers && rsvpUsers.length > 0 && event?.title) {
    const notificationResults = await Promise.allSettled(
      rsvpUsers.map((rsvp) =>
        supabase.rpc("create_user_notification", {
          p_user_id: rsvp.user_id,
          p_type: "event_cancelled",
          p_title: "Event Cancelled",
          p_message: `"${event.title}" has been cancelled by the host.`,
          p_link: null
        })
      )
    );

    // Log any notification failures without failing the request
    const failures = notificationResults.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`Failed to send ${failures.length} event cancellation notifications`);
    }
  }

  return NextResponse.json({ success: true });
}
