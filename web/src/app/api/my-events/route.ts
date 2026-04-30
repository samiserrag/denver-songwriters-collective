import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkHostStatus } from "@/lib/auth/adminAuth";
import { canonicalizeDayOfWeek } from "@/lib/events/recurrenceCanonicalization";
import { getTodayDenver, expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";
import { getInvalidEventTypes, normalizeIncomingEventTypes } from "@/lib/events/eventTypeContract";
import { normalizeSignupMode } from "@/lib/events/signupModeContract";
import { MediaEmbedValidationError, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";
import { upsertMediaEmbeds } from "@/lib/mediaEmbedsServer";
import { sendAdminEventAlert } from "@/lib/email/adminEventAlerts";
import { processVenueGeocodingWithStatus } from "@/lib/venue/geocoding";
import { Database } from "@/lib/supabase/database.types";
import { warmEventSharePreview } from "@/lib/events/sharePreview";
import { normalizeDraftRecurrenceFields } from "@/lib/events/recurrenceDraftTools";
import { applyVenueTypeTitleDefault } from "@/lib/events/interpreterPostprocess";
import { resolveVenue, type VenueCatalogEntry } from "@/lib/events/venueResolver";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function normalizeLocationMode(value: unknown): "venue" | "online" | "hybrid" {
  if (typeof value !== "string") return "venue";
  const mode = value.trim().toLowerCase();
  if (mode === "venue" || mode === "in_person" || mode === "in-person" || mode === "custom") {
    return "venue";
  }
  if (mode === "online" || mode === "virtual") return "online";
  if (mode === "hybrid") return "hybrid";
  return "venue";
}

type VenuePromotionCandidate = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
};

type VenueCandidateMatchResult =
  | { kind: "strong_match"; venue: VenuePromotionCandidate }
  | { kind: "ambiguous"; candidates: VenuePromotionCandidate[] }
  | { kind: "no_match" };

type ExistingVenueResolution = { id: string; name: string } | null;

function normalizeMatchToken(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

/**
 * Strong match policy for conversational venue auto-promotion:
 * - exact address unique match, OR
 * - unique name+city+state match.
 *
 * Any multi-candidate unresolved result is treated as ambiguous and must not
 * auto-promote or auto-create canonical venues in the same request.
 */
function classifyVenueCandidatesForPromotion(input: {
  candidates: VenuePromotionCandidate[];
  customAddress: string;
  customCity: string;
  customState: string;
}): VenueCandidateMatchResult {
  const candidates = input.candidates;
  if (candidates.length === 0) return { kind: "no_match" };

  const normalizedAddress = normalizeMatchToken(input.customAddress);
  if (normalizedAddress) {
    const addressMatches = candidates.filter(
      (candidate) => normalizeMatchToken(candidate.address) === normalizedAddress
    );
    if (addressMatches.length === 1) {
      return { kind: "strong_match", venue: addressMatches[0] };
    }
    if (addressMatches.length > 1) {
      return { kind: "ambiguous", candidates: addressMatches };
    }
  }

  const normalizedCity = normalizeMatchToken(input.customCity);
  const normalizedState = normalizeMatchToken(input.customState);
  if (normalizedCity && normalizedState) {
    const cityStateMatches = candidates.filter((candidate) => {
      return (
        normalizeMatchToken(candidate.city) === normalizedCity &&
        normalizeMatchToken(candidate.state) === normalizedState
      );
    });
    if (cityStateMatches.length === 1) {
      return { kind: "strong_match", venue: cityStateMatches[0] };
    }
    if (cityStateMatches.length > 1) {
      return { kind: "ambiguous", candidates: cityStateMatches };
    }
  }

  return candidates.length > 1
    ? { kind: "ambiguous", candidates }
    : { kind: "no_match" };
}

function isReusableSeriesRequest(body: Record<string, unknown>): boolean {
  const seriesMode = typeof body.series_mode === "string" ? body.series_mode : "single";
  const hasRecurringRule =
    typeof body.recurrence_rule === "string" && body.recurrence_rule.trim().length > 0;
  const hasCustomDates = Array.isArray(body.custom_dates) && body.custom_dates.length > 0;
  return seriesMode !== "single" || hasRecurringRule || hasCustomDates;
}

function extractZipFromText(value: string): string | null {
  return value.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? null;
}

function inferStateFromZip(zip: string | null, fallback: string): string {
  if (fallback.trim()) return fallback.trim();
  // Colorado ZIPs are enough for the local event assistant to avoid defaulting
  // a Pueblo/Springs venue back to Denver when the flyer only says "81006".
  if (zip && /^8[01]\d{3}(?:-\d{4})?$/.test(zip)) return "CO";
  return "";
}

function inferCityFromZip(zip: string | null, fallback: string): string {
  if (fallback.trim()) return fallback.trim();
  if (!zip) return "";
  if (/^810\d{2}(?:-\d{4})?$/.test(zip)) return "Pueblo";
  if (/^809\d{2}(?:-\d{4})?$/.test(zip)) return "Colorado Springs";
  if (/^802\d{2}(?:-\d{4})?$/.test(zip)) return "Denver";
  return "";
}

function cleanStreetAddress(address: string, city: string, zip: string | null): string {
  let cleaned = address.trim();
  if (zip) cleaned = cleaned.replace(new RegExp(`\\b${zip.replace("-", "\\-")}\\b`, "i"), "").trim();
  if (city) cleaned = cleaned.replace(new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b\\s*$`, "i"), "").trim();
  return cleaned.replace(/[,\s]+$/g, "").trim();
}

function clearCustomLocationBody(body: Record<string, unknown>): void {
  body.custom_location_name = null;
  body.custom_address = null;
  body.custom_city = null;
  body.custom_state = null;
  body.custom_zip = null;
  body.custom_latitude = null;
  body.custom_longitude = null;
  body.location_notes = null;
}

async function resolveExistingVenueFromCustomLocation(input: {
  supabase: SupabaseServerClient;
  body: Record<string, unknown>;
  traceId: string | null;
}): Promise<ExistingVenueResolution> {
  if (typeof input.body.venue_id === "string" && input.body.venue_id.trim().length > 0) {
    return null;
  }

  const customName =
    typeof input.body.custom_location_name === "string"
      ? input.body.custom_location_name.trim()
      : "";
  if (!customName) return null;

  const { data: venueRows, error } = await input.supabase
    .from("venues")
    .select("id, name, slug")
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    console.warn(
      "[POST /api/my-events] Existing venue resolver lookup failed:",
      error.message,
      "| traceId:",
      input.traceId,
    );
    return null;
  }

  const venueCatalog: VenueCatalogEntry[] = (venueRows || []).map((venue) => ({
    id: venue.id,
    name: venue.name,
    slug: venue.slug ?? null,
  }));
  const userMessage = [
    customName,
    input.body.custom_address,
    input.body.custom_city,
    input.body.custom_state,
    input.body.custom_zip,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(", ");

  const resolution = resolveVenue({
    draftVenueId: null,
    draftVenueName: customName,
    userMessage,
    venueCatalog,
    draftLocationMode: input.body.location_mode as string | null | undefined,
    draftOnlineUrl: input.body.online_url as string | null | undefined,
    isCustomLocation: true,
  });

  if (resolution.status !== "resolved") return null;
  return { id: resolution.venueId, name: resolution.venueName };
}

// GET - Get events where user is host/cohost
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get events where user is a host
  const { data: hostEntries, error: hostError } = await supabase
    .from("event_hosts")
    .select("event_id, role, invitation_status")
    .eq("user_id", sessionUser.id)
    .eq("invitation_status", "accepted");

  if (hostError) {
    return NextResponse.json({ error: hostError.message }, { status: 500 });
  }

  if (!hostEntries || hostEntries.length === 0) {
    return NextResponse.json([]);
  }

  const eventIds = hostEntries.map(h => h.event_id);

  // Get full event data
  // Note: event_hosts.user_id references auth.users, not profiles
  // So we fetch hosts without profile join, then fetch profiles separately
  // Phase 4.x: Removed is_dsc_event filter - users should see ALL their happenings,
  // not just CSC events. Community events (is_dsc_event=false) also show in My Happenings.
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(`
      *,
      event_hosts(id, user_id, role, invitation_status)
    `)
    .in("id", eventIds)
    .order("created_at", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  // Collect all host user_ids across all events and fetch profiles
  const allHostUserIds = (events || []).flatMap(e =>
    (e.event_hosts as { user_id: string }[])?.map(h => h.user_id) || []
  );
  const uniqueHostUserIds = [...new Set(allHostUserIds)];

  let profileMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();
  if (uniqueHostUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", uniqueHostUserIds);

    profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
  }

  // Enrich events with host profiles
  const enrichedEvents = (events || []).map(event => ({
    ...event,
    event_hosts: (event.event_hosts as { id: string; user_id: string; role: string; invitation_status: string }[])?.map(h => ({
      ...h,
      user: profileMap.get(h.user_id) || undefined
    })) || []
  }));

  // Add RSVP counts to enriched events
  const eventsWithCounts = await Promise.all(
    enrichedEvents.map(async (event) => {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      const hostEntry = hostEntries.find(h => h.event_id === event.id);

      return {
        ...event,
        rsvp_count: count || 0,
        user_role: hostEntry?.role || "host"
      };
    })
  );

  return NextResponse.json(eventsWithCounts);
}

// Weekly series now creates a single DB row with recurrence_rule="weekly" and max_occurrences
// Occurrence expansion happens dynamically at query time via expandOccurrencesForEvent()

/**
 * Phase 4.42d: Unified event insert builder.
 *
 * This function builds the base insert payload for events, ensuring all
 * RLS-required fields are consistently set for both single events and series.
 *
 * RLS Policy: host_manage_own_events requires (auth.uid() = host_id)
 * Therefore host_id MUST be set to the session user's ID.
 */
interface EventInsertParams {
  userId: string;
  body: Record<string, unknown>;
  isCSCEvent: boolean;
  eventStatus: string;
  publishedAt: string | null;
  venueName: string | null;
  venueAddress: string | null;
  finalVenueId: string | null;
  customLocationFields: {
    custom_location_name: string | null;
    custom_address: string | null;
    custom_city: string | null;
    custom_state: string | null;
    custom_latitude: number | null;
    custom_longitude: number | null;
    location_notes: string | null;
  };
  eventDate: string;
  seriesId: string | null;
  seriesIndex: number | null;
}

function buildEventInsert(params: EventInsertParams) {
  const {
    userId,
    body,
    isCSCEvent,
    eventStatus,
    publishedAt,
    venueName,
    venueAddress,
    finalVenueId,
    customLocationFields,
    eventDate,
    seriesId,
    seriesIndex,
  } = params;

  return {
    // CRITICAL: host_id is required by RLS policy host_manage_own_events
    // WITH CHECK: (auth.uid() = host_id) OR is_admin()
    host_id: userId,
    title: body.title as string,
    description: (body.description as string) || null,
    event_type: normalizeIncomingEventTypes(body.event_type),
    is_dsc_event: isCSCEvent,
    // Phase 4.43: capacity is independent of timeslots (RSVP always available)
    // capacity=null means unlimited RSVP, not "RSVP disabled"
    capacity: (body.capacity as number) || null,
    host_notes: (body.host_notes as string) || null,
    // Venue fields (mutually exclusive with custom location)
    venue_id: finalVenueId,
    venue_name: venueName,
    venue_address: venueAddress,
    // Custom location fields (mutually exclusive with venue)
    custom_location_name: customLocationFields.custom_location_name,
    custom_address: customLocationFields.custom_address,
    custom_city: customLocationFields.custom_city,
    custom_state: customLocationFields.custom_state,
    custom_latitude: customLocationFields.custom_latitude,
    custom_longitude: customLocationFields.custom_longitude,
    location_notes: customLocationFields.location_notes,
    // Phase 4.83: Canonicalize day_of_week for ordinal monthly rules
    // If recurrence_rule is ordinal monthly and day_of_week is missing, derive from anchor date
    day_of_week: canonicalizeDayOfWeek(
      body.recurrence_rule as string | null,
      body.day_of_week as string | null,
      eventDate
    ),
    start_time: body.start_time as string,
    end_time: (body.end_time as string) || null,
    recurrence_rule: (body.recurrence_rule as string) || null,
    cover_image_url: (body.cover_image_url as string) || null,
    status: eventStatus,
    // Events start as drafts by default; host must explicitly publish
    is_published: (body.is_published as boolean) ?? false,
    published_at: publishedAt,
    has_timeslots: (body.has_timeslots as boolean) ?? false,
    total_slots: body.has_timeslots ? (body.total_slots as number) : null,
    slot_duration_minutes: body.has_timeslots ? (body.slot_duration_minutes as number) : null,
    allow_guest_slots: body.has_timeslots ? ((body.allow_guests as boolean) ?? false) : false,
    // Series fields
    event_date: eventDate,
    series_id: seriesId,
    series_index: seriesIndex,
    // Max occurrences: null = infinite, N = stops after N occurrences
    max_occurrences: (body.occurrence_count as number) > 0 ? (body.occurrence_count as number) : null,
    // Additional fields
    timezone: (body.timezone as string) || "America/Denver",
    location_mode: (body.location_mode as string) || "venue",
    online_url: (body.online_url as string) || null,
    is_free: (body.is_free as boolean) ?? null,
    cost_label: (body.cost_label as string) || null,
    signup_mode: (body.signup_mode as string) || null,
    signup_url: (body.signup_url as string) || null,
    signup_deadline: (body.signup_deadline as string) || null,
    signup_time: (body.signup_time as string) || null,
    age_policy: (body.age_policy as string) || (isCSCEvent ? "18+ only" : null),
    external_url: (body.external_url as string) || null,
    youtube_url: (body.youtube_url as string) || null,
    spotify_url: (body.spotify_url as string) || null,
    // Categories (multi-select array)
    categories: (body.categories as string[])?.length > 0 ? body.categories : null,
    // Custom dates (for recurrence_rule="custom" events)
    custom_dates: Array.isArray(body.custom_dates) && body.custom_dates.length > 0 ? body.custom_dates : null,
    source: "community",
    // Phase 4.42k A1b: Auto-confirm community events when published
    // Set last_verified_at to mark as confirmed, but leave verified_by null
    // (verified_by null means auto-confirmed, not admin-verified)
    last_verified_at: publishedAt, // null for drafts, timestamp for published
  };
}

function normalizeDuplicateMatchValue(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function isLikelySameDuplicateTitle(a: unknown, b: unknown): boolean {
  const left = normalizeDuplicateMatchValue(a);
  const right = normalizeDuplicateMatchValue(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = right.split(" ").filter((token) => token.length > 2);
  if (rightTokens.length === 0) return false;
  const shared = rightTokens.filter((token) => leftTokens.has(token)).length;
  return shared >= Math.min(3, rightTokens.length);
}

async function findReusableConversationalEvent(input: {
  supabase: SupabaseServerClient;
  userId: string;
  title: string;
  eventDate: string;
  startTime: string;
  finalVenueId: string | null;
  customLocationName: string | null;
  onlineUrl: string | null;
}) {
  const { data, error } = await input.supabase
    .from("events")
    .select("id, slug, title, event_date, start_time, venue_id, custom_location_name, online_url, is_published, status, cover_image_url, updated_at")
    .eq("host_id", input.userId)
    .eq("event_date", input.eventDate)
    .eq("start_time", input.startTime)
    .in("status", ["active", "needs_verification"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.warn("[POST /api/my-events] Conversational duplicate lookup skipped:", error.message);
    return null;
  }

  const expectedCustomLocation = normalizeDuplicateMatchValue(input.customLocationName);
  const expectedOnlineUrl = normalizeDuplicateMatchValue(input.onlineUrl);

  return (data ?? []).find((event) => {
    if (!isLikelySameDuplicateTitle(event.title, input.title)) {
      return false;
    }
    if (input.finalVenueId) {
      return event.venue_id === input.finalVenueId;
    }
    if (expectedCustomLocation) {
      return normalizeDuplicateMatchValue(event.custom_location_name) === expectedCustomLocation;
    }
    if (expectedOnlineUrl) {
      return normalizeDuplicateMatchValue(event.online_url) === expectedOnlineUrl;
    }
    return !event.venue_id && !event.custom_location_name && !event.online_url;
  }) ?? null;
}

// POST - Create new CSC event (or series of events)
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check host/admin status for CSC branding permission (not creation blocking)
  const isApprovedHost = await checkHostStatus(supabase, sessionUser.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", sessionUser.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const canCreateCSC = isApprovedHost || isAdmin;

  const body = await request.json();
  body.event_type = normalizeIncomingEventTypes(body.event_type);
  body.location_mode = normalizeLocationMode(body.location_mode);
  body.signup_mode = normalizeSignupMode(body.signup_mode);

  // Phase 9A: trace_id correlation for conversational create funnel metrics.
  const traceId =
    typeof body.trace_id === "string" && /^[a-f0-9-]{1,64}$/i.test(body.trace_id)
      ? body.trace_id
      : null;

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

  // Validate required fields
  const required = ["title", "event_type", "start_time"];
  for (const field of required) {
    if (field === "event_type") {
      const et = normalizeIncomingEventTypes(body[field]);
      if (et.length === 0) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    } else if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  // Validate event_type values
  const eventTypes = normalizeIncomingEventTypes(body.event_type);
  if (eventTypes.length === 0) {
    return NextResponse.json({ error: "event_type is required" }, { status: 400 });
  }
  const invalidTypes = getInvalidEventTypes(eventTypes);
  if (invalidTypes.length > 0) {
    return NextResponse.json({ error: `Invalid event_type: ${invalidTypes.join(", ")}` }, { status: 400 });
  }

  // Validate online_url required for online/hybrid events
  if ((body.location_mode === "online" || body.location_mode === "hybrid") && !body.online_url) {
    return NextResponse.json(
      { error: "Online URL is required for online or hybrid events" },
      { status: 400 }
    );
  }

  // Phase 4.0: Determine location selection mode
  // User can either select a venue OR provide a custom location (mutually exclusive)
  let hasVenue = !!body.venue_id;
  const customLocationNameInput =
    typeof body.custom_location_name === "string" ? body.custom_location_name.trim() : "";
  const customCityInput =
    typeof body.custom_city === "string" ? body.custom_city.trim() : "";
  const customStateInput =
    typeof body.custom_state === "string" ? body.custom_state.trim() : "";
  const inferredCustomLocationName =
    customLocationNameInput || (customCityInput && customStateInput ? `${customCityInput}, ${customStateInput}` : "");
  let hasCustomLocation = inferredCustomLocationName.length > 0;
  const hasExplicitCustomLocationName = customLocationNameInput.length > 0;
  const requestedLocationMode = body.location_mode;
  const hasOnlineUrlForHybrid =
    typeof body.online_url === "string" && body.online_url.trim().length > 0;

  if (!customLocationNameInput && inferredCustomLocationName) {
    body.custom_location_name = inferredCustomLocationName;
  }

  const existingVenueResolution = await resolveExistingVenueFromCustomLocation({
    supabase,
    body,
    traceId,
  });
  if (existingVenueResolution) {
    body.venue_id = existingVenueResolution.id;
    body.venue_name = existingVenueResolution.name;
    clearCustomLocationBody(body);
    hasVenue = true;
    hasCustomLocation = false;
    body.location_mode =
      requestedLocationMode === "hybrid" && hasOnlineUrlForHybrid ? "hybrid" : "venue";
  }

  // Phase 10.1: Auto-promote conversational custom locations to canonical venues.
  // If a create request has custom location details but no venue_id, attempt to:
  // 1) Reuse an existing venue by name
  // 2) Create a new canonical venue (admin-only path due venues RLS)
  // This keeps new venues reusable across future events instead of one-time custom locations.
  if (
    !hasVenue &&
    hasCustomLocation &&
    hasExplicitCustomLocationName &&
    (body.location_mode === "venue" || body.location_mode === "hybrid" || !body.location_mode)
  ) {
    const customName = customLocationNameInput;
    const rawCustomAddress = typeof body.custom_address === "string" ? body.custom_address.trim() : "";
    const customZip =
      (typeof body.custom_zip === "string" ? body.custom_zip.trim() : "") ||
      extractZipFromText(rawCustomAddress);
    const customCity = inferCityFromZip(customZip, customCityInput);
    const customState = inferStateFromZip(customZip, customStateInput);
    const customAddress = cleanStreetAddress(rawCustomAddress, customCity, customZip);
    const shouldCreateReusableVenue =
      isAdmin &&
      !hasVenue &&
      isReusableSeriesRequest(body) &&
      !!customCity &&
      !!customState;

    if (customName) {
      // 1) Reuse existing canonical venue by name (case-insensitive), but only
      // promote on deterministic strong matches (exact address OR unique city/state).
      const { data: venueCandidatesRaw, error: venueLookupError } = await supabase
        .from("venues")
        .select("id, name, address, city, state")
        .ilike("name", customName)
        .limit(25);

      if (venueLookupError) {
        console.warn(
          "[POST /api/my-events] Venue candidate lookup failed:",
          venueLookupError.message,
          "| traceId:",
          traceId
        );
      }

      const venueCandidates: VenuePromotionCandidate[] = Array.isArray(venueCandidatesRaw)
        ? venueCandidatesRaw
        : [];

      const matchResult = classifyVenueCandidatesForPromotion({
        candidates: venueCandidates,
        customAddress,
        customCity,
        customState,
      });

      let promotedVenue: VenuePromotionCandidate | null =
        matchResult.kind === "strong_match" ? matchResult.venue : null;
      const hasAmbiguousCandidates = matchResult.kind === "ambiguous";

      if (hasAmbiguousCandidates) {
        console.info(
          "[POST /api/my-events] Venue auto-promotion skipped due to ambiguous candidates:",
          venueCandidates.map((candidate) => candidate.id).join(","),
          "| traceId:",
          traceId
        );
      }

      // 2) Admin-only canonical venue creation (venues INSERT is admin-only by RLS).
      if (
        !promotedVenue &&
        !hasAmbiguousCandidates &&
        isAdmin &&
        (customAddress || shouldCreateReusableVenue) &&
        (customAddress ? !!customCity && !!customState : shouldCreateReusableVenue)
      ) {
        const serviceClient = createServiceRoleClient();

        const baseInsert: Database["public"]["Tables"]["venues"]["Insert"] = {
          name: customName,
          address: customAddress,
          city: customCity,
          state: customState,
          zip: customZip,
          google_maps_url:
            (typeof body.google_maps_url === "string" ? body.google_maps_url.trim() || null : null) ??
            (typeof body.map_link === "string" ? body.map_link.trim() || null : null),
          website_url:
            typeof body.website_url === "string" ? body.website_url.trim() || null : null,
          phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
          latitude: typeof body.custom_latitude === "number" ? body.custom_latitude : null,
          longitude: typeof body.custom_longitude === "number" ? body.custom_longitude : null,
        };

        const { updates: geocodedInsertRaw } = await processVenueGeocodingWithStatus(
          null,
          baseInsert
        );
        const geocodedInsert =
          geocodedInsertRaw as Database["public"]["Tables"]["venues"]["Insert"];

        const { data: insertedVenue, error: insertError } = await serviceClient
          .from("venues")
          .insert(geocodedInsert)
          .select("id, name, address, city, state")
          .single();

        if (insertError) {
          // Graceful fallback: if unique-name race/conflict, try read path once.
          // Otherwise keep custom location behavior for this request.
          const { data: conflictedVenueRaw } = await supabase
            .from("venues")
            .select("id, name, address, city, state")
            .ilike("name", customName)
            .limit(25);

          const conflictedCandidates: VenuePromotionCandidate[] = Array.isArray(conflictedVenueRaw)
            ? conflictedVenueRaw
            : [];
          const conflictMatch = classifyVenueCandidatesForPromotion({
            candidates: conflictedCandidates,
            customAddress,
            customCity,
            customState,
          });

          if (conflictMatch.kind === "strong_match") {
            promotedVenue = conflictMatch.venue;
          } else {
            console.warn("[POST /api/my-events] Venue auto-promotion skipped:", insertError.message, "| traceId:", traceId);
          }
        } else if (insertedVenue) {
          promotedVenue = insertedVenue;
        }
      }

      if (promotedVenue) {
        body.venue_id = promotedVenue.id;
        body.venue_name = promotedVenue.name;
        clearCustomLocationBody(body);
        hasVenue = true;
        hasCustomLocation = false;
        body.location_mode =
          requestedLocationMode === "hybrid" && hasOnlineUrlForHybrid ? "hybrid" : "venue";
      }
    }
  }

  // Validate: exactly one of venue_id or custom_location_name must be set for in-person/hybrid events
  if (body.location_mode === "venue" || body.location_mode === "hybrid" || !body.location_mode) {
    if (!hasVenue && !hasCustomLocation) {
      return NextResponse.json({ error: "Either venue_id or custom_location_name is required for in-person events" }, { status: 400 });
    }
    if (hasVenue && hasCustomLocation) {
      return NextResponse.json({ error: "Cannot have both venue_id and custom_location_name" }, { status: 400 });
    }
  }

  // Lookup venue name and address from venues table (only if venue selected)
  let venueName: string | null = null;
  let venueAddress: string | null = null;
  let finalVenueId: string | null = null;
  let customLocationFields = {
    custom_location_name: null as string | null,
    custom_address: null as string | null,
    custom_city: null as string | null,
    custom_state: null as string | null,
    custom_latitude: null as number | null,
    custom_longitude: null as number | null,
    location_notes: null as string | null,
  };

  if (hasVenue) {
    // Venue selection path: clear all custom location fields
    finalVenueId = body.venue_id;
    const { data: venue } = await supabase
      .from("venues")
      .select("name, address, city, state")
      .eq("id", body.venue_id)
      .single();

    if (venue) {
      venueName = venue.name;
      // Combine address with city/state for full address
      const addressParts = [venue.address, venue.city, venue.state].filter(Boolean);
      venueAddress = addressParts.length > 0 ? addressParts.join(", ") : null;
    }
    // customLocationFields stays all null (cleared)
  } else if (hasCustomLocation) {
    // Custom location path: clear venue fields
    finalVenueId = null;
    venueName = null;
    venueAddress = null;
    customLocationFields = {
      custom_location_name: inferredCustomLocationName || null,
      custom_address:
        typeof body.custom_address === "string"
          ? body.custom_address.trim() || null
          : null,
      custom_city: customCityInput || null,
      custom_state: customStateInput || null,
      custom_latitude: body.custom_latitude || null,
      custom_longitude: body.custom_longitude || null,
      location_notes:
        typeof body.location_notes === "string"
          ? body.location_notes.trim() || null
          : null,
    };
  }

  const titleDraft = {
    ...body,
    venue_name: venueName ?? body.venue_name ?? customLocationFields.custom_location_name,
    custom_location_name: customLocationFields.custom_location_name,
  };
  applyVenueTypeTitleDefault(titleDraft);
  if (typeof titleDraft.title === "string" && titleDraft.title.trim().length > 0) {
    body.title = titleDraft.title.trim();
  }

  // Determine series configuration
  // Phase 4.x: Support four series modes:
  // - "single": One-time event (single date, no recurrence)
  // - "weekly": Weekly recurring series (single event row + recurrence_rule="weekly")
  // - "biweekly": Every-other-week recurring series (single event row + recurrence_rule="biweekly")
  // - "monthly": Monthly ordinal pattern (creates SINGLE event with recurrence_rule like "1st/3rd")
  // - "custom": Custom dates (non-predictable, creates multiple event records)
  normalizeDraftRecurrenceFields(body);
  const seriesMode = (body.series_mode as string) || "single";
  const startDate = body.start_date;

  if (!startDate) {
    return NextResponse.json({ error: "start_date is required" }, { status: 400 });
  }

  let eventDates: string[];

  if (seriesMode === "monthly") {
    // Monthly pattern mode: create a SINGLE event record with recurrence_rule
    // The recurrence_rule (e.g., "1st/3rd") is passed from the client
    // Expansion to actual dates happens at query time via expandOccurrencesForEvent()
    eventDates = [startDate];
  } else if (seriesMode === "custom" && Array.isArray(body.custom_dates) && body.custom_dates.length > 0) {
    // Custom dates mode: create a SINGLE event record with recurrence_rule="custom"
    // Dates are stored in custom_dates column. Expansion happens at query time.
    const validDates = (body.custom_dates as string[])
      .filter((d: string) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .slice(0, 12);

    if (validDates.length === 0) {
      return NextResponse.json({ error: "At least one valid date is required for custom series" }, { status: 400 });
    }

    // Single row model: anchor is first date, expansion from custom_dates
    eventDates = [validDates[0]];
    body.recurrence_rule = "custom";
    body.custom_dates = validDates;
  } else if (seriesMode === "weekly") {
    // Weekly series mode: create a SINGLE event record with recurrence_rule="weekly"
    // max_occurrences controls whether it's infinite (null/0) or finite (N)
    // Expansion to actual dates happens at query time via expandOccurrencesForEvent()
    eventDates = [startDate];
    // Enforce recurrence_rule server-side (don't rely on client setting it)
    body.recurrence_rule = "weekly";
  } else if (seriesMode === "biweekly") {
    // Biweekly series mode: create a SINGLE event record with recurrence_rule="biweekly"
    // max_occurrences controls whether it's infinite (null/0) or finite (N)
    // Expansion to actual dates happens at query time via expandOccurrencesForEvent()
    eventDates = [startDate];
    // Enforce recurrence_rule server-side (don't rely on client setting it)
    body.recurrence_rule = "biweekly";
  } else {
    // Single event mode (default): just the start date
    eventDates = [startDate];
  }

  if (traceId && eventDates.length === 1) {
    const reusableEvent = await findReusableConversationalEvent({
      supabase,
      userId: sessionUser.id,
      title: body.title as string,
      eventDate: eventDates[0],
      startTime: body.start_time as string,
      finalVenueId,
      customLocationName: customLocationFields.custom_location_name,
      onlineUrl: typeof body.online_url === "string" ? body.online_url : null,
    });

    if (reusableEvent) {
      console.info("[POST /api/my-events] Reusing matching conversational event instead of creating duplicate:", {
        eventId: reusableEvent.id,
        traceId,
        isPublished: reusableEvent.is_published,
      });
      return NextResponse.json({
        id: reusableEvent.id,
        slug: reusableEvent.slug || null,
        event_date: reusableEvent.event_date,
        series_id: null,
        series_count: 1,
        reused_existing: true,
        is_published: reusableEvent.is_published,
        status: reusableEvent.status,
        cover_image_url: reusableEvent.cover_image_url,
        updated_at: reusableEvent.updated_at,
      });
    }
  }

  // Generate series_id if creating multiple events
  const seriesId = eventDates.length > 1 ? crypto.randomUUID() : null;

  console.log("[POST /api/my-events] Creating", eventDates.length, "event(s), series_id:", seriesId, "| mode:", seriesMode);

  // Create all events in the series
  const createdEvents: {
    id: string;
    event_date: string | null;
    slug: string | null;
    updated_at: string | null;
  }[] = [];

  for (let i = 0; i < eventDates.length; i++) {
    const eventDate = eventDates[i];

    // Determine if this should be a CSC event
    const isCSCEvent = canCreateCSC && body.is_dsc_event === true;

    // Events start as drafts by default; host must explicitly publish
    // When published, events are auto-confirmed (last_verified_at set)
    const isPublished = (body.is_published as boolean) ?? false;
    const eventStatus = "active";
    const publishedAt = isPublished ? new Date().toISOString() : null;

    // Phase 4.42d: Use unified insert builder to ensure host_id is always set
    // This fixes RLS violation for series creation where host_id was missing
    const insertPayload = buildEventInsert({
      userId: sessionUser.id,
      body,
      isCSCEvent,
      eventStatus,
      publishedAt,
      venueName,
      venueAddress,
      finalVenueId,
      customLocationFields,
      eventDate,
      seriesId,
      seriesIndex: seriesId ? i : null,
    });

    // Diagnostic logging for RLS debugging (dev only)
    if (process.env.NODE_ENV !== "production") {
      console.log("[POST /api/my-events] Insert payload host_id:", insertPayload.host_id);
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert(insertPayload)
      .select()
      .single();

    if (eventError) {
      console.error("[POST /api/my-events] Event creation error:", eventError.message, "| Code:", eventError.code, "| traceId:", traceId);
      // If this is not the first event, we've already created some - return partial success
      if (createdEvents.length > 0) {
        return NextResponse.json({
          ...createdEvents[0],
          series_count: createdEvents.length,
          error: `Created ${createdEvents.length} of ${eventDates.length} events. Error: ${eventError.message}`
        });
      }
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    console.log("[POST /api/my-events] Event created:", event.id, "| date:", eventDate, "| series_index:", i, "| traceId:", traceId);
    createdEvents.push({
      id: event.id,
      event_date: event.event_date,
      slug: event.slug || null,
      updated_at: event.updated_at || null,
    });

    // Add creator as host
    const { error: hostError } = await supabase
      .from("event_hosts")
      .insert({
        event_id: event.id,
        user_id: sessionUser.id,
        role: "host",
        invitation_status: "accepted",
        invited_by: sessionUser.id,
        responded_at: new Date().toISOString()
      });

    if (hostError) {
      console.error("[POST /api/my-events] Host assignment error:", hostError.message, "| Code:", hostError.code);
    }

    // Upsert multi-embed media URLs (non-fatal on error)
    if (Array.isArray(body.media_embed_urls)) {
      try {
        await upsertMediaEmbeds(
          supabase,
          { type: "event", id: event.id },
          body.media_embed_urls as string[],
          sessionUser.id
        );
      } catch (err) {
        console.error("[POST /api/my-events] Media embed upsert error:", err);
      }
    }

    // Phase 5.11 Fix: Generate timeslots for ALL occurrences (not just the first)
    // This replaces the legacy database function that didn't handle recurring events properly
    if (body.has_timeslots && body.total_slots) {
      const todayKey = getTodayDenver();
      const totalSlots = body.total_slots as number;
      const slotDuration = (body.slot_duration_minutes as number) ?? 15;

      // Expand occurrences for this event to get all future dates
      const occurrences = expandOccurrencesForEvent({
        event_date: event.event_date,
        day_of_week: event.day_of_week,
        recurrence_rule: event.recurrence_rule,
        custom_dates: event.custom_dates,
        max_occurrences: event.max_occurrences,
      });

      // Filter to only future dates (including today)
      const futureDates = occurrences
        .filter(occ => occ.dateKey >= todayKey)
        .map(occ => occ.dateKey);

      // Generate slots for each occurrence date
      let slotsCreated = 0;
      for (const dateKey of futureDates) {
        const slots = [];
        for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
          // Calculate offset from event start time
          const offset = event.start_time
            ? slotIdx * slotDuration
            : null;

          slots.push({
            event_id: event.id,
            slot_index: slotIdx,
            start_offset_minutes: offset,
            duration_minutes: slotDuration,
            date_key: dateKey,  // Key fix: scope each slot to its occurrence date
          });
        }

        const { error: insertError } = await supabase.from("event_timeslots").insert(slots);
        if (insertError) {
          console.error(`[POST /api/my-events] Failed to insert slots for ${dateKey}:`, insertError.message);
        } else {
          slotsCreated += slots.length;
        }
      }

      console.log(`[POST /api/my-events] Timeslots generated for event ${event.id}: ${slotsCreated} slots across ${futureDates.length} dates`);
    }
  }

  // Return the first event with series info
  const firstEvent = createdEvents[0];

  if (!isAdmin && firstEvent) {
    sendAdminEventAlert({
      type: "created",
      actionContext: "create",
      actorUserId: sessionUser.id,
      actorRole: profile?.role || "member",
      actorName: profile?.full_name || null,
      actorEmail: sessionUser.email || null,
      eventId: firstEvent.id,
      eventSlug: firstEvent.slug,
      eventTitle: typeof body.title === "string" ? body.title : null,
      eventDate: firstEvent.event_date,
      seriesCount: createdEvents.length,
    }).catch((emailError) => {
      console.error("[POST /api/my-events] Failed to send non-admin create admin email:", emailError);
    });
  }

  if (firstEvent) {
    void warmEventSharePreview({
      eventIdentifier: firstEvent.slug || firstEvent.id,
      updatedAt: firstEvent.updated_at,
    }).catch((error) => {
      console.error("[POST /api/my-events] Share preview warm-up failed:", error);
    });
  }

  return NextResponse.json({
    id: firstEvent.id,
    slug: firstEvent.slug,
    event_date: firstEvent.event_date,
    series_id: seriesId,
    series_count: createdEvents.length,
    is_published: (body.is_published as boolean) ?? false,
    status: "active",
    updated_at: firstEvent.updated_at,
  });
}
