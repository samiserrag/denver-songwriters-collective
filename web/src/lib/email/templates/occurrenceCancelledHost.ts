/**
 * Occurrence Cancelled (Host Notification) Email Template
 *
 * Sent to RSVPed attendees when the host cancels a single occurrence
 * of a recurring event (not the entire series).
 *
 * Similar structure to eventCancelled.ts but specific to occurrence overrides.
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

export interface OccurrenceCancelledHostEmailParams {
  userName?: string | null;
  eventTitle: string;
  occurrenceDate: string;
  venueName: string;
  reason?: string;
  hostName?: string;
  eventId: string;
}

export function getOccurrenceCancelledHostEmail(params: OccurrenceCancelledHostEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, eventTitle, occurrenceDate, venueName, reason, hostName, eventId } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeDate = escapeHtml(occurrenceDate);
  const safeReason = reason ? escapeHtml(reason) : null;
  const safeHostName = hostName ? escapeHtml(hostName) : null;

  const eventUrl = `${SITE_URL}/events/${eventId}`;
  const happeningsUrl = `${SITE_URL}/happenings`;

  const subject = `Cancelled: ${eventTitle} on ${occurrenceDate} — The Denver Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Unfortunately, <strong>${safeTitle}</strong> scheduled for ${safeDate} at ${safeVenue} has been cancelled.`)}

${safeReason && safeHostName ? `
<div style="background-color: #262626; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 8px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Note from ${safeHostName}</p>
  <p style="margin: 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">${safeReason}</p>
</div>
` : safeReason ? `
<div style="background-color: #262626; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">${safeReason}</p>
</div>
` : ""}

<div style="background-color: #f59e0b15; border: 1px solid #f59e0b30; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; color: #f59e0b; font-size: 15px; font-weight: 500;">
    This is for ${safeDate} only. The regular series continues as scheduled.
  </p>
</div>

${paragraph("We're sorry for any inconvenience. We hope to see you at another event soon!", { muted: true })}

${createButton("Find another event", happeningsUrl)}

<p style="margin: 24px 0 0 0; color: #737373; font-size: 14px;">
  <a href="${eventUrl}" style="color: #d4a853; text-decoration: none;">View event series</a>
</p>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Unfortunately, ${eventTitle} scheduled for ${occurrenceDate} at ${venueName} has been cancelled.
${safeReason && safeHostName ? `\nNote from ${safeHostName}: ${safeReason}\n` : safeReason ? `\n${safeReason}\n` : ""}
This is for ${occurrenceDate} only. The regular series continues as scheduled.

We're sorry for any inconvenience. We hope to see you at another event soon!

Find another event: ${happeningsUrl}
View event series: ${eventUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
