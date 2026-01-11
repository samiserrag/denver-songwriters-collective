/**
 * Timeslot Claim Confirmation Email Template
 *
 * Sent when someone (member or guest) claims a performer slot at an event.
 * Includes event details, slot info, and cancel link.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createSecondaryLink,
  successBox,
  eventCard,
  EMAIL_COLORS,
} from "../render";

export interface TimeslotClaimConfirmationEmailParams {
  /** Performer's name */
  performerName: string;
  /** Event title */
  eventTitle: string;
  /** Event date formatted for display (e.g., "Friday, January 10") */
  eventDate: string;
  /** Event time formatted (e.g., "7:00 PM") */
  eventTime: string;
  /** Venue name */
  venueName: string;
  /** Venue address (optional) */
  venueAddress?: string;
  /** Slot time (e.g., "7:30 PM") */
  slotTime: string;
  /** Slot number (1-indexed for display) */
  slotNumber: number;
  /** Event URL (full URL) */
  eventUrl: string;
  /** Cancel URL for guest cancellation */
  cancelUrl?: string;
  /** Whether this is a guest claim (affects messaging) */
  isGuest?: boolean;
}

export function getTimeslotClaimConfirmationEmail(params: TimeslotClaimConfirmationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    performerName,
    eventTitle,
    eventDate,
    eventTime,
    venueName,
    venueAddress,
    slotTime,
    slotNumber,
    eventUrl,
    cancelUrl,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeAddress = venueAddress ? escapeHtml(venueAddress) : null;
  const safeDate = escapeHtml(eventDate);
  const safeTime = escapeHtml(eventTime);
  const safeSlotTime = escapeHtml(slotTime);

  const subject = `You're on the lineup for ${eventTitle}!`;

  const htmlContent = `
${paragraph(getGreeting(performerName))}

${paragraph(`You've claimed <strong>Slot ${slotNumber}</strong> at <strong>${safeTitle}</strong>.`)}

<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Slot</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.accent}; font-size: 18px; font-weight: 700;">Slot ${slotNumber} — ${safeSlotTime}</p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">When</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; font-weight: 600;">${safeDate} at ${safeTime}</p>
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

${successBox("🎤", "You're on the lineup! See you on stage.")}

${eventCard(eventTitle, eventUrl)}

${cancelUrl ? createSecondaryLink("I can't make it anymore", cancelUrl) : ""}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${performerName?.trim() ? `Hi ${performerName.trim()},` : "Hi there,"}

You've claimed Slot ${slotNumber} at ${eventTitle}.

YOUR SLOT: Slot ${slotNumber} — ${slotTime}
WHEN: ${safeDate} at ${safeTime}
WHERE: ${safeVenue}${safeAddress ? `\n${safeAddress}` : ""}

You're on the lineup! See you on stage.

View happening: ${eventUrl}
${cancelUrl ? `\nCan't make it? Cancel here: ${cancelUrl}` : ""}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
