/**
 * Admin Event Claim Notification Email Template
 *
 * Sent to admin when a user submits a claim for an unclaimed event.
 * Similar tone to contactNotification.ts - functional, admin-facing.
 *
 * Note: Does NOT include requester's email in body (security/test requirement).
 * Links to admin claims page instead.
 */

import { escapeHtml } from "@/lib/highlight";
import { wrapEmailHtml, wrapEmailText, SITE_URL, EMAIL_COLORS } from "../render";

export interface AdminEventClaimNotificationEmailParams {
  requesterName: string;
  eventTitle: string;
  eventId: string;
  /** Prefer slug for SEO-friendly URLs, falls back to eventId */
  eventSlug?: string | null;
}

export function getAdminEventClaimNotificationEmail(params: AdminEventClaimNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { requesterName, eventTitle, eventId, eventSlug } = params;

  const safeName = escapeHtml(requesterName);
  const safeTitle = escapeHtml(eventTitle);

  const claimsUrl = `${SITE_URL}/dashboard/admin/claims`;
  // Prefer slug for SEO-friendly URLs, fallback to id
  const eventIdentifier = eventSlug || eventId;
  const eventUrl = `${SITE_URL}/events/${eventIdentifier}`;

  const subject = `[CSC Claim] ${requesterName} wants to host ${eventTitle}`;

  const htmlContent = `
<p style="margin: 0 0 24px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.6;">
  New event claim request:
</p>

<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Requester</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 16px;">${safeName}</p>
      </td>
    </tr>
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Event</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.accent}; font-size: 16px;">
          <a href="${eventUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">${safeTitle}</a>
        </p>
      </td>
    </tr>
  </table>
</div>

<table cellpadding="0" cellspacing="0">
  <tr>
    <td style="background-color: ${EMAIL_COLORS.accent}; border-radius: 8px;">
      <a href="${claimsUrl}" style="display: inline-block; padding: 12px 24px; color: ${EMAIL_COLORS.textOnAccent}; text-decoration: none; font-weight: 600; font-size: 14px;">
        Review claim
      </a>
    </td>
  </tr>
</table>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `New Event Claim Request
========================

Requester: ${requesterName}
Event: ${eventTitle}

Review claim: ${claimsUrl}
View event: ${eventUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
