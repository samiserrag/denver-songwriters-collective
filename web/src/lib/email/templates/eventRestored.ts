/**
 * Event Restored Email Template
 *
 * Sent to users who had RSVPs or timeslot claims when an event was cancelled,
 * notifying them that the event is back on and they can re-RSVP or re-claim a spot.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  successBox,
  infoBox,
  rsvpsDashboardLink,
  SITE_URL,
} from "../render";

export interface EventRestoredEmailParams {
  userName?: string | null;
  eventTitle: string;
  eventDate: string; // Formatted date string
  eventTime?: string | null;
  venueName: string;
  eventUrl: string;
  /**
   * Type of signup the user previously had
   * - "rsvp" = they had an RSVP
   * - "timeslot" = they had claimed a performer slot
   */
  previousSignupType: "rsvp" | "timeslot";
  /**
   * Optional: slot number if they had a timeslot claim
   */
  slotNumber?: number | null;
}

export function getEventRestoredEmail(params: EventRestoredEmailParams): {
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
    eventUrl,
    previousSignupType,
    slotNumber,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeDate = escapeHtml(eventDate);
  const safeTime = eventTime ? escapeHtml(eventTime) : null;

  const subject = `Back On: ${eventTitle} is happening! — The Colorado Songwriters Collective`;

  // Build the message based on signup type
  const previousSignupNote =
    previousSignupType === "timeslot"
      ? `You previously had${slotNumber ? ` slot #${slotNumber} claimed` : " a performer slot claimed"} for this happening.`
      : "You previously had an RSVP for this happening.";

  const ctaText =
    previousSignupType === "timeslot"
      ? "If you'd still like to perform, you're welcome to claim a new spot."
      : "If you'd still like to attend, you're welcome to RSVP again.";

  const buttonText =
    previousSignupType === "timeslot" ? "Claim a Spot" : "RSVP Now";

  const htmlContent = `
${paragraph(getGreeting(userName))}

${successBox("Good news!", `${safeTitle} is back on!`)}

<p style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
  <strong>${safeTitle}</strong><br />
  ${safeDate}${safeTime ? ` at ${safeTime}` : ""}<br />
  ${safeVenue}
</p>

${paragraph(previousSignupNote, { muted: true })}

${infoBox("Your previous signup was cancelled", "When the event was cancelled, all RSVPs and performer signups were released. Spots are not automatically restored.")}

${paragraph(ctaText)}

${createButton(buttonText, eventUrl, "green")}

${rsvpsDashboardLink()}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Good news! ${eventTitle} is back on!

${eventTitle}
${eventDate}${eventTime ? ` at ${eventTime}` : ""}
${venueName}

${previousSignupNote}

When the event was cancelled, all RSVPs and performer signups were released. Spots are not automatically restored.

${ctaText}

${buttonText}: ${eventUrl}

View all your RSVPs: ${SITE_URL}/dashboard/my-rsvps`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
