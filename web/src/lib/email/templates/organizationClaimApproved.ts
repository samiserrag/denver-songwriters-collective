/**
 * Organization Claim Approved Email Template
 *
 * Sent when an admin approves a user's claim for an organization profile.
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

export interface OrganizationClaimApprovedEmailParams {
  userName?: string | null;
  organizationName: string;
  organizationId: string;
  organizationSlug?: string | null;
  role: "owner" | "manager";
}

export function getOrganizationClaimApprovedEmail(
  params: OrganizationClaimApprovedEmailParams
): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, organizationName, organizationId, organizationSlug, role } = params;
  const safeName = escapeHtml(organizationName);
  const identifier = organizationSlug || organizationId;
  const directoryUrl = `${SITE_URL}/friends-of-the-collective`;
  const dashboardUrl = `${SITE_URL}/dashboard/my-organizations/${organizationId}`;

  const roleLabel = role === "owner" ? "owner" : "manager";
  const subject = `You're now a ${roleLabel} of ${organizationName} — The Colorado Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Great news! Your claim for <strong>${safeName}</strong> has been approved.`)}

${successBox("🤝", `You're now an organization ${roleLabel}.`)}

${paragraph(`As an organization ${roleLabel}, you can:`)}

<ul style="margin: 0 0 24px 0; padding-left: 20px; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.8;">
  <li>Update your organization profile, links, and photos</li>
  <li>Keep your listing accurate for the songwriter community</li>
  <li>Invite teammates to help manage the profile</li>
</ul>

${createButton("Manage organization profile", dashboardUrl)}

<p style="margin: 24px 0 0 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">
  <a href="${directoryUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">View directory</a>
</p>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Great news! Your claim for ${organizationName} has been approved.

You're now an organization ${roleLabel}.

As an organization ${roleLabel}, you can:
- Update your organization profile, links, and photos
- Keep your listing accurate for the songwriter community
- Invite teammates to help manage the profile

Manage organization profile: ${dashboardUrl}
View directory: ${directoryUrl}
Reference: ${identifier}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
