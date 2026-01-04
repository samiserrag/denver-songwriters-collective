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
  quoteBlock,
  infoBox,
  eventCard,
  rsvpsDashboardLink,
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

${reason ? quoteBlock(hostName ? `Note from ${hostName}` : "Host's note", reason) : ""}

${infoBox("📅", `This is for ${safeDate} only. The regular series continues as scheduled.`)}

${paragraph("We're sorry for any inconvenience. We hope to see you at another event soon!", { muted: true })}

${createButton("Browse Happenings", happeningsUrl)}

${eventCard(eventTitle, eventUrl)}

${rsvpsDashboardLink()}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Unfortunately, ${eventTitle} scheduled for ${occurrenceDate} at ${venueName} has been cancelled.
${safeReason && safeHostName ? `\nNote from ${safeHostName}: ${safeReason}\n` : safeReason ? `\n${safeReason}\n` : ""}
This is for ${occurrenceDate} only. The regular series continues as scheduled.

We're sorry for any inconvenience. We hope to see you at another event soon!

Browse happenings: ${happeningsUrl}
View event series: ${eventUrl}

View all your RSVPs: ${SITE_URL}/dashboard/my-rsvps`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
