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
  quoteBlock,
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
  const openMicsUrl = `${SITE_URL}/happenings?type=open_mic`;

  const subject = "Update on your host application — The Colorado Songwriters Collective";

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph("Thanks for your interest in becoming a host with The Colorado Songwriters Collective.")}

${paragraph("After reviewing your application, we're not able to approve your host request at this time.")}

${reason ? quoteBlock("Feedback", reason) : ""}

${paragraph("You're welcome to reapply in the future. In the meantime, we'd love to see you at community events!", { muted: true })}

${createButton("Explore open mics", openMicsUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `Hi ${safeName},

Thanks for your interest in becoming a host with The Colorado Songwriters Collective.

After reviewing your application, we're not able to approve your host request at this time.
${reason ? `\nFeedback: ${reason}\n` : ""}
You're welcome to reapply in the future. In the meantime, we'd love to see you at community events!

Explore open mics: ${openMicsUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
