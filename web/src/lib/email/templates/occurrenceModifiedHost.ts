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
  createButton,
  SITE_URL,
} from "../render";

export interface OccurrenceModifiedHostEmailParams {
  userName?: string | null;
  eventTitle: string;
  occurrenceDate: string;
  eventId: string;
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
  const { userName, eventTitle, occurrenceDate, eventId, changes, newTime, venueName, notes } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeDate = escapeHtml(occurrenceDate);
  const safeVenue = escapeHtml(venueName);
  const safeNotes = notes ? escapeHtml(notes) : null;
  const safeNewTime = newTime ? escapeHtml(newTime) : null;

  const eventUrl = `${SITE_URL}/events/${eventId}`;
  const cancelUrl = `${SITE_URL}/events/${eventId}?cancel=true`;

  const subject = `Update: ${eventTitle} on ${occurrenceDate} — The Denver Songwriters Collective`;

  // Build changes section
  let changesHtml = "";
  let changesText = "";

  if (changes.time) {
    changesHtml += `
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</p>
        <p style="margin: 0; color: #ef4444; font-size: 15px; text-decoration: line-through;">${escapeHtml(changes.time.old)}</p>
        <p style="margin: 4px 0 0 0; color: #22c55e; font-size: 15px; font-weight: 500;">${escapeHtml(changes.time.new)}</p>
      </td>
    </tr>`;
    changesText += `Time: ${changes.time.old} → ${changes.time.new}\n`;
  }

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`The details for <strong>${safeTitle}</strong> on ${safeDate} have been updated.`)}

<div style="background-color: #f59e0b15; border: 1px solid #f59e0b30; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
  <p style="margin: 0; color: #f59e0b; font-size: 14px; font-weight: 500;">
    This update is for ${safeDate} only.
  </p>
</div>

${changesHtml ? `
<div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <p style="margin: 0 0 16px 0; color: #a3a3a3; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">What changed</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${changesHtml}
  </table>
</div>
` : ""}

${safeNotes ? `
<div style="background-color: #262626; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 8px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Note from the host</p>
  <p style="margin: 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">${safeNotes}</p>
</div>
` : ""}

<div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <p style="margin: 0 0 16px 0; color: #a3a3a3; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Updated details</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">When</p>
        <p style="margin: 0; color: #d4a853; font-size: 15px;">${safeDate}${safeNewTime ? ` at ${safeNewTime}` : ""}</p>
      </td>
    </tr>
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Where</p>
        <p style="margin: 0; color: #ffffff; font-size: 15px;">${safeVenue}</p>
      </td>
    </tr>
  </table>
</div>

${paragraph("Your spot is still reserved. If the new details don't work for you, just let us know.", { muted: true })}

${createButton("View Updated Event", eventUrl)}

<p style="margin: 24px 0 0 0; color: #737373; font-size: 13px;">
  Can't make it anymore? <a href="${cancelUrl}" style="color: #d4a853; text-decoration: none;">Cancel your RSVP</a>
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

View event: ${eventUrl}

Can't make it anymore? Cancel: ${cancelUrl}

Hope to see you there!`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
