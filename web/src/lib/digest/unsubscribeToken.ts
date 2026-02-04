/**
 * Unsubscribe Token — HMAC-Signed One-Click Opt-Out
 *
 * Generates and validates HMAC-SHA256 tokens for one-click
 * digest unsubscribe links. No expiry, no login required.
 *
 * URL format: /api/digest/unsubscribe?uid={userId}&sig={hmacSignature}
 *
 * Phase: GTM-2
 */

import { createHmac, timingSafeEqual } from "crypto";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET;

/**
 * Generate an HMAC-SHA256 signature for a user's unsubscribe link.
 *
 * The message format is "{userId}:unsubscribe_digest" to prevent
 * token reuse for other purposes.
 *
 * Returns null if UNSUBSCRIBE_SECRET is not configured.
 */
export function generateUnsubscribeToken(userId: string): string | null {
  if (!UNSUBSCRIBE_SECRET) {
    console.error("[UnsubscribeToken] UNSUBSCRIBE_SECRET not configured");
    return null;
  }

  const message = `${userId}:unsubscribe_digest`;
  return createHmac("sha256", UNSUBSCRIBE_SECRET)
    .update(message)
    .digest("hex");
}

/**
 * Validate an HMAC-SHA256 signature for an unsubscribe request.
 *
 * Uses constant-time comparison to prevent timing attacks.
 *
 * Returns false if UNSUBSCRIBE_SECRET is not configured.
 */
export function validateUnsubscribeToken(
  userId: string,
  token: string
): boolean {
  if (!UNSUBSCRIBE_SECRET) {
    console.error("[UnsubscribeToken] UNSUBSCRIBE_SECRET not configured");
    return false;
  }

  const expected = generateUnsubscribeToken(userId);
  if (!expected) return false;

  // Constant-time comparison
  if (token.length !== expected.length) return false;

  const tokenBuffer = Buffer.from(token, "utf-8");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  return timingSafeEqual(tokenBuffer, expectedBuffer);
}

/**
 * Build the full unsubscribe URL for a user.
 *
 * Returns null if token generation fails (UNSUBSCRIBE_SECRET missing).
 */
export function buildUnsubscribeUrl(userId: string): string | null {
  const token = generateUnsubscribeToken(userId);
  if (!token) return null;

  const SITE_URL =
    process.env.PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://denversongwriterscollective.org";

  return `${SITE_URL}/api/digest/unsubscribe?uid=${encodeURIComponent(userId)}&sig=${encodeURIComponent(token)}`;
}
