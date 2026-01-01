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
import { wrapEmailHtml, wrapEmailText, SITE_URL } from "../render";

export interface AdminEventClaimNotificationEmailParams {
  requesterName: string;
  eventTitle: string;
  eventId: string;
}

export function getAdminEventClaimNotificationEmail(params: AdminEventClaimNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { requesterName, eventTitle, eventId } = params;

  const safeName = escapeHtml(requesterName);
  const safeTitle = escapeHtml(eventTitle);

  const claimsUrl = `${SITE_URL}/dashboard/admin/claims`;
  const eventUrl = `${SITE_URL}/events/${eventId}`;

  const subject = `[DSC Claim] ${requesterName} wants to host ${eventTitle}`;

  const htmlContent = `
<p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">
  New event claim request:
</p>

<div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Requester</p>
        <p style="margin: 0; color: #ffffff; font-size: 16px;">${safeName}</p>
      </td>
    </tr>
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Event</p>
        <p style="margin: 0; color: #d4a853; font-size: 16px;">
          <a href="${eventUrl}" style="color: #d4a853; text-decoration: none;">${safeTitle}</a>
        </p>
      </td>
    </tr>
  </table>
</div>

<table cellpadding="0" cellspacing="0">
  <tr>
    <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); border-radius: 8px;">
      <a href="${claimsUrl}" style="display: inline-block; padding: 12px 24px; color: #0a0a0a; text-decoration: none; font-weight: 600; font-size: 14px;">
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
