/**
 * PR5: Attendee Session Cookie Helpers
 *
 * JWT-based cookie for non-member invitee access to invite-only events.
 * Stateless session — server-side invite status recheck on every read.
 *
 * Security:
 * - Dedicated secret (ATTENDEE_INVITE_COOKIE_SECRET), never falls back to service role key
 * - HttpOnly, Secure, SameSite=Lax
 * - 24-hour max-age (but actual access gated by server-side status recheck)
 * - Scoped to one event_id per cookie payload
 * - JWT signature prevents tampering
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const ATTENDEE_COOKIE_NAME = "dsc_attendee_session";
const COOKIE_MAX_AGE_SECONDS = 86400; // 24 hours

export interface AttendeeSessionPayload {
  event_id: string;
  email: string;
  invite_id: string;
}

/**
 * Get the dedicated signing secret. Throws if not configured.
 * NEVER falls back to SUPABASE_SERVICE_ROLE_KEY.
 */
function getSigningSecret(): Uint8Array {
  const secret = process.env.ATTENDEE_INVITE_COOKIE_SECRET;
  if (!secret) {
    throw new Error(
      "Missing ATTENDEE_INVITE_COOKIE_SECRET environment variable. " +
      "This is required for attendee invite cookie signing."
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT for the attendee session.
 */
export async function createAttendeeSessionToken(
  payload: AttendeeSessionPayload
): Promise<string> {
  const secret = getSigningSecret();
  return new SignJWT({
    event_id: payload.event_id,
    email: payload.email,
    invite_id: payload.invite_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

/**
 * Verify and decode an attendee session JWT.
 * Returns null if invalid, expired, or missing required fields.
 */
export async function verifyAttendeeSessionToken(
  token: string
): Promise<AttendeeSessionPayload | null> {
  try {
    const secret = getSigningSecret();
    const { payload } = await jwtVerify(token, secret);

    if (
      typeof payload.event_id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.invite_id !== "string"
    ) {
      return null;
    }

    return {
      event_id: payload.event_id,
      email: payload.email,
      invite_id: payload.invite_id,
    };
  } catch {
    return null;
  }
}

/**
 * Set the attendee session cookie in the response.
 */
export async function setAttendeeCookie(
  payload: AttendeeSessionPayload
): Promise<void> {
  const token = await createAttendeeSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(ATTENDEE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Read and verify the attendee session cookie for a specific event.
 * Returns the payload if valid AND matches the given eventId.
 * Returns null otherwise (wrong event, expired, tampered, missing).
 */
export async function readAttendeeCookie(
  eventId: string
): Promise<AttendeeSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(ATTENDEE_COOKIE_NAME);
    if (!cookie?.value) return null;

    const payload = await verifyAttendeeSessionToken(cookie.value);
    if (!payload) return null;

    // Cross-event check: cookie must match requested event
    if (payload.event_id !== eventId) return null;

    return payload;
  } catch {
    return null;
  }
}
