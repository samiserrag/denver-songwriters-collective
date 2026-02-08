/**
 * Event Cancelled Email Template
 *
 * Sent when a host cancels an event.
 * Template only - sending trigger not yet implemented.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  quoteBlock,
  infoBox,
  rsvpsDashboardLink,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

export interface EventCancelledEmailParams {
  userName?: string | null;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  reason?: string; // Optional cancellation reason from host
  hostName?: string;
}

export function getEventCancelledEmail(params: EventCancelledEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, eventTitle, eventDate, venueName, reason, hostName } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeDate = escapeHtml(eventDate);

  const happeningsUrl = `${SITE_URL}/happenings`;

  const subject = `Cancelled: ${eventTitle} on ${eventDate} — The Colorado Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

<div style="background-color: ${EMAIL_COLORS.errorBg}; border: 1px solid ${EMAIL_COLORS.errorBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; color: ${EMAIL_COLORS.error}; font-size: 15px; font-weight: 600;">
    Happening cancelled
  </p>
  <p style="margin: 8px 0 0 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px;">
    <strong>${safeTitle}</strong> on ${safeDate} at ${safeVenue}
  </p>
</div>

${reason ? quoteBlock(hostName ? `Note from ${hostName}` : "Host's note", reason) : ""}

${paragraph("We're sorry for any inconvenience. We hope to see you at another happening soon!", { muted: true })}

${infoBox("🎵", "Looking for something else this week?")}

${createButton("Browse Happenings", `${SITE_URL}/happenings`)}

${rsvpsDashboardLink()}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Unfortunately, ${eventTitle} scheduled for ${safeDate} at ${safeVenue} has been cancelled.
${reason ? `\n${hostName ? `Note from ${hostName}` : "Host's note"}: ${reason}\n` : ""}
We're sorry for any inconvenience. We hope to see you at another happening soon!

Looking for something else this week?
Browse happenings: ${happeningsUrl}

View all your RSVPs: ${SITE_URL}/dashboard/my-rsvps`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
