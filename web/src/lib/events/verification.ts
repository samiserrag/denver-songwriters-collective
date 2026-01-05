/**
 * Public Verification State Helper
 *
 * Phase 4.40: ALL events start as Unconfirmed until admin explicitly verifies.
 *
 * Three states:
 * - confirmed: Admin has verified this event (last_verified_at is set)
 * - unconfirmed: Event exists but hasn't been verified yet
 * - cancelled: Event has been cancelled
 *
 * Rules (in order):
 * 1. Cancelled: status === 'cancelled' → always cancelled
 * 2. Confirmed: last_verified_at is not null → verified by admin
 * 3. Unconfirmed: Everything else (default state for all new events)
 *
 * This replaces the previous source-based logic. Now verification is purely
 * based on whether an admin has explicitly verified the event.
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
 * Get the public-facing verification state of an event
 *
 * Phase 4.40: Simplified logic - all events are unconfirmed until
 * an admin sets last_verified_at.
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

  // Rule 2: Confirmed if last_verified_at is set
  if (event.last_verified_at !== null && event.last_verified_at !== undefined) {
    return {
      state: "confirmed",
      reason: "Verified by admin",
      lastVerifiedAt: event.last_verified_at,
      verifiedBy: event.verified_by,
    };
  }

  // Rule 3: Everything else is unconfirmed (default state)
  return {
    state: "unconfirmed",
    reason: "Awaiting admin verification",
    lastVerifiedAt: null,
    verifiedBy: null,
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
