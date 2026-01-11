/**
 * Waitlist Promotion Email Template (Member)
 *
 * Sent when a spot opens up and a waitlisted member is promoted to "offered" status.
 * Similar to waitlistOffer.ts but for authenticated members (not guests).
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  createSecondaryLink,
  eventCard,
  rsvpsDashboardLink,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

export interface WaitlistPromotionEmailParams {
  userName?: string | null;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  eventId: string;
  /** Prefer slug for SEO-friendly URLs, falls back to eventId */
  eventSlug?: string | null;
  offerExpiresAt?: string; // ISO timestamp
}

export function getWaitlistPromotionEmail(params: WaitlistPromotionEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, eventTitle, eventDate, eventTime, venueName, eventId, eventSlug, offerExpiresAt } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeDate = escapeHtml(eventDate);
  const safeTime = escapeHtml(eventTime);

  // Prefer slug for SEO-friendly URLs, fallback to id
  const eventIdentifier = eventSlug || eventId;
  const confirmUrl = `${SITE_URL}/events/${eventIdentifier}?confirm=true`;
  const cancelUrl = `${SITE_URL}/events/${eventIdentifier}?cancel=true`;

  // Format expiry time for display
  let expiryMessage = "";
  let formattedExpiry = "";
  if (offerExpiresAt) {
    const expiryDate = new Date(offerExpiresAt);
    formattedExpiry = expiryDate.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
    expiryMessage = `After that, the spot will be offered to the next person on the waitlist.`;
  }

  const subject = `A spot just opened up at ${eventTitle} — The Denver Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Good news! A spot just opened up at <strong>${safeTitle}</strong>, and you're next in line.`)}

<p style="margin: 12px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; font-style: italic;">
  RSVP means you plan to attend. It is not a performer sign-up.
</p>

<div style="background-color: ${EMAIL_COLORS.warningBg}; border: 1px solid ${EMAIL_COLORS.warningBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.warning}; font-size: 15px; font-weight: 600;">
    Confirm by ${escapeHtml(formattedExpiry)} to lock in your spot.
  </p>
  ${expiryMessage ? `<p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">${expiryMessage}</p>` : ""}
</div>

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
      </td>
    </tr>
  </table>
</div>

${createButton("Confirm my spot", confirmUrl, "green")}

${eventCard(eventTitle, `${SITE_URL}/events/${eventIdentifier}`)}

${rsvpsDashboardLink()}

${paragraph("If you can't make it, no worries—just let us know so we can offer the spot to someone else.", { muted: true })}

${createSecondaryLink("I can't make it", cancelUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Good news! A spot just opened up at ${eventTitle}, and you're next in line.

(RSVP means you plan to attend. It is not a performer sign-up.)

CONFIRM BY ${formattedExpiry} to lock in your spot.
${expiryMessage}

WHEN: ${safeDate} at ${safeTime}
WHERE: ${safeVenue}

CONFIRM MY SPOT: ${confirmUrl}

If you can't make it, no worries—just let us know so we can offer the spot to someone else.

View happening: ${SITE_URL}/events/${eventIdentifier}

View all your RSVPs: ${SITE_URL}/dashboard/my-rsvps

I can't make it: ${cancelUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
