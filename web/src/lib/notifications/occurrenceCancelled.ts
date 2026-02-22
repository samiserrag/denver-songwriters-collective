/**
 * Occurrence Cancelled Notifications
 *
 * Sends notifications/emails when a host cancels a single occurrence.
 * Scope is date_key-specific so other occurrences in the same series are unaffected.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { sendEmail } from "@/lib/email/mailer";
import { getOccurrenceCancelledHostEmail } from "@/lib/email/templates/occurrenceCancelledHost";

interface OccurrenceCancelledParams {
  eventId: string;
  eventSlug?: string | null;
  eventTitle: string;
  dateKey: string;
  occurrenceDateLabel: string;
  venueName: string;
  reason?: string | null;
  hostName?: string | null;
}

interface Recipient {
  userId: string | null;
  email: string;
  name: string | null;
  signupType: "rsvp" | "timeslot";
}

export async function sendOccurrenceCancelledNotifications(
  supabase: SupabaseClient<Database>,
  params: OccurrenceCancelledParams
): Promise<{ notified: number; errors: number }> {
  const {
    eventId,
    eventSlug,
    eventTitle,
    dateKey,
    occurrenceDateLabel,
    venueName,
    reason,
    hostName,
  } = params;

  const recipientMap = new Map<string, Recipient>();

  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select(`
      user_id,
      guest_name,
      guest_email,
      user:profiles!event_rsvps_user_id_fkey(email, full_name)
    `)
    .eq("event_id", eventId)
    .eq("date_key", dateKey)
    .in("status", ["confirmed", "waitlist", "offered"]);

  for (const rsvp of rsvps || []) {
    if (rsvp.user_id && rsvp.user) {
      const member = rsvp.user as unknown as {
        email: string | null;
        full_name: string | null;
      } | null;
      const email = member?.email?.trim().toLowerCase();
      if (!email) continue;
      recipientMap.set(email, {
        userId: rsvp.user_id,
        email,
        name: member?.full_name ?? null,
        signupType: "rsvp",
      });
    } else if (rsvp.guest_email) {
      const email = rsvp.guest_email.trim().toLowerCase();
      recipientMap.set(email, {
        userId: null,
        email,
        name: rsvp.guest_name ?? null,
        signupType: "rsvp",
      });
    }
  }

  const { data: claims } = await supabase
    .from("timeslot_claims")
    .select(`
      member_id,
      guest_name,
      guest_email,
      member:profiles!timeslot_claims_member_id_fkey(email, full_name)
    `)
    .eq("event_id", eventId)
    .eq("date_key", dateKey)
    .in("status", ["confirmed", "performed", "waitlist", "offered"]);

  for (const claim of claims || []) {
    if (claim.member_id && claim.member) {
      const member = claim.member as unknown as {
        email: string | null;
        full_name: string | null;
      } | null;
      const email = member?.email?.trim().toLowerCase();
      if (!email) continue;
      recipientMap.set(email, {
        userId: claim.member_id,
        email,
        name: member?.full_name ?? null,
        signupType: "timeslot",
      });
    } else if (claim.guest_email) {
      const email = claim.guest_email.trim().toLowerCase();
      recipientMap.set(email, {
        userId: null,
        email,
        name: claim.guest_name ?? null,
        signupType: "timeslot",
      });
    }
  }

  const recipients = [...recipientMap.values()];
  if (recipients.length === 0) {
    return { notified: 0, errors: 0 };
  }

  const eventLink = `/events/${eventSlug || eventId}?date=${dateKey}`;

  let notified = 0;
  let errors = 0;

  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const emailContent = getOccurrenceCancelledHostEmail({
        userName: recipient.name,
        eventTitle,
        occurrenceDate: occurrenceDateLabel,
        venueName,
        reason: reason || undefined,
        hostName: hostName || undefined,
        eventId,
        eventSlug,
      });

      if (recipient.userId) {
        const messagePrefix =
          recipient.signupType === "timeslot"
            ? "A date where you claimed a performer slot was cancelled."
            : "A date you RSVP'd to was cancelled.";

        return sendEmailWithPreferences({
          supabase,
          userId: recipient.userId,
          templateKey: "occurrenceCancelledHost",
          payload: {
            to: recipient.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            templateName: "occurrenceCancelledHost",
          },
          notification: {
            type: "event_cancelled",
            title: "Occurrence Cancelled",
            message: `${messagePrefix} "${eventTitle}" (${occurrenceDateLabel}).`,
            link: eventLink,
          },
        });
      }

      await sendEmail({
        to: recipient.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        templateName: "occurrenceCancelledHost",
      });
      return { emailSent: true, notificationCreated: false };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value?.notificationCreated || result.value?.emailSent) {
        notified++;
      }
    } else {
      errors++;
      console.error("[occurrenceCancelled] Failed to notify recipient:", result.reason);
    }
  }

  return { notified, errors };
}
