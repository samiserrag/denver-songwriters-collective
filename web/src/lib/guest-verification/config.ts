/**
 * Guest Verification Configuration
 *
 * Feature flag and configuration for Progressive Identity system.
 * All guest verification endpoints check this flag and return 404 when disabled.
 */

/**
 * Feature flag for guest verification system.
 * Set ENABLE_GUEST_VERIFICATION=true in environment to enable.
 */
export function isGuestVerificationEnabled(): boolean {
  return process.env.ENABLE_GUEST_VERIFICATION === "true";
}

/**
 * Configuration constants for guest verification
 */
export const GUEST_VERIFICATION_CONFIG = {
  // Verification code settings
  CODE_LENGTH: 6,
  CODE_EXPIRES_MINUTES: 15,
  CODE_CHARSET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", // No 0/O, 1/I for readability

  // Rate limiting
  MAX_CODES_PER_EMAIL_PER_HOUR: 3,
  MAX_CODE_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 30,

  // Action token settings
  ACTION_TOKEN_EXPIRES_HOURS: 24,

  // Claim limits
  MAX_GUEST_CLAIMS_PER_EVENT_PERCENT: 50,
} as const;

/**
 * Response for disabled feature flag
 */
export function featureDisabledResponse(): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
