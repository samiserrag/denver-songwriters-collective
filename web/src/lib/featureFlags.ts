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
