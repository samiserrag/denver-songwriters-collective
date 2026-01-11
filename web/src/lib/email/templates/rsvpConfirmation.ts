/**
 * RSVP Confirmation Email Template
 *
 * Sent when a registered member RSVPs to a DSC event.
 * Two variants: confirmed (got a spot) or waitlist (capacity reached).
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
  rsvpsDashboardLink,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

export interface RsvpConfirmationEmailParams {
  userName?: string | null;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
  eventId: string;
  /** Prefer slug for SEO-friendly URLs, falls back to eventId */
  eventSlug?: string | null;
  isWaitlist: boolean;
  waitlistPosition?: number;
  /** Guest name (for guest RSVPs without account) */
  guestName?: string;
  /** Direct cancel URL for guests (bypasses dashboard) */
  cancelUrl?: string;
}

export function getRsvpConfirmationEmail(params: RsvpConfirmationEmailParams): {
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
    venueAddress,
    eventId,
    eventSlug,
    isWaitlist,
    waitlistPosition,
    guestName,
    cancelUrl: providedCancelUrl,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeAddress = venueAddress ? escapeHtml(venueAddress) : null;
  const safeDate = escapeHtml(eventDate);
  const safeTime = escapeHtml(eventTime);

  // Use guest name if provided (for guest RSVPs), otherwise use userName
  const displayName = guestName || userName;
  const isGuest = !!guestName;

  // Prefer slug for SEO-friendly URLs, fallback to id
  const eventIdentifier = eventSlug || eventId;
  const eventUrl = `${SITE_URL}/events/${eventIdentifier}`;
  // Use provided cancel URL for guests, otherwise default to dashboard cancel
  const cancelUrl = providedCancelUrl || `${SITE_URL}/events/${eventIdentifier}?cancel=true`;

  if (isWaitlist) {
    return getWaitlistVariant({
      userName: displayName,
      safeTitle,
      eventTitle,
      safeDate,
      safeTime,
      safeVenue,
      safeAddress,
      eventUrl,
      cancelUrl,
      waitlistPosition,
      isGuest,
    });
  }

  return getConfirmedVariant({
    userName: displayName,
    safeTitle,
    eventTitle,
    safeDate,
    safeTime,
    safeVenue,
    safeAddress,
    eventUrl,
    cancelUrl,
    isGuest,
  });
}

function getConfirmedVariant(params: {
  userName?: string | null;
  safeTitle: string;
  eventTitle: string;
  safeDate: string;
  safeTime: string;
  safeVenue: string;
  safeAddress: string | null;
  eventUrl: string;
  cancelUrl: string;
  isGuest?: boolean;
}): { subject: string; html: string; text: string } {
  const { userName, safeTitle, eventTitle, safeDate, safeTime, safeVenue, safeAddress, eventUrl, cancelUrl, isGuest } = params;

  const subject = `You're going to ${eventTitle} — The Denver Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Great news! You're confirmed for <strong>${safeTitle}</strong>.`)}

<p style="margin: 12px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; font-style: italic;">
  RSVP means you plan to attend. It is not a performer sign-up.
</p>

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
        ${safeAddress ? `<p style="margin: 4px 0 0 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">${safeAddress}</p>` : ""}
      </td>
    </tr>
  </table>
</div>

${successBox("✓", "You're all set! See you there.")}

${eventCard(eventTitle, eventUrl)}

${isGuest ? "" : rsvpsDashboardLink()}

${createSecondaryLink("I can't make it anymore", cancelUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Great news! You're confirmed for ${eventTitle}.

(RSVP means you plan to attend. It is not a performer sign-up.)

WHEN: ${safeDate} at ${safeTime}
WHERE: ${safeVenue}${safeAddress ? `\n${safeAddress}` : ""}

You're all set! See you there.

View happening: ${eventUrl}
${isGuest ? "" : `\nView all your RSVPs: ${SITE_URL}/dashboard/my-rsvps\n`}
Can't make it? Cancel here: ${cancelUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}

function getWaitlistVariant(params: {
  userName?: string | null;
  safeTitle: string;
  eventTitle: string;
  safeDate: string;
  safeTime: string;
  safeVenue: string;
  safeAddress: string | null;
  eventUrl: string;
  cancelUrl: string;
  waitlistPosition?: number;
  isGuest?: boolean;
}): { subject: string; html: string; text: string } {
  const { userName, safeTitle, eventTitle, safeDate, safeTime, safeVenue, safeAddress, eventUrl, cancelUrl, waitlistPosition, isGuest } = params;

  const subject = `You're on the waitlist for ${eventTitle} — The Denver Songwriters Collective`;

  const positionText = waitlistPosition !== undefined
    ? `You're <strong>#${waitlistPosition}</strong> on the waitlist.`
    : "You're on the waitlist.";

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Thanks for your interest in <strong>${safeTitle}</strong>!`)}

${paragraph(positionText)}

<p style="margin: 12px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; font-style: italic;">
  RSVP means you plan to attend. It is not a performer sign-up.
</p>

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
        ${safeAddress ? `<p style="margin: 4px 0 0 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">${safeAddress}</p>` : ""}
      </td>
    </tr>
  </table>
</div>

<div style="background-color: ${EMAIL_COLORS.warningBg}; border: 1px solid ${EMAIL_COLORS.warningBorder}; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
  <p style="margin: 0; color: ${EMAIL_COLORS.warning}; font-size: 15px; font-weight: 500;">
    We'll email you right away if a spot opens up.
  </p>
</div>

${paragraph("Spots open up more often than you'd think—keep an eye on your inbox!", { muted: true })}

${eventCard(eventTitle, eventUrl)}

${isGuest ? "" : rsvpsDashboardLink()}

${createSecondaryLink("Remove me from the waitlist", cancelUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Thanks for your interest in ${eventTitle}!

${waitlistPosition !== undefined ? `You're #${waitlistPosition} on the waitlist.` : "You're on the waitlist."}

(RSVP means you plan to attend. It is not a performer sign-up.)

WHEN: ${safeDate} at ${safeTime}
WHERE: ${safeVenue}${safeAddress ? `\n${safeAddress}` : ""}

We'll email you right away if a spot opens up.

Spots open up more often than you'd think—keep an eye on your inbox!

View happening: ${eventUrl}
${isGuest ? "" : `\nView all your RSVPs: ${SITE_URL}/dashboard/my-rsvps\n`}
Remove me from the waitlist: ${cancelUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
