/**
 * Host Rejection Email Template
 *
 * Sent when an admin rejects a host application.
 * Handles the message with empathy and provides a path forward.
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

export interface HostRejectionEmailParams {
  userName: string;
  reason?: string;
}

export function getHostRejectionEmail(params: HostRejectionEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, reason } = params;
  const safeName = escapeHtml(userName);
  const safeReason = reason ? escapeHtml(reason) : null;
  const openMicsUrl = `${SITE_URL}/happenings?type=open_mic`;

  const subject = "Update on your host application — The Denver Songwriters Collective";

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph("Thanks for your interest in becoming a host with the Denver Songwriters Collective.")}

${paragraph("After reviewing your application, we're not able to approve your host request at this time.")}

${safeReason ? `
<div style="background-color: #262626; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 8px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Feedback</p>
  <p style="margin: 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">${safeReason}</p>
</div>
` : ""}

${paragraph("You're welcome to reapply in the future. In the meantime, we'd love to see you at community events!", { muted: true })}

${createButton("Explore open mics", openMicsUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `Hi ${safeName},

Thanks for your interest in becoming a host with the Denver Songwriters Collective.

After reviewing your application, we're not able to approve your host request at this time.
${safeReason ? `\nFeedback: ${safeReason}\n` : ""}
You're welcome to reapply in the future. In the meantime, we'd love to see you at community events!

Explore open mics: ${openMicsUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
