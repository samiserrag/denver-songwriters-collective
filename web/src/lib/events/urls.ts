/**
 * URL helpers for events/happenings
 * Centralizes URL generation for consistent linking across the app
 */

import type { Event } from "@/types";

export function getOpenMicUrl(slugOrId: string): string {
  return `/open-mics/${slugOrId}`;
}

export function getDscEventUrl(id: string): string {
  return `/events/${id}`;
}

/**
 * Canonical URL for an event (legacy routes for now).
 * Later Phase will switch this to /happenings.
 */
export function getEventUrl(event: Event): string {
  if (event.event_type === "open_mic") {
    return getOpenMicUrl((event as any).slug || event.id);
  }
  return getDscEventUrl(event.id);
}

export function getHappeningsUrl(type?: "open_mic" | "dsc" | "gig"): string {
  return type ? `/happenings?type=${type}` : "/happenings";
}
