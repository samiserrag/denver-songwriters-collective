/**
 * Organization Member Tagged Notification
 *
 * Sent when an organization manager/admin tags a member on an organization profile.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  createSecondaryLink,
} from "../render";

export interface OrganizationMemberTaggedEmailParams {
  recipientName?: string | null;
  organizationName: string;
  taggedByName?: string | null;
  directoryUrl: string;
  removeTagUrl: string;
}

export function getOrganizationMemberTaggedEmail(
  params: OrganizationMemberTaggedEmailParams
): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    recipientName,
    organizationName,
    taggedByName,
    directoryUrl,
    removeTagUrl,
  } = params;

  const safeOrg = escapeHtml(organizationName);
  const safeTaggedBy = taggedByName ? escapeHtml(taggedByName) : "A CSC organization manager";

  const subject = `You were added to ${organizationName} on The Colorado Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(recipientName))}

${paragraph(`${safeTaggedBy} added your member profile to <strong>${safeOrg}</strong> in Friends of the Collective.`)}

${paragraph("This helps visitors see that you're connected to this organization.")}

${createButton("View Friends Directory", directoryUrl)}

${paragraph("If this is incorrect or you prefer not to be listed, you can remove yourself from this organization profile:")}

${createSecondaryLink("Remove me from this organization", removeTagUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${recipientName?.trim() ? `Hi ${recipientName.trim()},` : "Hi there,"}

${taggedByName || "A CSC organization manager"} added your member profile to ${organizationName} in Friends of the Collective.

This helps visitors see that you're connected to this organization.

View Friends Directory: ${directoryUrl}

If this is incorrect or you prefer not to be listed, remove yourself here:
${removeTagUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
