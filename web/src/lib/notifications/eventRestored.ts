/**
 * Event Restored Notifications
 *
 * Sends notifications to users who had RSVPs or timeslot claims
 * when an event was cancelled, informing them the event is back on.
 *
 * Key behavior:
 * - RSVPs and claims stay cancelled - users must re-RSVP or re-claim
 * - Email respects user preferences (event_updates category) for members
 * - Guests always receive emails (no preferences)
 * - Dashboard notification always created for members (canonical)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { sendEmail } from "@/lib/email/mailer";
import { getEventRestoredEmail } from "@/lib/email/templates/eventRestored";
import { SITE_URL } from "@/lib/email/render";

interface EventRestoredParams {
  eventId: string;
  eventSlug: string | null;
  eventTitle: string;
  eventDate: string;
  eventTime?: string | null;
  venueName: string;
}

interface AffectedUser {
  userId: string | null;
  email: string | null;
  name: string | null;
  signupType: "rsvp" | "timeslot";
  slotNumber?: number | null;
}

/**
 * Send notifications to all users who had RSVPs or timeslot claims
 * when the event was cancelled.
 */
export async function sendEventRestoredNotifications(
  supabase: SupabaseClient<Database>,
  params: EventRestoredParams
): Promise<void> {
  const { eventId, eventSlug, eventTitle, eventDate, eventTime, venueName } = params;

  const eventUrl = `${SITE_URL}/events/${eventSlug || eventId}`;

  // Collect all affected users (cancelled RSVPs and cancelled timeslot claims)
  const affectedUsers: AffectedUser[] = [];

  // 1. Get cancelled RSVPs (member RSVPs have user_id, guest RSVPs have guest_email)
  const { data: cancelledRsvps } = await supabase
    .from("event_rsvps")
    .select(`
      user_id,
      guest_name,
      guest_email,
      user:profiles!event_rsvps_user_id_fkey(email, full_name)
    `)
    .eq("event_id", eventId)
    .eq("status", "cancelled");

  if (cancelledRsvps) {
    for (const rsvp of cancelledRsvps) {
      if (rsvp.user_id && rsvp.user) {
        // Member RSVP - user is an object from the FK join
        const userData = rsvp.user as unknown as { email: string | null; full_name: string | null } | null;
        if (userData) {
          affectedUsers.push({
            userId: rsvp.user_id,
            email: userData.email,
            name: userData.full_name,
            signupType: "rsvp",
          });
        }
      } else if (rsvp.guest_email) {
        // Guest RSVP
        affectedUsers.push({
          userId: null,
          email: rsvp.guest_email,
          name: rsvp.guest_name,
          signupType: "rsvp",
        });
      }
    }
  }

  // 2. Get cancelled timeslot claims
  const { data: cancelledClaims } = await supabase
    .from("timeslot_claims")
    .select(`
      member_id,
      guest_name,
      guest_email,
      timeslot:event_timeslots!inner(slot_index),
      member:profiles!timeslot_claims_member_id_fkey(email, full_name)
    `)
    .eq("event_id", eventId)
    .eq("status", "cancelled");

  if (cancelledClaims) {
    for (const claim of cancelledClaims) {
      const slotNumber = claim.timeslot && typeof claim.timeslot === "object" && "slot_index" in claim.timeslot
        ? (claim.timeslot as { slot_index: number }).slot_index + 1
        : null;

      if (claim.member_id && claim.member) {
        // Member claim - member is an object from the FK join
        const memberData = claim.member as unknown as { email: string | null; full_name: string | null } | null;
        if (!memberData) continue;
        affectedUsers.push({
          userId: claim.member_id,
          email: memberData.email,
          name: memberData.full_name,
          signupType: "timeslot",
          slotNumber,
        });
      } else if (claim.guest_email) {
        // Guest claim
        affectedUsers.push({
          userId: null,
          email: claim.guest_email,
          name: claim.guest_name,
          signupType: "timeslot",
          slotNumber,
        });
      }
    }
  }

  // Deduplicate by email (a user might have both RSVP and claim)
  // Prefer timeslot over rsvp if they have both (more specific)
  const emailMap = new Map<string, AffectedUser>();
  for (const user of affectedUsers) {
    if (!user.email) continue;
    const existing = emailMap.get(user.email);
    if (!existing || user.signupType === "timeslot") {
      emailMap.set(user.email, user);
    }
  }

  const uniqueUsers = Array.from(emailMap.values());

  console.log(`[eventRestored] Sending notifications to ${uniqueUsers.length} affected users for event ${eventId}`);

  // Send notifications to each affected user
  for (const user of uniqueUsers) {
    try {
      // Create dashboard notification if user has account
      if (user.userId) {
        const notificationTitle = "Event Restored";
        const notificationMessage = user.signupType === "timeslot"
          ? `"${eventTitle}" is back on! Your previous performer slot was released. You can claim a new spot if you'd like to perform.`
          : `"${eventTitle}" is back on! Your previous RSVP was released. You can RSVP again if you'd like to attend.`;

        await supabase.rpc("create_user_notification", {
          p_user_id: user.userId,
          p_type: "event_restored",
          p_title: notificationTitle,
          p_message: notificationMessage,
          p_link: eventUrl,
        });
      }

      // Send email (respects preferences for members, always sends for guests)
      if (user.email) {
        const emailContent = getEventRestoredEmail({
          userName: user.name,
          eventTitle,
          eventDate,
          eventTime,
          venueName,
          eventUrl,
          previousSignupType: user.signupType,
          slotNumber: user.slotNumber,
        });

        if (user.userId) {
          // Member: use preference-gated email
          await sendEmailWithPreferences({
            supabase,
            userId: user.userId,
            templateKey: "eventRestored",
            payload: {
              to: user.email,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
              templateName: "eventRestored",
            },
          });
        } else {
          // Guest: send email directly (no preferences to check)
          await sendEmail({
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            templateName: "eventRestored",
          });
        }
      }
    } catch (error) {
      console.error(`[eventRestored] Failed to notify user ${user.email}:`, error);
      // Continue with other users
    }
  }

  console.log(`[eventRestored] Finished sending notifications for event ${eventId}`);
}
