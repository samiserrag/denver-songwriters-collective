/**
 * Attendee Invitation Email Template
 *
 * Sent to members when they are invited to a private event.
 * Includes an acceptance link that grants access and routes to the event page.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  neutralBox,
  SITE_URL,
} from "../render";

export interface AttendeeInvitationEmailParams {
  inviteeName: string;
  inviterName: string;
  eventTitle: string;
  eventSlug?: string | null;
  eventId: string;
  inviteId: string;
  venueName?: string | null;
  startTime?: string | null;
}

export function getAttendeeInvitationEmail(
  params: AttendeeInvitationEmailParams
): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    inviteeName,
    inviterName,
    eventTitle,
    eventSlug,
    eventId,
    inviteId,
    venueName,
    startTime,
  } = params;

  const safeEventTitle = escapeHtml(eventTitle);
  const safeInviterName = escapeHtml(inviterName);
  const subject = `You’re invited to "${eventTitle}" — The Colorado Songwriters Collective`;

  const acceptInviteLink = `${SITE_URL}/attendee-invite?invite_id=${inviteId}`;
  const eventLink = eventSlug
    ? `${SITE_URL}/events/${eventSlug}`
    : `${SITE_URL}/events/${eventId}`;

  const eventDetails = [venueName, startTime].filter(Boolean).join(" • ");

  const htmlContent = `
${paragraph(getGreeting(inviteeName))}

${paragraph(`<strong>${safeInviterName}</strong> invited you to a private happening on The Colorado Songwriters Collective.`)}

${neutralBox("🎶", safeEventTitle, eventDetails || undefined)}

${paragraph("Tap below to accept your invite. You’ll be taken to the event page where you can RSVP.")}

${createButton("Accept Invite & RSVP", acceptInviteLink, "green")}

${paragraph("Want to preview the event page first?")}
${createButton("View Event Page", eventLink)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${getGreeting(inviteeName)}

${inviterName} invited you to a private happening on The Colorado Songwriters Collective.

${eventTitle}
${eventDetails}

Accept your invite and RSVP:
${acceptInviteLink}

View event page:
${eventLink}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
