/**
 * Host Approval Email Template
 *
 * Sent when an admin approves a host application.
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

export interface HostApprovalEmailParams {
  userName: string;
}

export function getHostApprovalEmail(params: HostApprovalEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName } = params;
  const safeName = escapeHtml(userName);
  const dashboardUrl = `${SITE_URL}/dashboard/my-events`;

  const subject = "You're approved as a host! — The Colorado Songwriters Collective";

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph("Congratulations! Your request to become a host has been approved.")}

${successBox("🎉", "Your host privileges are now active!")}

${paragraph("As an approved host, you can:")}

<ul style="margin: 0 0 24px 0; padding-left: 20px; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.8;">
  <li>Create CSC official events</li>
  <li>Track RSVPs and manage your lineup</li>
  <li>Be featured in the community directory</li>
</ul>

${paragraph("We can't wait to see what you create!", { muted: true })}

${createButton("Create your first event", dashboardUrl, "green")}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `Hi ${safeName},

Congratulations! Your request to become a host has been approved.

Your host privileges are now active!

As an approved host, you can:
- Create CSC official events
- Track RSVPs and manage your lineup
- Be featured in the community directory

We can't wait to see what you create!

Get started: ${dashboardUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
