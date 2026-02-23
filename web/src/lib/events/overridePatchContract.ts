/**
 * Shared allowlist of per-occurrence fields that can be overridden.
 *
 * This list is used in both write APIs and render-time merge logic.
 * Series-level fields are intentionally excluded.
 */
export const ALLOWED_OVERRIDE_FIELDS = new Set([
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
  "signup_time",
  "age_policy",
  "external_url",
  "categories",
  "cover_image_url",
  "host_notes",
  "is_published",
]);

export function sanitizeOverridePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    if (ALLOWED_OVERRIDE_FIELDS.has(key)) {
      sanitized[key] = patch[key];
    }
  }
  return sanitized;
}
