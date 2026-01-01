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
 * Check if weekly comment digest emails are enabled (server-side).
 * Set ENABLE_WEEKLY_DIGEST=true in environment to enable.
 * Default: false (kill switch - must explicitly enable)
 */
export function isWeeklyDigestEnabled(): boolean {
  return process.env.ENABLE_WEEKLY_DIGEST === "true";
}
