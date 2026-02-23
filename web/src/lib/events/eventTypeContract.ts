/**
 * Shared event type write contract.
 *
 * Keep this module as the single source of truth for host/admin/API write-path
 * normalization + validation rules around events.event_type.
 */

// Write-path valid values (legacy "kindred_group" is normalized to "other")
export const VALID_EVENT_TYPES = new Set([
  "open_mic",
  "showcase",
  "song_circle",
  "workshop",
  "other",
  "gig",
  "meetup",
  "jam_session",
  "poetry",
  "irish",
  "blues",
  "bluegrass",
  "comedy",
] as const);

export type ValidEventType = typeof VALID_EVENT_TYPES extends Set<infer T> ? T : never;

export function normalizeIncomingEventTypes(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [input].filter(Boolean);
  const normalized = raw
    .map((type) => (type === "kindred_group" ? "other" : type))
    .filter((type): type is string => typeof type === "string" && type.trim().length > 0);
  return [...new Set(normalized)];
}

export function getInvalidEventTypes(input: unknown): string[] {
  const normalized = normalizeIncomingEventTypes(input);
  return normalized.filter((type) => !VALID_EVENT_TYPES.has(type as ValidEventType));
}
