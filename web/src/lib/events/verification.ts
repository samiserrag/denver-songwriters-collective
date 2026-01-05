/**
 * Public Verification State Helper
 *
 * Phase 4.37: Determines the public-facing verification state of an event.
 *
 * Three states:
 * - confirmed: Event is verified as happening
 * - unconfirmed: Event exists but hasn't been verified (seeded/imported events)
 * - cancelled: Event has been cancelled
 *
 * Rules:
 * 1. Cancelled: status === 'cancelled'
 * 2. Unconfirmed: Active event that is seeded/imported and not yet verified
 *    - status === 'active' (or needs_verification/unverified)
 *    - host_id is null (unclaimed/seeded)
 *    - source in ('import', 'admin') OR status in ('needs_verification', 'unverified')
 *    - last_verified_at is null
 * 3. Confirmed: Everything else that's active
 */

export type VerificationState = "confirmed" | "unconfirmed" | "cancelled";

export interface VerificationResult {
  state: VerificationState;
  reason?: string;
  lastVerifiedAt?: string | null;
  verifiedBy?: string | null;
}

export interface VerificationInput {
  status?: string | null;
  host_id?: string | null;
  source?: string | null;
  last_verified_at?: string | null;
  verified_by?: string | null;
  is_published?: boolean | null;
}

/**
 * Seeded sources - events imported by admin or from external data
 */
const SEEDED_SOURCES = ["import", "admin"];

/**
 * Statuses that indicate an event needs verification
 */
const NEEDS_VERIFICATION_STATUSES = ["needs_verification", "unverified"];

/**
 * Get the public-facing verification state of an event
 */
export function getPublicVerificationState(
  event: VerificationInput
): VerificationResult {
  // Rule 1: Cancelled events are always cancelled
  if (event.status === "cancelled") {
    return {
      state: "cancelled",
      reason: "Event has been cancelled",
    };
  }

  // Rule 2: Check if event is unconfirmed (seeded/imported and not verified)
  const isSeededSource = event.source
    ? SEEDED_SOURCES.includes(event.source)
    : false;
  const hasNeedsVerificationStatus = event.status
    ? NEEDS_VERIFICATION_STATUSES.includes(event.status)
    : false;
  const isUnclaimed = event.host_id === null;
  const isNotVerified = event.last_verified_at === null;

  // Unconfirmed if:
  // - Has a "needs verification" status, OR
  // - Is unclaimed AND from seeded source AND not verified
  if (hasNeedsVerificationStatus) {
    return {
      state: "unconfirmed",
      reason: "Event schedule has not been confirmed",
      lastVerifiedAt: event.last_verified_at,
      verifiedBy: event.verified_by,
    };
  }

  if (isUnclaimed && isSeededSource && isNotVerified) {
    return {
      state: "unconfirmed",
      reason: "Event imported from external source, not yet verified",
      lastVerifiedAt: event.last_verified_at,
      verifiedBy: event.verified_by,
    };
  }

  // Rule 3: Everything else is confirmed
  return {
    state: "confirmed",
    reason: event.last_verified_at
      ? "Verified by admin"
      : "Published by host",
    lastVerifiedAt: event.last_verified_at,
    verifiedBy: event.verified_by,
  };
}

/**
 * Check if an event should show as unconfirmed
 */
export function isUnconfirmed(event: VerificationInput): boolean {
  return getPublicVerificationState(event).state === "unconfirmed";
}

/**
 * Check if an event is confirmed
 */
export function isConfirmed(event: VerificationInput): boolean {
  return getPublicVerificationState(event).state === "confirmed";
}

/**
 * Format last verified date for display
 */
export function formatVerifiedDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    // Check for Invalid Date
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Denver",
    });
  } catch {
    return null;
  }
}
