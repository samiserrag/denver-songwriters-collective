/**
 * Event Updated Email Template
 *
 * Sent when a host updates event details (time, location, etc.).
 * Template only - sending trigger not yet implemented.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  expiryWarning,
  SITE_URL,
} from "../render";

export interface EventUpdatedEmailParams {
  userName?: string | null;
  eventTitle: string;
  eventId: string;
  changes: {
    date?: { old: string; new: string };
    time?: { old: string; new: string };
    venue?: { old: string; new: string };
    address?: { old: string; new: string };
  };
  // Current (updated) values for display
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
}

export function getEventUpdatedEmail(params: EventUpdatedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    userName,
    eventTitle,
    eventId,
    changes,
    eventDate,
    eventTime,
    venueName,
    venueAddress,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeAddress = venueAddress ? escapeHtml(venueAddress) : null;
  const safeDate = escapeHtml(eventDate);
  const safeTime = escapeHtml(eventTime);

  const eventUrl = `${SITE_URL}/events/${eventId}`;
  const cancelUrl = `${SITE_URL}/events/${eventId}?cancel=true`;

  const subject = `Update: ${eventTitle} details have changed — The Denver Songwriters Collective`;

  // Build change summary
  const changeLines: string[] = [];
  const changeHtml: string[] = [];

  if (changes.date) {
    changeLines.push(`Date: ${changes.date.old} → ${changes.date.new}`);
    changeHtml.push(`<li><strong>Date:</strong> <span style="text-decoration: line-through; color: #737373;">${escapeHtml(changes.date.old)}</span> → <span style="color: #22c55e;">${escapeHtml(changes.date.new)}</span></li>`);
  }
  if (changes.time) {
    changeLines.push(`Time: ${changes.time.old} → ${changes.time.new}`);
    changeHtml.push(`<li><strong>Time:</strong> <span style="text-decoration: line-through; color: #737373;">${escapeHtml(changes.time.old)}</span> → <span style="color: #22c55e;">${escapeHtml(changes.time.new)}</span></li>`);
  }
  if (changes.venue) {
    changeLines.push(`Venue: ${changes.venue.old} → ${changes.venue.new}`);
    changeHtml.push(`<li><strong>Venue:</strong> <span style="text-decoration: line-through; color: #737373;">${escapeHtml(changes.venue.old)}</span> → <span style="color: #22c55e;">${escapeHtml(changes.venue.new)}</span></li>`);
  }
  if (changes.address) {
    changeLines.push(`Address: ${changes.address.old} → ${changes.address.new}`);
    changeHtml.push(`<li><strong>Address:</strong> <span style="text-decoration: line-through; color: #737373;">${escapeHtml(changes.address.old)}</span> → <span style="color: #22c55e;">${escapeHtml(changes.address.new)}</span></li>`);
  }

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`The details for <strong>${safeTitle}</strong> have been updated.`)}

${expiryWarning("Please review the changes below.")}

<div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <p style="margin: 0 0 12px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">What changed</p>
  <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #a3a3a3; font-size: 15px; line-height: 1.8;">
    ${changeHtml.join("\n    ")}
  </ul>

  <div style="border-top: 1px solid #171717; padding-top: 16px; margin-top: 16px;">
    <p style="margin: 0 0 12px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Updated details</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-bottom: 12px;">
          <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px;">When</p>
          <p style="margin: 0; color: #d4a853; font-size: 15px;">${safeDate} at ${safeTime}</p>
        </td>
      </tr>
      <tr>
        <td>
          <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px;">Where</p>
          <p style="margin: 0; color: #ffffff; font-size: 15px;">${safeVenue}</p>
          ${safeAddress ? `<p style="margin: 4px 0 0 0; color: #a3a3a3; font-size: 14px;">${safeAddress}</p>` : ""}
        </td>
      </tr>
    </table>
  </div>
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

The details for ${eventTitle} have been updated.

WHAT CHANGED:
${changeLines.map(line => `- ${line}`).join("\n")}

UPDATED DETAILS:
When: ${safeDate} at ${safeTime}
Where: ${safeVenue}${safeAddress ? `\n${safeAddress}` : ""}

Your spot is still reserved. If the new details don't work for you, just let us know.

View event: ${eventUrl}

Can't make it anymore? Cancel: ${cancelUrl}

Hope to see you there!`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
