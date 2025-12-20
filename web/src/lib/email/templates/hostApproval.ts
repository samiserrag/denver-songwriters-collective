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
  SITE_URL,
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

  const subject = "You're approved as a host!";

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph("Congratulations! Your request to become a host has been approved.")}

<div style="background-color: #22c55e15; border: 1px solid #22c55e30; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; color: #22c55e; font-size: 15px; font-weight: 500;">
    Your host privileges are now active!
  </p>
</div>

${paragraph("As a host, you can:")}

<ul style="margin: 0 0 24px 0; padding-left: 20px; color: #a3a3a3; font-size: 15px; line-height: 1.8;">
  <li>Create and manage your own events</li>
  <li>Track RSVPs and manage your lineup</li>
  <li>Be featured in the community directory</li>
</ul>

${paragraph("We can't wait to see what you create!", { muted: true })}

${createButton("Create your first event", dashboardUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `Hi ${safeName},

Congratulations! Your request to become a host has been approved.

Your host privileges are now active!

As a host, you can:
- Create and manage your own events
- Track RSVPs and manage your lineup
- Be featured in the community directory

We can't wait to see what you create!

Get started: ${dashboardUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
