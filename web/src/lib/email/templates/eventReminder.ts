/**
 * Event Reminder Email Template
 *
 * Sent before an event (e.g., "tonight" or "tomorrow").
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

export interface EventReminderEmailParams {
  userName?: string | null;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
  eventId: string;
  reminderType: "tonight" | "tomorrow";
  slotNumber?: number; // For performers with assigned slots
}

export function getEventReminderEmail(params: EventReminderEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    userName,
    eventTitle,
    eventDate,
    eventTime,
    venueName,
    venueAddress,
    eventId,
    reminderType,
    slotNumber,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeAddress = venueAddress ? escapeHtml(venueAddress) : null;
  const safeDate = escapeHtml(eventDate);
  const safeTime = escapeHtml(eventTime);

  const eventUrl = `${SITE_URL}/events/${eventId}`;
  const cancelUrl = `${SITE_URL}/events/${eventId}?cancel=true`;

  const timeWord = reminderType === "tonight" ? "tonight" : "tomorrow";
  const subject = `Reminder: ${eventTitle} is ${timeWord}!`;

  const slotInfo = slotNumber !== undefined
    ? `You're slot <strong>#${slotNumber}</strong> on the lineup.`
    : null;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Just a friendly reminder—<strong>${safeTitle}</strong> is ${timeWord}!`)}

${slotInfo ? paragraph(slotInfo) : ""}

<div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">When</p>
        <p style="margin: 0; color: #d4a853; font-size: 15px;">${safeDate} at ${safeTime}</p>
      </td>
    </tr>
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Where</p>
        <p style="margin: 0; color: #ffffff; font-size: 15px;">${safeVenue}</p>
        ${safeAddress ? `<p style="margin: 4px 0 0 0; color: #a3a3a3; font-size: 14px;">${safeAddress}</p>` : ""}
      </td>
    </tr>
  </table>
</div>

${paragraph(slotNumber !== undefined
  ? "Show up a few minutes early to check in with the host. We can't wait to hear you play!"
  : "See you there!", { muted: true })}

${createButton("View Event Details", eventUrl)}

<p style="margin: 24px 0 0 0; color: #737373; font-size: 13px;">
  Plans changed? <a href="${cancelUrl}" style="color: #d4a853; text-decoration: none;">Let us know</a> so we can update the list.
</p>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Just a friendly reminder—${eventTitle} is ${timeWord}!

${slotNumber !== undefined ? `You're slot #${slotNumber} on the lineup.\n` : ""}
WHEN: ${safeDate} at ${safeTime}
WHERE: ${safeVenue}${safeAddress ? `\n${safeAddress}` : ""}

${slotNumber !== undefined
  ? "Show up a few minutes early to check in with the host. We can't wait to hear you play!"
  : "See you there!"}

View event: ${eventUrl}

Plans changed? Let us know: ${cancelUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
