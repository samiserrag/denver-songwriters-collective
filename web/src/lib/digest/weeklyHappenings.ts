/**
 * Weekly Happenings Digest
 *
 * Business logic for fetching ALL upcoming happenings and building per-user digest emails.
 * Used by the /api/cron/weekly-happenings endpoint.
 *
 * GTM-1 MVP:
 * - Query/filter: ALL event types, is_published=true, status="active"
 * - 7-day window: Sunday (send day) through Saturday
 * - Exclude cancelled occurrences via occurrence_overrides
 * - Denver timezone for all date calculations
 * - No personalization (all recipients get same list)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  getTodayDenver,
  addDaysDenver,
  expandOccurrencesForEvent,
} from "@/lib/events/nextOccurrence";
import {
  getSavedHappeningsFiltersForUsers,
  hasDigestApplicableFilters,
  toDigestApplicableFilters,
  type DigestApplicableSavedFilters,
  type SavedDayFilter,
} from "@/lib/happenings/savedFilters";
import {
  computeBoundingBox,
  haversineDistanceMiles,
  normalizeCity,
  normalizeRadiusMiles,
  normalizeZip,
} from "@/lib/happenings/locationFilter";

// ============================================================
// Types
// ============================================================

export interface HappeningEvent {
  id: string;
  title: string;
  slug: string | null;
  event_type: string[];
  start_time: string | null;
  event_date: string | null;
  day_of_week: string | null;
  recurrence_rule: string | null;
  custom_dates: string[] | null;
  max_occurrences: number | null;
  is_free: boolean | null;
  cost_label: string | null;
  signup_time?: string | null;
  venue: {
    id: string;
    name: string;
    slug?: string | null;
    city: string | null;
    state: string | null;
    zip?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}

export interface HappeningOccurrence {
  event: HappeningEvent;
  dateKey: string;
  displayDate: string; // Formatted display date (e.g., "Monday, January 27")
}

export interface HappeningsDigestData {
  /** Happenings grouped by date */
  byDate: Map<string, HappeningOccurrence[]>;
  /** Total count of happenings */
  totalCount: number;
  /** Total count of unique venues */
  venueCount: number;
  /** Date range for the digest (Sunday-Saturday) */
  dateRange: {
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
  };
}

export interface DigestRecipient {
  userId: string;
  email: string;
  firstName: string | null;
}

export interface PersonalizedDigestRecipientsResult {
  recipients: DigestRecipient[];
  digestByUserId: Map<string, HappeningsDigestData>;
  personalizedCount: number;
  skippedCount: number;
}

// ============================================================
// Date Helpers
// ============================================================

/**
 * Get the date range for the weekly digest (Sunday-Saturday).
 * The digest is sent on Sunday night, covering that Sunday through the following Saturday.
 *
 * @param todayKey - The "today" date key (defaults to current Denver date)
 * @returns Start and end date keys for the 7-day window
 */
export function getDigestDateRange(todayKey?: string): { start: string; end: string } {
  const start = todayKey ?? getTodayDenver();
  const end = addDaysDenver(start, 6); // Sunday + 6 = Saturday
  return { start, end };
}

/**
 * Format a date key into a day header (e.g., "MONDAY, JANUARY 27")
 */
export function formatDayHeader(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  }).toUpperCase();
}

/**
 * Format a time string for display (e.g., "7:00 PM")
 */
export function formatTimeDisplay(time: string | null): string {
  if (!time) return "";

  // Parse HH:MM:SS format
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const minute = minutes || "00";

  const isPM = hour >= 12;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return `${displayHour}:${minute} ${isPM ? "PM" : "AM"}`;
}

// ============================================================
// Data Fetching
// ============================================================

/**
 * Fetch all happenings that may have occurrences in the date range.
 * Returns raw event data to be expanded into occurrences.
 * Includes ALL event types (no event_type filter).
 */
async function fetchHappeningEvents(
  supabase: SupabaseClient<Database>
): Promise<HappeningEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(`
      id,
      title,
      slug,
      event_type,
      start_time,
      signup_time,
      event_date,
      day_of_week,
      recurrence_rule,
      custom_dates,
      max_occurrences,
      is_free,
      cost_label,
      venue:venues!left(id, name, slug, city, state, zip, latitude, longitude)
    `)
    .eq("is_published", true)
    .eq("visibility", "public")
    .eq("status", "active");

  if (error) {
    console.error("[WeeklyHappenings] Failed to fetch happenings:", error);
    return [];
  }

  // Transform venue from array to single object (PostgREST returns array for left join)
  return (data || []).map((event) => ({
    ...event,
    venue: Array.isArray(event.venue) ? event.venue[0] || null : event.venue,
  }));
}

/**
 * Fetch occurrence overrides for the given events and date range.
 * Returns a set of cancelled date keys for each event.
 */
async function fetchCancelledOccurrences(
  supabase: SupabaseClient<Database>,
  eventIds: string[],
  startKey: string,
  endKey: string
): Promise<Map<string, Set<string>>> {
  if (eventIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("occurrence_overrides")
    .select("event_id, date_key, status")
    .in("event_id", eventIds)
    .gte("date_key", startKey)
    .lte("date_key", endKey)
    .eq("status", "cancelled");

  if (error) {
    console.error("[WeeklyHappenings] Failed to fetch cancelled occurrences:", error);
    return new Map();
  }

  const cancelledMap = new Map<string, Set<string>>();
  for (const override of data || []) {
    if (!cancelledMap.has(override.event_id)) {
      cancelledMap.set(override.event_id, new Set());
    }
    cancelledMap.get(override.event_id)!.add(override.date_key);
  }

  return cancelledMap;
}

/**
 * Get all upcoming happenings for the digest date range.
 * Expands recurring events and filters out cancelled occurrences.
 */
export async function getUpcomingHappenings(
  supabase: SupabaseClient<Database>,
  options?: { todayKey?: string }
): Promise<HappeningsDigestData> {
  const { start, end } = getDigestDateRange(options?.todayKey);

  // Fetch all happening events (all types)
  const events = await fetchHappeningEvents(supabase);

  // Fetch cancelled occurrences
  const eventIds = events.map((e) => e.id);
  const cancelledMap = await fetchCancelledOccurrences(supabase, eventIds, start, end);

  // Expand occurrences for each event
  const byDate = new Map<string, HappeningOccurrence[]>();
  const uniqueVenues = new Set<string>();
  let totalCount = 0;

  for (const event of events) {
    // Expand occurrences within the date range
    // Pass event identifier for improved debugging in invariant warnings
    const occurrences = expandOccurrencesForEvent(
      {
        id: event.id,
        title: event.title,
        slug: event.slug,
        event_date: event.event_date,
        day_of_week: event.day_of_week,
        recurrence_rule: event.recurrence_rule,
        start_time: event.start_time,
        max_occurrences: event.max_occurrences,
        custom_dates: event.custom_dates,
      },
      { startKey: start, endKey: end }
    );

    // Get cancelled set for this event
    const cancelledSet = cancelledMap.get(event.id) || new Set();

    for (const occurrence of occurrences) {
      // Skip cancelled occurrences
      if (cancelledSet.has(occurrence.dateKey)) continue;

      // Skip if not confident (schedule unknown)
      if (!occurrence.isConfident) continue;

      const happeningOccurrence: HappeningOccurrence = {
        event,
        dateKey: occurrence.dateKey,
        displayDate: formatDayHeader(occurrence.dateKey),
      };

      if (!byDate.has(occurrence.dateKey)) {
        byDate.set(occurrence.dateKey, []);
      }
      byDate.get(occurrence.dateKey)!.push(happeningOccurrence);

      if (event.venue?.id) {
        uniqueVenues.add(event.venue.id);
      }

      totalCount++;
    }
  }

  // Sort events within each date by start time
  for (const occurrences of byDate.values()) {
    occurrences.sort((a, b) => {
      const timeA = a.event.start_time || "23:59:59";
      const timeB = b.event.start_time || "23:59:59";
      return timeA.localeCompare(timeB);
    });
  }

  return {
    byDate,
    totalCount,
    venueCount: uniqueVenues.size,
    dateRange: { start, end },
  };
}

// ============================================================
// Recipient Fetching
// ============================================================

/**
 * Get all users who should receive the weekly digest.
 * Filters by:
 * - Has email address
 * - Has email_enabled + email_digests preferences enabled (or no preference row = default true)
 */
export async function getDigestRecipients(
  supabase: SupabaseClient<Database>
): Promise<DigestRecipient[]> {
  // Get all profiles with emails
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .not("email", "is", null);

  if (profilesError) {
    console.error("[WeeklyHappenings] Failed to fetch profiles:", profilesError);
    return [];
  }

  // Get all notification preferences
  const { data: preferences, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("user_id, email_enabled, email_digests");

  if (prefsError) {
    console.error("[WeeklyHappenings] Failed to fetch preferences:", prefsError);
    // Continue with defaults (all enabled)
  }

  // Build preference map (default true if no row)
  const prefMap = new Map<string, { emailEnabled: boolean; emailDigests: boolean }>();
  for (const pref of preferences || []) {
    prefMap.set(pref.user_id, {
      emailEnabled: pref.email_enabled,
      emailDigests: pref.email_digests,
    });
  }

  // Filter and map recipients
  const recipients: DigestRecipient[] = [];
  for (const profile of profiles || []) {
    if (!profile.email) continue;

    // Check preference (default to true if no row exists)
    const pref = prefMap.get(profile.id);
    const wantsEmail = pref ? pref.emailEnabled && pref.emailDigests : true;
    if (!wantsEmail) continue;

    // Extract first name from full_name
    const firstName = profile.full_name?.split(" ")[0] || null;

    recipients.push({
      userId: profile.id,
      email: profile.email,
      firstName,
    });
  }

  return recipients;
}

function buildFilteredDigestData(
  data: HappeningsDigestData,
  filters: DigestApplicableSavedFilters
): HappeningsDigestData {
  const typeFilter = filters.type;
  const costFilter = filters.cost;
  const dayFilterSet =
    filters.days && filters.days.length > 0
      ? new Set(filters.days)
      : null;

  const byDate = new Map<string, HappeningOccurrence[]>();

  for (const [dateKey, occurrences] of data.byDate.entries()) {
    const filtered = occurrences.filter((occurrence) => {
      const event = occurrence.event;

      if (typeFilter) {
        if (typeFilter === "shows") {
          const isShowType = event.event_type.some((t) =>
            ["showcase", "gig", "other"].includes(t)
          );
          if (!isShowType) return false;
        } else if (!event.event_type.includes(typeFilter)) {
          return false;
        }
      }

      if (costFilter === "free" && event.is_free !== true) return false;
      if (costFilter === "paid" && event.is_free !== false) return false;
      if (costFilter === "unknown" && event.is_free !== null) return false;

      if (dayFilterSet) {
        const dayIndex = new Date(`${occurrence.dateKey}T12:00:00Z`).getUTCDay();
        const dayAbbrev = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dayIndex];
        if (!dayFilterSet.has(dayAbbrev as SavedDayFilter)) return false;
      }

      return true;
    });

    if (filtered.length > 0) {
      byDate.set(dateKey, filtered);
    }
  }

  let locationFiltered = byDate;
  const normalizedZip = normalizeZip(filters.zip);
  const normalizedCity = normalizeCity(filters.city)?.toLowerCase();

  if (normalizedZip || normalizedCity) {
    const radiusMiles = normalizeRadiusMiles(filters.radius);
    const venueMap = new Map<
      string,
      { city: string | null; zip: string | null; latitude: number | null; longitude: number | null }
    >();

    for (const occurrences of byDate.values()) {
      for (const occurrence of occurrences) {
        const venue = occurrence.event.venue;
        if (!venue?.id) continue;
        venueMap.set(venue.id, {
          city: venue.city,
          zip: venue.zip || null,
          latitude: venue.latitude ?? null,
          longitude: venue.longitude ?? null,
        });
      }
    }

    const exactVenueIds = new Set<string>();
    for (const [venueId, venue] of venueMap.entries()) {
      if (normalizedZip) {
        if (normalizeZip(venue.zip || undefined) === normalizedZip) {
          exactVenueIds.add(venueId);
        }
      } else if (normalizedCity) {
        const venueCity = normalizeCity(venue.city || undefined)?.toLowerCase();
        if (venueCity === normalizedCity) {
          exactVenueIds.add(venueId);
        }
      }
    }

    if (exactVenueIds.size === 0) {
      locationFiltered = new Map();
    } else {
      const exactWithCoords = [...exactVenueIds]
        .map((venueId) => venueMap.get(venueId))
        .filter(
          (
            venue
          ): venue is {
            city: string | null;
            zip: string | null;
            latitude: number;
            longitude: number;
          } =>
            Boolean(
              venue &&
                venue.latitude !== null &&
                venue.latitude !== undefined &&
                venue.longitude !== null &&
                venue.longitude !== undefined
            )
        );

      const includedVenueIds = new Set(exactVenueIds);

      if (exactWithCoords.length > 0) {
        const centroid = exactWithCoords.reduce(
          (acc, venue) => ({
            latitude: acc.latitude + venue.latitude,
            longitude: acc.longitude + venue.longitude,
          }),
          { latitude: 0, longitude: 0 }
        );

        const centroidLat = centroid.latitude / exactWithCoords.length;
        const centroidLng = centroid.longitude / exactWithCoords.length;

        const bbox = computeBoundingBox(centroidLat, centroidLng, radiusMiles);

        for (const [venueId, venue] of venueMap.entries()) {
          if (includedVenueIds.has(venueId)) continue;
          if (venue.latitude == null || venue.longitude == null) continue;

          if (
            venue.latitude < bbox.latMin ||
            venue.latitude > bbox.latMax ||
            venue.longitude < bbox.lngMin ||
            venue.longitude > bbox.lngMax
          ) {
            continue;
          }

          const distance = haversineDistanceMiles(
            centroidLat,
            centroidLng,
            venue.latitude,
            venue.longitude
          );

          if (distance <= radiusMiles) {
            includedVenueIds.add(venueId);
          }
        }
      }

      const nextByDate = new Map<string, HappeningOccurrence[]>();
      for (const [dateKey, occurrences] of byDate.entries()) {
        const kept = occurrences.filter((occurrence) => {
          const venueId = occurrence.event.venue?.id;
          return venueId ? includedVenueIds.has(venueId) : false;
        });
        if (kept.length > 0) {
          nextByDate.set(dateKey, kept);
        }
      }
      locationFiltered = nextByDate;
    }
  }

  const uniqueVenues = new Set<string>();
  let totalCount = 0;
  for (const occurrences of locationFiltered.values()) {
    totalCount += occurrences.length;
    for (const occurrence of occurrences) {
      if (occurrence.event.venue?.id) {
        uniqueVenues.add(occurrence.event.venue.id);
      }
    }
  }

  return {
    byDate: locationFiltered,
    totalCount,
    venueCount: uniqueVenues.size,
    dateRange: data.dateRange,
  };
}

export async function personalizeDigestRecipients(
  supabase: SupabaseClient<Database>,
  recipients: DigestRecipient[],
  digestData: HappeningsDigestData,
  options: {
    enabled: boolean;
    logPrefix?: string;
  }
): Promise<PersonalizedDigestRecipientsResult> {
  if (!options.enabled || recipients.length === 0) {
    return {
      recipients,
      digestByUserId: new Map(),
      personalizedCount: 0,
      skippedCount: 0,
    };
  }

  const savedByUserId = await getSavedHappeningsFiltersForUsers(
    supabase,
    recipients.map((r) => r.userId)
  );

  const recipientsToSend: DigestRecipient[] = [];
  const digestByUserId = new Map<string, HappeningsDigestData>();
  let personalizedCount = 0;
  let skippedCount = 0;

  for (const recipient of recipients) {
    const saved = savedByUserId.get(recipient.userId);
    if (!saved) {
      recipientsToSend.push(recipient);
      continue;
    }

    const applicable = toDigestApplicableFilters(saved.filters);
    if (!hasDigestApplicableFilters(applicable)) {
      recipientsToSend.push(recipient);
      continue;
    }

    const personalized = buildFilteredDigestData(digestData, applicable);
    if (personalized.totalCount === 0) {
      skippedCount++;
      console.log(
        `${options.logPrefix || "[WeeklyHappenings]"} Skipping ${recipient.email} - filters produced 0 results`
      );
      continue;
    }

    personalizedCount++;
    recipientsToSend.push(recipient);
    digestByUserId.set(recipient.userId, personalized);
  }

  return {
    recipients: recipientsToSend,
    digestByUserId,
    personalizedCount,
    skippedCount,
  };
}
