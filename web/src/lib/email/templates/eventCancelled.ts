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
  SITE_URL,
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
  const safeReason = reason ? escapeHtml(reason) : null;
  const safeHostName = hostName ? escapeHtml(hostName) : null;

  const openMicsUrl = `${SITE_URL}/open-mics`;

  const subject = `Cancelled: ${eventTitle} on ${eventDate}`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Unfortunately, <strong>${safeTitle}</strong> scheduled for ${safeDate} at ${safeVenue} has been cancelled.`)}

${safeReason ? `
<div style="background-color: #262626; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 8px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
    ${safeHostName ? `Note from ${safeHostName}` : "Host's note"}
  </p>
  <p style="margin: 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">${safeReason}</p>
</div>
` : ""}

${paragraph("We're sorry for any inconvenience. We hope to see you at another event soon!", { muted: true })}

<div style="background-color: #22c55e15; border: 1px solid #22c55e30; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
  <p style="margin: 0; color: #22c55e; font-size: 15px; font-weight: 500;">
    Looking for something else this week?
  </p>
</div>

${createButton("Find Another Open Mic", openMicsUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Unfortunately, ${eventTitle} scheduled for ${safeDate} at ${safeVenue} has been cancelled.
${safeReason ? `\n${safeHostName ? `Note from ${safeHostName}` : "Host's note"}: ${safeReason}\n` : ""}
We're sorry for any inconvenience. We hope to see you at another event soon!

Looking for something else this week?
Find another open mic: ${openMicsUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
