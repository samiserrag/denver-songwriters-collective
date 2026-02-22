/**
 * Event Cancelled Notifications
 *
 * Sends dashboard notifications + emails to affected users when an event is cancelled.
 *
 * Behavior:
 * - Members: dashboard notification + preference-gated eventCancelled email
 * - Guests: direct eventCancelled email (no preference profile)
 * - Audience and performer signups are both covered:
 *   - event_rsvps: confirmed/waitlist/offered
 *   - timeslot_claims: confirmed/performed/waitlist
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { sendEmail } from "@/lib/email/mailer";
import { getEventCancelledEmail } from "@/lib/email/templates/eventCancelled";

interface EventCancelledParams {
  eventId: string;
  eventSlug: string | null;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  cancelReason?: string | null;
  hostName?: string | null;
}

interface AffectedUser {
  userId: string | null;
  email: string | null;
  name: string | null;
  signupType: "rsvp" | "timeslot";
}

export async function sendEventCancelledNotifications(
  supabase: SupabaseClient<Database>,
  params: EventCancelledParams
): Promise<void> {
  const {
    eventId,
    eventSlug,
    eventTitle,
    eventDate,
    venueName,
    cancelReason,
    hostName,
  } = params;

  const eventLink = `/events/${eventSlug || eventId}`;

  const affectedUsers: AffectedUser[] = [];

  // Audience signups
  const { data: activeRsvps } = await supabase
    .from("event_rsvps")
    .select(`
      user_id,
      guest_name,
      guest_email,
      user:profiles!event_rsvps_user_id_fkey(email, full_name)
    `)
    .eq("event_id", eventId)
    .in("status", ["confirmed", "waitlist", "offered"]);

  if (activeRsvps) {
    for (const rsvp of activeRsvps) {
      if (rsvp.user_id && rsvp.user) {
        const member = rsvp.user as unknown as {
          email: string | null;
          full_name: string | null;
        } | null;

        if (member?.email) {
          affectedUsers.push({
            userId: rsvp.user_id,
            email: member.email,
            name: member.full_name,
            signupType: "rsvp",
          });
        }
      } else if (rsvp.guest_email) {
        affectedUsers.push({
          userId: null,
          email: rsvp.guest_email,
          name: rsvp.guest_name,
          signupType: "rsvp",
        });
      }
    }
  }

  // Performer signups
  const { data: activeClaims } = await supabase
    .from("timeslot_claims")
    .select(`
      member_id,
      guest_name,
      guest_email,
      member:profiles!timeslot_claims_member_id_fkey(email, full_name)
    `)
    .eq("event_id", eventId)
    .in("status", ["confirmed", "performed", "waitlist"]);

  if (activeClaims) {
    for (const claim of activeClaims) {
      if (claim.member_id && claim.member) {
        const member = claim.member as unknown as {
          email: string | null;
          full_name: string | null;
        } | null;

        if (member?.email) {
          affectedUsers.push({
            userId: claim.member_id,
            email: member.email,
            name: member.full_name,
            signupType: "timeslot",
          });
        }
      } else if (claim.guest_email) {
        affectedUsers.push({
          userId: null,
          email: claim.guest_email,
          name: claim.guest_name,
          signupType: "timeslot",
        });
      }
    }
  }

  // Deduplicate by email. Prefer "timeslot" entry if both exist.
  const uniqueByEmail = new Map<string, AffectedUser>();
  for (const user of affectedUsers) {
    if (!user.email) continue;
    const existing = uniqueByEmail.get(user.email);
    if (!existing || user.signupType === "timeslot") {
      uniqueByEmail.set(user.email, user);
    }
  }

  const recipients = [...uniqueByEmail.values()];
  if (recipients.length === 0) return;

  for (const recipient of recipients) {
    try {
      const emailContent = getEventCancelledEmail({
        userName: recipient.name,
        eventTitle,
        eventDate,
        venueName,
        reason: cancelReason || undefined,
        hostName: hostName || undefined,
      });

      if (recipient.userId) {
        const messagePrefix =
          recipient.signupType === "timeslot"
            ? "A happening where you claimed a performer slot has been cancelled."
            : "A happening you RSVP'd to has been cancelled.";

        await sendEmailWithPreferences({
          supabase,
          userId: recipient.userId,
          templateKey: "eventCancelled",
          payload: {
            to: recipient.email!,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            templateName: "eventCancelled",
          },
          notification: {
            type: "event_cancelled",
            title: "Event Cancelled",
            message: `${messagePrefix} "${eventTitle}"`,
            link: eventLink,
          },
        });
      } else {
        await sendEmail({
          to: recipient.email!,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          templateName: "eventCancelled",
        });
      }
    } catch (error) {
      console.error("[eventCancelled] Failed to notify recipient:", recipient.email, error);
      // Continue notifying others
    }
  }
}

