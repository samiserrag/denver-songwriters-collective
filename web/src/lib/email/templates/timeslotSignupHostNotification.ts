/**
 * Timeslot Signup Host Notification Email Template
 *
 * Sent to hosts/watchers when someone claims a performer slot at their event.
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

export interface TimeslotSignupHostNotificationEmailParams {
  /** Event title */
  eventTitle: string;
  /** Full URL to event */
  eventUrl: string;
  /** Name of the performer who signed up */
  performerName: string;
  /** Slot number (1-indexed) */
  slotNumber: number;
  /** Slot time (e.g., "7:30 PM") */
  slotTime?: string;
  /** Whether this is a guest signup */
  isGuest: boolean;
  /** Recipient's name (optional) */
  recipientName?: string | null;
  /** Phase ABC6: Occurrence date for per-occurrence context (e.g., "Sat, Jan 18") */
  occurrenceDate?: string;
}

export function getTimeslotSignupHostNotificationEmail(params: TimeslotSignupHostNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    eventTitle,
    eventUrl,
    performerName,
    slotNumber,
    slotTime,
    isGuest,
    recipientName,
    occurrenceDate,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safePerformerName = escapeHtml(performerName);
  const guestLabel = isGuest ? " (guest)" : "";
  // Phase ABC6: Include occurrence date in subject and messages
  const dateText = occurrenceDate ? ` (${occurrenceDate})` : "";

  const subject = `${performerName}${guestLabel} signed up for slot ${slotNumber} at "${eventTitle}"${dateText}`;

  const slotInfo = slotTime ? `Slot ${slotNumber} (${slotTime})` : `Slot ${slotNumber}`;

  // HTML version
  const htmlContent = `
    ${getGreeting(recipientName)}

    ${paragraph(
      `<strong>${safePerformerName}${guestLabel}</strong> just claimed <strong>${slotInfo}</strong> for <strong>"${safeTitle}"</strong>${dateText}.`
    )}

    ${paragraph(`They're ready to perform at your happening!`)}

    ${createButton("View Lineup", eventUrl)}

    ${paragraph(
      `<span style="color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
        You're receiving this because you're the host.
        You can adjust your notification preferences in your <a href="${SITE_URL}/dashboard/settings" style="color: ${EMAIL_COLORS.accent};">account settings</a>.
      </span>`
    )}
  `;

  const html = wrapEmailHtml(htmlContent);

  // Plain text version
  const textContent = `
${performerName}${guestLabel} signed up for slot ${slotNumber}${dateText}

${performerName}${guestLabel} just claimed ${slotInfo} for "${eventTitle}"${dateText}.

They're ready to perform at your happening!

View lineup: ${eventUrl}

---
You're receiving this because you're the host.
Manage notifications: ${SITE_URL}/dashboard/settings
`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
