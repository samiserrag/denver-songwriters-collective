/**
 * Guest Cancellation Confirmation Email Template
 *
 * Sent after a guest successfully cancels either:
 * - an RSVP
 * - a timeslot claim
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  successBox,
  eventCard,
  EMAIL_COLORS,
} from "../render";

export interface GuestCancellationConfirmationEmailParams {
  guestName?: string | null;
  eventTitle: string;
  eventDate?: string | null;
  eventTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  eventUrl?: string | null;
  kind: "rsvp" | "timeslot";
}

export function getGuestCancellationConfirmationEmail(
  params: GuestCancellationConfirmationEmailParams
): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    guestName,
    eventTitle,
    eventDate,
    eventTime,
    venueName,
    venueAddress,
    eventUrl,
    kind,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = venueName ? escapeHtml(venueName) : null;
  const safeAddress = venueAddress ? escapeHtml(venueAddress) : null;
  const safeDate = eventDate ? escapeHtml(eventDate) : "TBA";
  const safeTime = eventTime ? escapeHtml(eventTime) : "TBA";

  const subject =
    kind === "rsvp"
      ? `Your RSVP was cancelled for ${eventTitle}`
      : `Your slot claim was cancelled for ${eventTitle}`;

  const actionLabel = kind === "rsvp" ? "RSVP" : "slot claim";

  const htmlContent = `
${paragraph(getGreeting(guestName))}

${paragraph(`Your ${actionLabel} for <strong>${safeTitle}</strong> has been cancelled.`)}

<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 12px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">When</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.accent}; font-size: 15px; font-weight: 600;">${safeDate} at ${safeTime}</p>
      </td>
    </tr>
    ${safeVenue ? `
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Where</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; font-weight: 600;">${safeVenue}</p>
        ${safeAddress ? `<p style="margin: 4px 0 0 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">${safeAddress}</p>` : ""}
      </td>
    </tr>
    ` : ""}
  </table>
</div>

${successBox("✓", "Cancellation complete.")}

${eventUrl ? eventCard(eventTitle, eventUrl) : ""}

${paragraph("If your plans change, you can sign up again anytime.", { muted: true })}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${guestName?.trim() ? `Hi ${guestName.trim()},` : "Hi there,"}

Your ${actionLabel} for ${eventTitle} has been cancelled.

WHEN: ${safeDate} at ${safeTime}
${safeVenue ? `WHERE: ${safeVenue}${safeAddress ? `\n${safeAddress}` : ""}\n` : ""}
Cancellation complete.

${eventUrl ? `View happening: ${eventUrl}\n` : ""}
If your plans change, you can sign up again anytime.`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
