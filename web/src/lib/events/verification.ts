/**
 * Public Verification State Helper
 *
 * Phase 4.37: Determines the public-facing verification state of an event.
 * Phase 4.39: Seeded events MUST have last_verified_at to be confirmed.
 *
 * Three states:
 * - confirmed: Event is verified as happening
 * - unconfirmed: Event exists but hasn't been verified (seeded/imported events)
 * - cancelled: Event has been cancelled
 *
 * Rules:
 * 1. Cancelled: status === 'cancelled'
 * 2. Unconfirmed: Event needs verification:
 *    - Has a "needs verification" status (needs_verification/unverified), OR
 *    - Is from seeded source (import/admin) AND not yet verified (last_verified_at is null)
 *      Note: Seeded events remain unconfirmed even if claimed (host_id set)
 * 3. Confirmed: Everything else that's active
 *    - Host-created events (source=community/venue) are confirmed by default
 *    - Seeded events become confirmed only when last_verified_at is set
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
  // - Is from seeded source AND not yet verified (regardless of claim status)
  if (hasNeedsVerificationStatus) {
    return {
      state: "unconfirmed",
      reason: "Event schedule has not been confirmed",
      lastVerifiedAt: event.last_verified_at,
      verifiedBy: event.verified_by,
    };
  }

  // Phase 4.39: Seeded events stay unconfirmed until explicitly verified,
  // even if they've been claimed by a host
  if (isSeededSource && isNotVerified) {
    return {
      state: "unconfirmed",
      reason: isUnclaimed
        ? "Event imported from external source, not yet verified"
        : "Claimed event awaiting admin verification",
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
