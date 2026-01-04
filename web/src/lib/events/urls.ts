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
  if (event.event_type === "open_mic") {
    return getOpenMicUrl(identifier);
  }
  return getDscEventUrl(identifier);
}

export function getHappeningsUrl(type?: "open_mic" | "dsc" | "gig"): string {
  return type ? `/happenings?type=${type}` : "/happenings";
}
