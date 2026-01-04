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
  eventCard,
  rsvpsDashboardLink,
  SITE_URL,
  EMAIL_COLORS,
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
  const subject = `Reminder: ${eventTitle} is ${timeWord}! — The Denver Songwriters Collective`;

  const slotInfo = slotNumber !== undefined
    ? `You're slot <strong>#${slotNumber}</strong> on the lineup.`
    : null;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`<strong>${safeTitle}</strong> is ${timeWord} — can't wait to see you!`)}

${slotInfo ? paragraph(slotInfo) : ""}

<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">When</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.accent}; font-size: 15px; font-weight: 600;">${safeDate} at ${safeTime}</p>
      </td>
    </tr>
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Where</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; font-weight: 600;">${safeVenue}</p>
        ${safeAddress ? `<p style="margin: 4px 0 0 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">${safeAddress}</p>` : ""}
      </td>
    </tr>
  </table>
</div>

${paragraph("Should be a good one. See you soon!", { muted: true })}

${eventCard(eventTitle, eventUrl)}

${rsvpsDashboardLink()}

<p style="margin: 24px 0 0 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
  Plans changed? <a href="${cancelUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">Let us know</a> so we can update the list.
</p>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

${eventTitle} is ${timeWord} — can't wait to see you!

${slotNumber !== undefined ? `You're slot #${slotNumber} on the lineup.\n` : ""}
WHEN: ${safeDate} at ${safeTime}
WHERE: ${safeVenue}${safeAddress ? `\n${safeAddress}` : ""}

Should be a good one. See you soon!

View event: ${eventUrl}

View all your RSVPs: ${SITE_URL}/dashboard/my-rsvps

Plans changed? Let us know: ${cancelUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
