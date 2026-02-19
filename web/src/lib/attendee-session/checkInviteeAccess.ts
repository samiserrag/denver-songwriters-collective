/**
 * PR5: Invitee Access Checker
 *
 * Server-side check for whether a user (member or non-member cookie holder)
 * has accepted-invitee access to an invite-only event.
 *
 * CRITICAL: Re-checks invite status on EVERY call. No stale reads.
 * Uses service-role client only for the invite status lookup.
 *
 * Returns true only if:
 * - Invite exists with status='accepted'
 * - Invite is not past expires_at
 * - Invite matches the user (by user_id or cookie invite_id)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { readAttendeeCookie } from "./cookie";

interface InviteeAccessResult {
  hasAccess: boolean;
  /** If access is via cookie, the email from the cookie payload */
  cookieEmail?: string;
}

/**
 * Check if the current user has accepted-invitee access to an invite-only event.
 *
 * Checks in order:
 * 1. Member path: userId + event_attendee_invites WHERE user_id=X AND status='accepted'
 * 2. Non-member path: attendee session cookie → invite_id lookup → status='accepted'
 *
 * Service-role is used ONLY for the invite status query (minimal blast radius).
 * User identity is verified from auth session or cookie JWT — not from service-role.
 *
 * @param eventId - The event UUID
 * @param userId - Authenticated user ID (null if anonymous)
 */
export async function checkInviteeAccess(
  eventId: string,
  userId: string | null
): Promise<InviteeAccessResult> {
  const serviceClient = createServiceRoleClient();

  // 1. Member path: check by user_id
  if (userId) {
    const { data: invite } = await serviceClient
      .from("event_attendee_invites")
      .select("id, status, expires_at")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .eq("status", "accepted")
      .maybeSingle();

    if (invite && !isExpired(invite.expires_at)) {
      return { hasAccess: true };
    }
  }

  // 2. Non-member path: check cookie
  const cookiePayload = await readAttendeeCookie(eventId);
  if (cookiePayload) {
    // Re-check invite status in DB (no stale 24h window)
    const { data: invite } = await serviceClient
      .from("event_attendee_invites")
      .select("id, status, expires_at")
      .eq("id", cookiePayload.invite_id)
      .eq("event_id", eventId)
      .eq("status", "accepted")
      .maybeSingle();

    if (invite && !isExpired(invite.expires_at)) {
      return { hasAccess: true, cookieEmail: cookiePayload.email };
    }
  }

  return { hasAccess: false };
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}
