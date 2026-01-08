/**
 * Guest Verification Configuration
 *
 * Configuration for Progressive Identity system.
 * Guest verification is ALWAYS ENABLED in production (no feature flag gating).
 *
 * Kill Switch (EMERGENCY ONLY):
 * Set DISABLE_GUEST_VERIFICATION=true to disable with 503 response.
 * This should only be used if there's a critical issue with the guest system.
 */

/**
 * Check if guest verification is disabled (emergency kill switch).
 * Returns true if DISABLE_GUEST_VERIFICATION=true is set.
 */
export function isGuestVerificationDisabled(): boolean {
  return process.env.DISABLE_GUEST_VERIFICATION === "true";
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
  MAX_CODES_PER_EMAIL_PER_HOUR: 10, // Generous limit for legitimate use
  MAX_CODE_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15, // Shorter lockout

  // Action token settings
  ACTION_TOKEN_EXPIRES_HOURS: 24,

  // Claim limits
  MAX_GUEST_CLAIMS_PER_EVENT_PERCENT: 50,
} as const;

/**
 * Response for emergency kill switch (503 Service Unavailable)
 * Only returned when DISABLE_GUEST_VERIFICATION=true is set.
 */
export function featureDisabledResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "Guest verification temporarily unavailable",
      message: "Please try again later or sign in with an account.",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }
  );
}
