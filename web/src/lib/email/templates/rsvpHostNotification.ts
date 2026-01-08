/**
 * RSVP Host Notification Email Template
 *
 * Sent to hosts/watchers when someone RSVPs to their event.
 * Part of the event_updates notification category.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

export interface RsvpHostNotificationEmailParams {
  /** Event title */
  eventTitle: string;
  /** Full URL to event */
  eventUrl: string;
  /** Name of the person who RSVP'd */
  rsvpUserName: string;
  /** Whether they joined the waitlist */
  isWaitlist: boolean;
  /** Recipient's name (optional) */
  recipientName?: string | null;
}

export function getRsvpHostNotificationEmail(params: RsvpHostNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    eventTitle,
    eventUrl,
    rsvpUserName,
    isWaitlist,
    recipientName,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeUserName = escapeHtml(rsvpUserName);

  const subject = isWaitlist
    ? `${rsvpUserName} joined the waitlist for "${eventTitle}"`
    : `${rsvpUserName} is going to "${eventTitle}"`;

  // HTML version
  const htmlContent = `
    ${getGreeting(recipientName)}

    ${paragraph(
      isWaitlist
        ? `<strong>${safeUserName}</strong> just joined the waitlist for <strong>"${safeTitle}"</strong>.`
        : `<strong>${safeUserName}</strong> just RSVP'd to <strong>"${safeTitle}"</strong>.`
    )}

    ${paragraph(
      isWaitlist
        ? `They'll be notified if a spot opens up.`
        : `They're planning to attend your event!`
    )}

    ${createButton("View Attendees", eventUrl)}

    ${paragraph(
      `<span style="color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
        You're receiving this because you're associated with this event.
        You can adjust your notification preferences in your <a href="${SITE_URL}/dashboard/settings" style="color: ${EMAIL_COLORS.accent};">account settings</a>.
      </span>`
    )}
  `;

  const html = wrapEmailHtml(htmlContent);

  // Plain text version
  const textContent = `
${isWaitlist ? `${rsvpUserName} joined the waitlist` : `${rsvpUserName} is going`}

${isWaitlist
  ? `${rsvpUserName} just joined the waitlist for "${eventTitle}".`
  : `${rsvpUserName} just RSVP'd to "${eventTitle}".`}

${isWaitlist
  ? `They'll be notified if a spot opens up.`
  : `They're planning to attend your event!`}

View attendees: ${eventUrl}

---
You're receiving this because you're associated with this event.
Manage notifications: ${SITE_URL}/dashboard/settings
`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
