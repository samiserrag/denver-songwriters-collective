/**
 * Client-safe utilities for waitlist offer handling
 * These functions can be used in "use client" components
 */

const OFFER_WINDOW_HOURS = 24;

/**
 * Calculate offer expiration time (24 hours from now)
 */
export function calculateOfferExpiry(): string {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + OFFER_WINDOW_HOURS);
  return expiry.toISOString();
}

/**
 * Check if an offer has expired
 */
export function isOfferExpired(offerExpiresAt: string | null): boolean {
  if (!offerExpiresAt) return false;
  return new Date() > new Date(offerExpiresAt);
}

/**
 * Get time remaining until offer expires (in milliseconds)
 * Returns 0 if expired or no expiry set
 */
export function getTimeUntilExpiry(offerExpiresAt: string | null): number {
  if (!offerExpiresAt) return 0;
  const remaining = new Date(offerExpiresAt).getTime() - Date.now();
  return Math.max(0, remaining);
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(offerExpiresAt: string | null): string {
  const ms = getTimeUntilExpiry(offerExpiresAt);
  if (ms <= 0) return "Expired";

  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
}
