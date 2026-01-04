/**
 * Event Claim Rejected Email Template
 *
 * Sent when an admin rejects a user's claim for an event.
 * Similar tone to hostRejection.ts - empathetic, constructive.
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

export interface EventClaimRejectedEmailParams {
  userName?: string | null;
  eventTitle: string;
  reason?: string;
}

export function getEventClaimRejectedEmail(params: EventClaimRejectedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, eventTitle, reason } = params;
  const safeTitle = escapeHtml(eventTitle);
  const safeReason = reason ? escapeHtml(reason) : null;
  const happeningsUrl = `${SITE_URL}/happenings`;

  const subject = `Update on your claim for ${eventTitle} — The Denver Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Thanks for your interest in hosting <strong>${safeTitle}</strong>.`)}

${paragraph("After reviewing your claim, we're not able to approve it at this time.")}

${safeReason ? quoteBlock("Feedback", reason!) : ""}

${paragraph("If you have questions or think there's been a mix-up, feel free to reply to this email.", { muted: true })}

${paragraph("In the meantime, we'd love to see you at community events!", { muted: true })}

${createButton("Browse happenings", happeningsUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Thanks for your interest in hosting ${eventTitle}.

After reviewing your claim, we're not able to approve it at this time.
${safeReason ? `\nFeedback: ${safeReason}\n` : ""}
If you have questions or think there's been a mix-up, feel free to reply to this email.

In the meantime, we'd love to see you at community events!

Browse happenings: ${happeningsUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
