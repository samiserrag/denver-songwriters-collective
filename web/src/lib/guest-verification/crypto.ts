/**
 * Cryptographic utilities for guest verification
 *
 * Handles code generation, hashing, and token creation/validation.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { GUEST_VERIFICATION_CONFIG } from "./config";

const { CODE_LENGTH, CODE_CHARSET } = GUEST_VERIFICATION_CONFIG;

/**
 * Generate a random verification code
 * Uses cryptographically secure random bytes
 */
export function generateVerificationCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[bytes[i] % CODE_CHARSET.length];
  }
  return code;
}

/**
 * Hash a verification code for storage
 * Uses SHA-256 for fast, non-reversible hashing
 */
export function hashCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

/**
 * Constant-time comparison of code hashes
 * Prevents timing attacks
 */
export function verifyCodeHash(
  providedCode: string,
  storedHash: string
): boolean {
  const providedHash = hashCode(providedCode);
  try {
    return timingSafeEqual(
      Buffer.from(providedHash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Get the JWT secret for action tokens
 */
function getTokenSecret(): Uint8Array {
  const secret = process.env.GUEST_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("GUEST_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Action token payload structure
 */
export interface ActionTokenPayload {
  email: string;
  claim_id?: string;      // For timeslot claims
  rsvp_id?: string;       // For RSVP actions
  action: "confirm" | "cancel" | "cancel_rsvp";
  verification_id: string;
  [key: string]: unknown; // Index signature for JWTPayload compatibility
}

/**
 * Create a signed action token (JWT)
 *
 * Expiry options (in order of precedence):
 * 1. `expiresAt` — absolute Date for the token to expire
 * 2. `expiresInHours` — relative hours from now (default: ACTION_TOKEN_EXPIRES_HOURS)
 */
export async function createActionToken(
  payload: ActionTokenPayload,
  options?: { expiresAt?: Date; expiresInHours?: number }
): Promise<string> {
  const secret = getTokenSecret();

  const expiresAt = options?.expiresAt;
  const expiresInHours =
    options?.expiresInHours ?? GUEST_VERIFICATION_CONFIG.ACTION_TOKEN_EXPIRES_HOURS;

  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();

  if (expiresAt) {
    builder.setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
  } else {
    builder.setExpirationTime(`${expiresInHours}h`);
  }

  return builder.sign(secret);
}

/**
 * Compute end-of-day in Denver timezone for a given date key (YYYY-MM-DD).
 * Returns a Date representing 23:59:59 Denver time on that day.
 */
export function endOfEventDayDenver(dateKey: string): Date {
  // Build a Denver-local "end of day" string and parse it
  // Using Intl to resolve the correct UTC offset (handles DST)
  const [year, month, day] = dateKey.split("-").map(Number);

  // Create a date at noon UTC on that day (safe from DST edges)
  const noon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // Get the Denver UTC offset for this date by formatting
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  }).formatToParts(noon);

  const tzOffset = parts.find((p) => p.type === "timeZoneName")?.value || "";
  // tzOffset looks like "GMT-7" or "GMT-6"
  const offsetMatch = tzOffset.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : -7; // fallback MST

  // 23:59:59 Denver time = 23:59:59 - offset in UTC
  return new Date(Date.UTC(year, month - 1, day, 23 - offsetHours, 59, 59));
}

/**
 * Verify and decode an action token
 * Returns null if invalid or expired
 */
export async function verifyActionToken(
  token: string
): Promise<ActionTokenPayload | null> {
  try {
    const secret = getTokenSecret();
    const { payload } = await jwtVerify(token, secret);

    // Validate required fields
    if (
      typeof payload.email !== "string" ||
      typeof payload.action !== "string" ||
      typeof payload.verification_id !== "string" ||
      !["confirm", "cancel", "cancel_rsvp"].includes(payload.action)
    ) {
      return null;
    }

    // Must have either claim_id or rsvp_id
    const hasClaim = typeof payload.claim_id === "string";
    const hasRsvp = typeof payload.rsvp_id === "string";
    if (!hasClaim && !hasRsvp) {
      return null;
    }

    return {
      email: payload.email,
      claim_id: hasClaim ? (payload.claim_id as string) : undefined,
      rsvp_id: hasRsvp ? (payload.rsvp_id as string) : undefined,
      action: payload.action as "confirm" | "cancel" | "cancel_rsvp",
      verification_id: payload.verification_id,
    };
  } catch {
    return null;
  }
}

/**
 * Mask an email address for display
 * Example: "john.doe@example.com" -> "j***@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}
