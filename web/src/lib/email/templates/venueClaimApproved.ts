/**
 * Venue Claim Approved Email Template - ABC8
 *
 * Sent when an admin approves a user's claim for a venue.
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

export interface VenueClaimApprovedEmailParams {
  userName?: string | null;
  venueName: string;
  venueId: string;
  /** Prefer slug for SEO-friendly URLs, falls back to venueId */
  venueSlug?: string | null;
  /** Role granted: 'owner' or 'manager' */
  role: "owner" | "manager";
}

export function getVenueClaimApprovedEmail(params: VenueClaimApprovedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, venueName, venueId, venueSlug, role } = params;
  const safeName = escapeHtml(venueName);
  const venueIdentifier = venueSlug || venueId;
  const venueUrl = `${SITE_URL}/venues/${venueIdentifier}`;
  const dashboardUrl = `${SITE_URL}/dashboard/my-venues`;

  const roleLabel = role === "owner" ? "owner" : "manager";
  const subject = `You're now a ${roleLabel} of ${venueName} — The Colorado Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Great news! Your claim for <strong>${safeName}</strong> has been approved.`)}

${successBox("🏠", `You're now a venue ${roleLabel}!`)}

${paragraph(`As a venue ${roleLabel}, you can:`)}

<ul style="margin: 0 0 24px 0; padding-left: 20px; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.8;">
  <li>Update venue information and details</li>
  <li>Manage happenings hosted at this venue</li>
  <li>Connect with the Denver songwriter community</li>
</ul>

${paragraph("Welcome to the table. We're glad you're here.", { muted: true })}

${createButton("Manage your venues", dashboardUrl)}

<p style="margin: 24px 0 0 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">
  <a href="${venueUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">View venue page</a>
</p>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Great news! Your claim for ${venueName} has been approved.

You're now a venue ${roleLabel}!

As a venue ${roleLabel}, you can:
- Update venue information and details
- Manage happenings hosted at this venue
- Connect with the Denver songwriter community

Welcome to the table. We're glad you're here.

Manage your venues: ${dashboardUrl}

View venue page: ${venueUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
