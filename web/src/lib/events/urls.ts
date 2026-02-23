/**
 * URL helpers for events/happenings
 * Centralizes URL generation for consistent linking across the app
 */

import type { Event } from "@/types";

export function getOpenMicUrl(slugOrId: string): string {
  return `/open-mics/${slugOrId}`;
}

export function getDscEventUrl(slugOrId: string): string {
  return `/events/${slugOrId}`;
}

/**
 * Canonical URL for an event (legacy routes for now).
 * Later Phase will switch this to /happenings.
 * Prefers slug for SEO-friendly URLs, falls back to id.
 */
export function getEventUrl(event: Event): string {
  // Prefer slug for SEO-friendly URLs, fallback to id
  const identifier = (event as any).slug || event.id;
  const types: string[] = Array.isArray(event.event_type) ? event.event_type : event.event_type ? [event.event_type] : [];
  if (types.includes("open_mic")) {
    return getOpenMicUrl(identifier);
  }
  return getDscEventUrl(identifier);
}

export function getHappeningsUrl(type?: "open_mic" | "csc" | "gig"): string {
  return type ? `/happenings?type=${type}` : "/happenings";
}

/**
 * Phase 4.105: URL for event display page (TV mode)
 * Used by LineupControlSection, lineup page, HostControls
 *
 * @param eventIdentifier - slug or UUID
 * @param dateKey - YYYY-MM-DD date key (optional)
 * @param tv - whether to include tv=1 (defaults to true for "TV Display")
 */
export function getEventDisplayUrl(options: {
  eventIdentifier: string;
  dateKey?: string | null;
  tv?: boolean;
}): string {
  const { eventIdentifier, dateKey, tv = true } = options;
  const params = new URLSearchParams();

  if (tv) {
    params.set("tv", "1");
  }
  if (dateKey) {
    params.set("date", dateKey);
  }

  const queryString = params.toString();
  return `/events/${eventIdentifier}/display${queryString ? `?${queryString}` : ""}`;
}

/**
 * Phase 4.105: URL for event lineup control page
 *
 * @param eventIdentifier - slug or UUID
 * @param dateKey - YYYY-MM-DD date key (optional)
 */
export function getEventLineupUrl(options: {
  eventIdentifier: string;
  dateKey?: string | null;
}): string {
  const { eventIdentifier, dateKey } = options;

  if (dateKey) {
    return `/events/${eventIdentifier}/lineup?date=${dateKey}`;
  }
  return `/events/${eventIdentifier}/lineup`;
}
