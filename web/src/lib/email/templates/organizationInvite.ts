/**
 * Organization Invite Email Template
 *
 * Sent when a manager/admin creates an invite restricted to an email.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
} from "../render";

export interface OrganizationInviteEmailParams {
  recipientName?: string | null;
  organizationName: string;
  inviterName?: string | null;
  inviteUrl: string;
  expiresAtIso: string;
  roleToGrant: "owner" | "manager";
}

export function getOrganizationInviteEmail(
  params: OrganizationInviteEmailParams
): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    recipientName,
    organizationName,
    inviterName,
    inviteUrl,
    expiresAtIso,
    roleToGrant,
  } = params;
  const safeName = escapeHtml(organizationName);
  const safeInviter = inviterName ? escapeHtml(inviterName) : "A CSC teammate";
  const expiryDate = new Date(expiresAtIso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `You're invited to manage ${organizationName} — The Colorado Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(recipientName))}

${paragraph(`${safeInviter} invited you to help manage the organization profile for <strong>${safeName}</strong> on The Colorado Songwriters Collective.`)}

${paragraph(`Accepting this invite will grant you <strong>${roleToGrant}</strong> access for this organization profile.`)}

${createButton("Accept organization invite", inviteUrl)}

${paragraph(`This invite expires on ${expiryDate}.`, { muted: true })}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${recipientName?.trim() ? `Hi ${recipientName.trim()},` : "Hi there,"}

${inviterName || "A CSC teammate"} invited you to help manage the organization profile for ${organizationName} on The Colorado Songwriters Collective.

Accepting this invite will grant you ${roleToGrant} access for this organization profile.

Accept invite: ${inviteUrl}

This invite expires on ${expiryDate}.`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
