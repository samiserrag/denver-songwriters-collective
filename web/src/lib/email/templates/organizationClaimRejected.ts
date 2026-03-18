/**
 * Organization Claim Rejected Email Template
 *
 * Sent when an admin rejects a user's claim for an organization profile.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  quoteBlock,
  createButton,
  SITE_URL,
} from "../render";

export interface OrganizationClaimRejectedEmailParams {
  userName?: string | null;
  organizationName: string;
  organizationId: string;
  organizationSlug?: string | null;
  reason?: string | null;
}

export function getOrganizationClaimRejectedEmail(
  params: OrganizationClaimRejectedEmailParams
): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, organizationName, organizationId, organizationSlug, reason } = params;
  const safeName = escapeHtml(organizationName);
  const directoryUrl = `${SITE_URL}/friends-of-the-collective`;
  const identifier = organizationSlug || organizationId;
  const subject = `Update on your claim for ${organizationName} — The Colorado Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Thanks for your interest in managing <strong>${safeName}</strong>.`)}

${paragraph("After reviewing your claim, we're not able to approve it at this time.")}

${reason ? quoteBlock("Feedback", reason) : ""}

${paragraph("If you think there is a mix-up, please reply to this email and share any context we should review.", { muted: true })}

${createButton("View directory", directoryUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Thanks for your interest in managing ${organizationName}.

After reviewing your claim, we're not able to approve it at this time.
${reason ? `\nFeedback: ${reason}\n` : ""}
If you think there is a mix-up, please reply to this email and share any context we should review.

View directory: ${directoryUrl}
Reference: ${identifier}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
