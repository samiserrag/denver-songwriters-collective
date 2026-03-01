/**
 * Feature Flags
 *
 * Client-side feature flag utilities.
 * Uses NEXT_PUBLIC_ prefixed env vars for client bundle access.
 */

/**
 * Check if guest verification is enabled (client-side).
 * Set NEXT_PUBLIC_ENABLE_GUEST_VERIFICATION=true in environment to enable.
 */
export function isGuestVerificationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_GUEST_VERIFICATION === "true";
}

/**
 * Check if weekly open mics digest emails are enabled (server-side).
 * Set ENABLE_WEEKLY_DIGEST=true in environment to enable.
 *
 * NOTE (GTM-2): Primary control is now the DB toggle in digest_settings.
 * This env var serves as an emergency kill switch only.
 * Precedence: env var OFF → blocked | env var ON → check DB toggle → check idempotency.
 */
export function isWeeklyDigestEnabled(): boolean {
  return process.env.ENABLE_WEEKLY_DIGEST === "true";
}

/**
 * Check if weekly happenings digest emails are enabled (server-side).
 * Set ENABLE_WEEKLY_HAPPENINGS_DIGEST=true in environment to enable.
 *
 * NOTE (GTM-2): Primary control is now the DB toggle in digest_settings.
 * This env var serves as an emergency kill switch only.
 * Precedence: env var OFF → blocked | env var ON → check DB toggle → check idempotency.
 * Both crons run at the same time (Sunday 3:00 UTC).
 */
export function isWeeklyHappeningsDigestEnabled(): boolean {
  return process.env.ENABLE_WEEKLY_HAPPENINGS_DIGEST === "true";
}

/**
 * Check if weekly happenings digest personalization is enabled (server-side).
 * Set DIGEST_PERSONALIZATION_ENABLED=true in environment to enable.
 *
 * Default is false for safe rollout.
 */
export function isDigestPersonalizationEnabled(): boolean {
  return process.env.DIGEST_PERSONALIZATION_ENABLED === "true";
}

/**
 * Check if external embeds are enabled (server-side).
 *
 * Kill switch behavior:
 * - ENABLE_EXTERNAL_EMBEDS="false" => disabled
 * - any other value / unset => enabled
 */
export function isExternalEmbedsEnabled(): boolean {
  return process.env.ENABLE_EXTERNAL_EMBEDS !== "false";
}
