/**
 * Event Updated Notifications
 *
 * Sends notifications to all signed-up attendees (RSVPs + timeslot claimants)
 * when published event details change.
 * - Members: dashboard notification + preference-gated email
 * - Guests: direct email
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { sendEmailWithPreferences } from "../email/sendWithPreferences";
import { sendEmail } from "../email/mailer";
import { getEventUpdatedEmail } from "../email/templates/eventUpdated";

const SITE_URL = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://coloradosongwriterscollective.org";

export interface EventUpdateParams {
  eventId: string;
  eventSlug?: string | null;
  dateKey?: string | null;
  eventTitle: string;
  changes: {
    date?: { old: string; new: string };
    time?: { old: string; new: string };
    venue?: { old: string; new: string };
    address?: { old: string; new: string };
    details?: string[];
  };
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
}

interface AttendeeInfo {
  userId: string | null;
  email: string;
  fullName: string | null;
}

/**
 * Get all signed-up users for an event (RSVP + timeslot claimants), deduplicated
 */
async function getEventAttendees(
  supabase: SupabaseClient<Database>,
  eventId: string,
  dateKey?: string | null
): Promise<AttendeeInfo[]> {
  const attendeeMap = new Map<string, AttendeeInfo>();

  // 1. Get RSVP attendees (confirmed, waitlist, offered)
  let rsvpQuery = supabase
    .from("event_rsvps")
    .select(`
      user_id,
      guest_name,
      guest_email,
      user:profiles!event_rsvps_user_id_fkey(email, full_name)
    `)
    .eq("event_id", eventId)
    .in("status", ["confirmed", "waitlist", "offered"]);

  if (dateKey) {
    rsvpQuery = rsvpQuery.eq("date_key", dateKey);
  }

  const { data: rsvps } = await rsvpQuery;

  if (rsvps) {
    for (const rsvp of rsvps) {
      if (rsvp.user_id && rsvp.user) {
        const member = rsvp.user as unknown as { email: string | null; full_name: string | null } | null;
        const email = member?.email?.trim().toLowerCase();
        if (!email) continue;
        if (!attendeeMap.has(email)) {
          attendeeMap.set(email, {
            userId: rsvp.user_id,
            email,
            fullName: member?.full_name ?? null
          });
        }
      } else if (rsvp.guest_email) {
        const email = rsvp.guest_email.trim().toLowerCase();
        if (!attendeeMap.has(email)) {
          attendeeMap.set(email, {
            userId: null,
            email,
            fullName: rsvp.guest_name ?? null
          });
        }
      }
    }
  }

  // 2. Get timeslot claimants (confirmed, waitlist, offered)
  let claimsQuery = supabase
    .from("timeslot_claims")
    .select(`
      member_id,
      guest_name,
      guest_email,
      member:profiles!timeslot_claims_member_id_fkey(email, full_name)
    `)
    .eq("event_id", eventId)
    .in("status", ["confirmed", "waitlist", "offered"]);

  if (dateKey) {
    claimsQuery = claimsQuery.eq("date_key", dateKey);
  }

  const { data: claims } = await claimsQuery;

  if (claims) {
    for (const claim of claims) {
      if (claim.member_id && claim.member) {
        const member = claim.member as unknown as { email: string | null; full_name: string | null } | null;
        const email = member?.email?.trim().toLowerCase();
        if (!email) continue;

        // Prefer performer/timeslot context if recipient appears in both lists.
        attendeeMap.set(email, {
          userId: claim.member_id,
          email,
          fullName: member?.full_name ?? null
        });
      } else if (claim.guest_email) {
        const email = claim.guest_email.trim().toLowerCase();
        attendeeMap.set(email, {
          userId: null,
          email,
          fullName: claim.guest_name ?? null
        });
      }
    }
  }

  return Array.from(attendeeMap.values());
}

/**
 * Send event updated notifications to all attendees.
 */
export async function sendEventUpdatedNotifications(
  supabase: SupabaseClient<Database>,
  params: EventUpdateParams
): Promise<{ notified: number; errors: number }> {
  const {
    eventId,
    eventSlug,
    dateKey,
    eventTitle,
    changes,
    eventDate,
    eventTime,
    venueName,
    venueAddress
  } = params;

  const attendees = await getEventAttendees(supabase, eventId, dateKey);

  if (attendees.length === 0) {
    console.log(`[eventUpdated] No attendees to notify for event ${eventId}`);
    return { notified: 0, errors: 0 };
  }

  console.log(`[eventUpdated] Notifying ${attendees.length} attendees for event ${eventId}`);

  // Build change summary for dashboard notification
  const changeSummary: string[] = [];
  if (changes.date) changeSummary.push("date");
  if (changes.time) changeSummary.push("time");
  if (changes.venue) changeSummary.push("venue");
  if (changes.address) changeSummary.push("address");
  if (changes.details && changes.details.length > 0) {
    changeSummary.push(...changes.details);
  }
  const changeText = changeSummary.length > 0
    ? `${changeSummary.slice(0, 4).join(", ")}${changeSummary.length > 4 ? ` +${changeSummary.length - 4} more` : ""}`
    : "Details updated";

  const dateParam = dateKey ? `?date=${dateKey}` : "";
  const eventUrl = `${SITE_URL}/events/${eventSlug || eventId}${dateParam}`;

  let notified = 0;
  let errors = 0;

  // Process each attendee
  const results = await Promise.allSettled(
    attendees.map(async (attendee) => {
      const emailContent = getEventUpdatedEmail({
        userName: attendee.fullName,
        eventTitle,
        eventId,
        eventSlug,
        dateKey: dateKey || undefined,
        changes,
        eventDate,
        eventTime,
        venueName,
        venueAddress
      });

      if (attendee.userId) {
        return sendEmailWithPreferences({
          supabase,
          userId: attendee.userId,
          templateKey: "eventUpdated",
          payload: {
            to: attendee.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          },
          notification: {
            type: "event_updated",
            title: `Updated: ${eventTitle}`,
            message: `The host updated ${changeText}. Tap to review the latest details.`,
            link: eventUrl
          }
        });
      }

      // Guest recipient (no profile): send direct email only.
      if (!attendee.userId) {
        await sendEmail({
          to: attendee.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          templateName: "eventUpdated"
        });
        return { emailSent: true, notificationCreated: false };
      }

      return { emailSent: false, notificationCreated: false };
    })
  );

  // Count results
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value?.notificationCreated || result.value?.emailSent) {
        notified++;
      }
    } else {
      errors++;
      console.error("[eventUpdated] Failed to notify attendee:", result.reason);
    }
  }

  console.log(`[eventUpdated] Complete: ${notified} notified, ${errors} errors`);
  return { notified, errors };
}
