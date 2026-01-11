/**
 * Occurrence Modified (Host Notification) Email Template
 *
 * Sent to RSVPed attendees when the host modifies a single occurrence
 * of a recurring event (time change, special flyer, etc.).
 *
 * Similar structure to eventUpdated.ts but specific to occurrence overrides.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  quoteBlock,
  infoBox,
  eventCard,
  rsvpsDashboardLink,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

export interface OccurrenceModifiedHostEmailParams {
  userName?: string | null;
  eventTitle: string;
  occurrenceDate: string;
  eventId: string;
  /** Prefer slug for SEO-friendly URLs, falls back to eventId */
  eventSlug?: string | null;
  changes: {
    time?: { old: string; new: string };
  };
  newTime?: string;
  venueName: string;
  notes?: string;
}

export function getOccurrenceModifiedHostEmail(params: OccurrenceModifiedHostEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, eventTitle, occurrenceDate, eventId, eventSlug, changes, newTime, venueName, notes } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeDate = escapeHtml(occurrenceDate);
  const safeVenue = escapeHtml(venueName);
  const safeNotes = notes ? escapeHtml(notes) : null;
  const safeNewTime = newTime ? escapeHtml(newTime) : null;

  // Prefer slug for SEO-friendly URLs, fallback to id
  const eventIdentifier = eventSlug || eventId;
  const eventUrl = `${SITE_URL}/events/${eventIdentifier}`;
  const cancelUrl = `${SITE_URL}/events/${eventIdentifier}?cancel=true`;

  const subject = `Update: ${eventTitle} on ${occurrenceDate} — The Denver Songwriters Collective`;

  // Build changes section
  let changesHtml = "";
  let changesText = "";

  if (changes.time) {
    changesHtml += `
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.error}; font-size: 15px; text-decoration: line-through;">${escapeHtml(changes.time.old)}</p>
        <p style="margin: 4px 0 0 0; color: ${EMAIL_COLORS.success}; font-size: 15px; font-weight: 500;">${escapeHtml(changes.time.new)}</p>
      </td>
    </tr>`;
    changesText += `Time: ${changes.time.old} → ${changes.time.new}\n`;
  }

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`The details for <strong>${safeTitle}</strong> on ${safeDate} have been updated.`)}

${infoBox("📅", `This update is for ${safeDate} only.`)}

${changesHtml ? `
<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <p style="margin: 0 0 16px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">What changed</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${changesHtml}
  </table>
</div>
` : ""}

${notes ? quoteBlock("Note from the host", notes) : ""}

<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <p style="margin: 0 0 16px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Updated details</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">When</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.accent}; font-size: 15px; font-weight: 600;">${safeDate}${safeNewTime ? ` at ${safeNewTime}` : ""}</p>
      </td>
    </tr>
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Where</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; font-weight: 600;">${safeVenue}</p>
      </td>
    </tr>
  </table>
</div>

${paragraph("Your spot is still reserved. If the new details don't work for you, just let us know.", { muted: true })}

${eventCard(eventTitle, eventUrl)}

${rsvpsDashboardLink()}

<p style="margin: 24px 0 0 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
  Can't make it anymore? <a href="${cancelUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">Cancel your RSVP</a>
</p>

${paragraph("Hope to see you there!", { muted: true })}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

The details for ${eventTitle} on ${occurrenceDate} have been updated.

This update is for ${occurrenceDate} only.

${changesText ? `WHAT CHANGED:\n${changesText}` : ""}
${safeNotes ? `Note from the host: ${safeNotes}\n` : ""}
UPDATED DETAILS:
When: ${occurrenceDate}${newTime ? ` at ${newTime}` : ""}
Where: ${venueName}

Your spot is still reserved. If the new details don't work for you, just let us know.

View happening: ${eventUrl}

View all your RSVPs: ${SITE_URL}/dashboard/my-rsvps

Can't make it anymore? Cancel: ${cancelUrl}

Hope to see you there!`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
