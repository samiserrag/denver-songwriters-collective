/**
 * Event Updated Notifications
 *
 * Sends notifications to all signed-up users (RSVPs + timeslot claimants) when
 * major event details change. Uses dashboard notifications as canonical and
 * preference-gated emails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { sendEmailWithPreferences } from "../email/sendWithPreferences";
import { getEventUpdatedEmail } from "../email/templates/eventUpdated";

const SITE_URL = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://denversongwriterscollective.org";

export interface EventUpdateParams {
  eventId: string;
  eventSlug?: string | null;
  eventTitle: string;
  changes: {
    date?: { old: string; new: string };
    time?: { old: string; new: string };
    venue?: { old: string; new: string };
    address?: { old: string; new: string };
  };
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
}

interface AttendeeInfo {
  userId: string;
  email: string;
  fullName: string | null;
}

/**
 * Get all signed-up users for an event (RSVP + timeslot claimants), deduplicated
 */
async function getEventAttendees(
  supabase: SupabaseClient<Database>,
  eventId: string
): Promise<AttendeeInfo[]> {
  const attendeeMap = new Map<string, AttendeeInfo>();

  // 1. Get RSVP attendees (confirmed, waitlist, offered)
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .in("status", ["confirmed", "waitlist", "offered"]);

  if (rsvps) {
    for (const rsvp of rsvps) {
      if (rsvp.user_id && !attendeeMap.has(rsvp.user_id)) {
        attendeeMap.set(rsvp.user_id, {
          userId: rsvp.user_id,
          email: "",
          fullName: null
        });
      }
    }
  }

  // 2. Get timeslot claimants (confirmed, waitlist, offered)
  const { data: timeslots } = await supabase
    .from("event_timeslots")
    .select("id")
    .eq("event_id", eventId);

  if (timeslots && timeslots.length > 0) {
    const slotIds = timeslots.map(s => s.id);
    const { data: claims } = await supabase
      .from("timeslot_claims")
      .select("member_id")
      .in("timeslot_id", slotIds)
      .in("status", ["confirmed", "waitlist", "offered"]);

    if (claims) {
      for (const claim of claims) {
        if (claim.member_id && !attendeeMap.has(claim.member_id)) {
          attendeeMap.set(claim.member_id, {
            userId: claim.member_id,
            email: "",
            fullName: null
          });
        }
      }
    }
  }

  // 3. Fetch profile info for all user IDs
  const userIds = Array.from(attendeeMap.keys());
  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  if (profiles) {
    for (const profile of profiles) {
      const attendee = attendeeMap.get(profile.id);
      if (attendee && profile.email) {
        attendee.email = profile.email;
        attendee.fullName = profile.full_name;
      }
    }
  }

  // Filter out users without email
  return Array.from(attendeeMap.values()).filter(a => a.email);
}

/**
 * Send event updated notifications to all attendees
 *
 * Creates dashboard notification for each user (canonical), then sends
 * preference-gated email.
 */
export async function sendEventUpdatedNotifications(
  supabase: SupabaseClient<Database>,
  params: EventUpdateParams
): Promise<{ notified: number; errors: number }> {
  const {
    eventId,
    eventSlug,
    eventTitle,
    changes,
    eventDate,
    eventTime,
    venueName,
    venueAddress
  } = params;

  const attendees = await getEventAttendees(supabase, eventId);

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
  const changeText = changeSummary.length > 0
    ? `${changeSummary.join(", ")} changed`
    : "Details updated";

  const eventUrl = `${SITE_URL}/events/${eventSlug || eventId}`;

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
        changes,
        eventDate,
        eventTime,
        venueName,
        venueAddress
      });

      const result = await sendEmailWithPreferences({
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
          message: `The ${changeText}. Tap to review the new details.`,
          link: eventUrl
        }
      });

      return result;
    })
  );

  // Count results
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value.notificationCreated || result.value.emailSent) {
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
