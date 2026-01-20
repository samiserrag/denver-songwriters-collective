/**
 * Co-host Invitation Email Template
 *
 * Sent when a host invites someone to co-host their event.
 *
 * Tone: Warm, exciting — this is an opportunity!
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
  EMAIL_COLORS,
} from "../render";

export interface CohostInvitationEmailParams {
  inviteeName: string;
  inviterName: string;
  eventTitle: string;
  eventSlug?: string | null;
  eventId: string;
  venueName?: string | null;
  startTime?: string | null;
}

export function getCohostInvitationEmail(params: CohostInvitationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { inviteeName, inviterName, eventTitle, eventSlug, eventId, venueName, startTime } = params;
  const safeEventTitle = escapeHtml(eventTitle);
  const safeInviterName = escapeHtml(inviterName);

  const subject = `You've been invited to co-host "${eventTitle}" — Denver Songwriters Collective`;

  // Build event link
  const eventLink = eventSlug
    ? `${SITE_URL}/events/${eventSlug}`
    : `${SITE_URL}/events/${eventId}`;

  const invitationsLink = `${SITE_URL}/dashboard/invitations`;

  // Build event details line
  const eventDetails = [venueName, startTime].filter(Boolean).join(" • ");

  const htmlContent = `
${paragraph(getGreeting(inviteeName))}

${paragraph(`${safeInviterName} has invited you to co-host a happening on Denver Songwriters Collective!`)}

${neutralBox("🎤", safeEventTitle, eventDetails || undefined)}

${paragraph("As a co-host, you'll be able to:")}

<ul style="margin: 0 0 24px 0; padding-left: 20px; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.8;">
  <li>View and manage RSVPs</li>
  <li>Edit event details</li>
  <li>Manage the performer lineup</li>
</ul>

${paragraph("Head to your invitations to accept or decline.", { muted: true })}

${createButton("View Invitation", invitationsLink, "green")}

${createButton("View the Happening", eventLink)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${getGreeting(inviteeName)}

${inviterName} has invited you to co-host a happening on Denver Songwriters Collective!

${eventTitle}
${eventDetails}

As a co-host, you'll be able to:
- View and manage RSVPs
- Edit event details
- Manage the performer lineup

Head to your invitations to accept or decline.

View Invitation: ${invitationsLink}

View the Happening: ${eventLink}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
