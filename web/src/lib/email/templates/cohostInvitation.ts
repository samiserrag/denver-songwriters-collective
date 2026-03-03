/**
 * Host / Co-host Invitation Email Template
 *
 * Sent when a host or admin invites someone to host or co-host their event.
 * Role-aware: adjusts subject, body copy, and capabilities based on assigned role.
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
  role?: "host" | "cohost";
}

export function getCohostInvitationEmail(params: CohostInvitationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { inviteeName, inviterName, eventTitle, eventSlug, eventId, venueName, startTime, role = "cohost" } = params;
  const safeEventTitle = escapeHtml(eventTitle);
  const safeInviterName = escapeHtml(inviterName);
  const isHost = role === "host";
  const roleLabel = isHost ? "host" : "co-host";

  const subject = `You've been invited to ${roleLabel} "${eventTitle}" — The Colorado Songwriters Collective`;

  // Build event link
  const eventLink = eventSlug
    ? `${SITE_URL}/events/${eventSlug}`
    : `${SITE_URL}/events/${eventId}`;

  const invitationsLink = `${SITE_URL}/dashboard/invitations`;
  const hostGuideLink = `${SITE_URL}/host-guide`;

  // Build event details line
  const eventDetails = [venueName, startTime].filter(Boolean).join(" • ");

  // Capabilities list varies by role
  const capabilitiesHtml = isHost
    ? `<ul style="margin: 0 0 24px 0; padding-left: 20px; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.8;">
  <li>Full control over event details</li>
  <li>Manage RSVPs and performer lineup</li>
  <li>Invite co-hosts to help manage</li>
</ul>`
    : `<ul style="margin: 0 0 24px 0; padding-left: 20px; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.8;">
  <li>View and manage RSVPs</li>
  <li>Edit event details</li>
  <li>Manage the performer lineup</li>
</ul>`;

  const capabilitiesText = isHost
    ? `- Full control over event details
- Manage RSVPs and performer lineup
- Invite co-hosts to help manage`
    : `- View and manage RSVPs
- Edit event details
- Manage the performer lineup`;

  const htmlContent = `
${paragraph(getGreeting(inviteeName))}

${paragraph(`${safeInviterName} has invited you to ${roleLabel} a happening on The Colorado Songwriters Collective!`)}

${neutralBox("🎤", safeEventTitle, eventDetails || undefined)}

${paragraph(`As ${isHost ? "the host" : "a co-host"}, you'll be able to:`)}

${capabilitiesHtml}

${paragraph(`<strong>Tip:</strong> You can also use our AI assistant to update event details — just describe the changes you want to make. Image uploads need to be done manually for now.`, { muted: true })}

${paragraph(`<a href="${hostGuideLink}" style="color: ${EMAIL_COLORS.accent};">Read the Host Guide</a> for tips on managing your event.`, { muted: true })}

${paragraph("Head to your invitations to accept or decline.", { muted: true })}

${createButton("View Invitation", invitationsLink, "green")}

${createButton("View the Happening", eventLink)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${getGreeting(inviteeName)}

${inviterName} has invited you to ${roleLabel} a happening on The Colorado Songwriters Collective!

${eventTitle}
${eventDetails}

As ${isHost ? "the host" : "a co-host"}, you'll be able to:
${capabilitiesText}

Tip: You can also use our AI assistant to update event details — just describe the changes you want to make. Image uploads need to be done manually for now.

Read the Host Guide: ${hostGuideLink}

Head to your invitations to accept or decline.

View Invitation: ${invitationsLink}

View the Happening: ${eventLink}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
