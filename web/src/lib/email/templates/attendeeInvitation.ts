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
  inviteId?: string;
  isPrivateEvent?: boolean;
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
    isPrivateEvent = false,
    venueName,
    startTime,
  } = params;

  const safeEventTitle = escapeHtml(eventTitle);
  const safeInviterName = escapeHtml(inviterName);
  const subject = `You’re invited to "${eventTitle}" — The Colorado Songwriters Collective`;

  const eventLink = eventSlug
    ? `${SITE_URL}/events/${eventSlug}`
    : `${SITE_URL}/events/${eventId}`;
  const visibilityLabel = isPrivateEvent ? "a private happening" : "a happening";

  const eventDetails = [venueName, startTime].filter(Boolean).join(" • ");

  const htmlContent = `
${paragraph(getGreeting(inviteeName))}

${paragraph(`<strong>${safeInviterName}</strong> invited you to ${visibilityLabel} on The Colorado Songwriters Collective.`)}

${neutralBox("🎶", safeEventTitle, eventDetails || undefined)}

${paragraph("Tap below to view the event page and RSVP.")}
${createButton("View Event & RSVP", eventLink)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${getGreeting(inviteeName)}

${inviterName} invited you to ${visibilityLabel} on The Colorado Songwriters Collective.

${eventTitle}
${eventDetails}

View event page and RSVP:
${eventLink}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
