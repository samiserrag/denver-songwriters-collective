/**
 * Event Claim Approved Email Template
 *
 * Sent when an admin approves a user's claim for an event.
 * Similar tone to hostApproval.ts - celebratory.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  successBox,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

export interface EventClaimApprovedEmailParams {
  userName?: string | null;
  eventTitle: string;
  eventId: string;
  /** Prefer slug for SEO-friendly URLs, falls back to eventId */
  eventSlug?: string | null;
}

export function getEventClaimApprovedEmail(params: EventClaimApprovedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, eventTitle, eventId, eventSlug } = params;
  const safeTitle = escapeHtml(eventTitle);
  // Prefer slug for SEO-friendly URLs, fallback to id
  const eventIdentifier = eventSlug || eventId;
  const eventUrl = `${SITE_URL}/events/${eventIdentifier}`;
  const dashboardUrl = `${SITE_URL}/dashboard/my-events`;

  const subject = `You're now the host of ${eventTitle} — The Denver Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Great news! Your claim for <strong>${safeTitle}</strong> has been approved.`)}

${successBox("🎉", "You're now the official host of this event!")}

${paragraph("As the host, you can:")}

<ul style="margin: 0 0 24px 0; padding-left: 20px; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.8;">
  <li>Edit event details (time, location, description)</li>
  <li>Manage RSVPs and the lineup</li>
  <li>Cancel or modify individual occurrences</li>
</ul>

${paragraph("Welcome to the table. We're glad you're here.", { muted: true })}

${createButton("Manage your event", dashboardUrl)}

<p style="margin: 24px 0 0 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">
  <a href="${eventUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">View event page</a>
</p>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Great news! Your claim for ${eventTitle} has been approved.

You're now the official host of this event!

As the host, you can:
- Edit event details (time, location, description)
- Manage RSVPs and the lineup
- Cancel or modify individual occurrences

Welcome to the table. We're glad you're here.

Manage your event: ${dashboardUrl}

View event page: ${eventUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
