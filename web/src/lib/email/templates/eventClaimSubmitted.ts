/**
 * Event Claim Submitted Email Template
 *
 * Sent to the user when they submit a claim for an unclaimed event.
 * Confirms their claim is under review.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  SITE_URL,
} from "../render";

export interface EventClaimSubmittedEmailParams {
  userName?: string | null;
  eventTitle: string;
}

export function getEventClaimSubmittedEmail(params: EventClaimSubmittedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, eventTitle } = params;
  const safeTitle = escapeHtml(eventTitle);
  const happeningsUrl = `${SITE_URL}/happenings`;

  const subject = `Your claim for ${eventTitle} is under review — The Denver Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Thanks for claiming <strong>${safeTitle}</strong>. We've received your request and it's now under review.`)}

<div style="background-color: #f59e0b15; border: 1px solid #f59e0b30; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; color: #f59e0b; font-size: 15px; font-weight: 500;">
    We'll email you once your claim is approved or if we need more information.
  </p>
</div>

${paragraph("This usually takes 1-2 business days.", { muted: true })}

${paragraph(`In the meantime, check out other events in the community:`, { muted: true })}

<p style="margin: 0; color: #737373; font-size: 14px;">
  <a href="${happeningsUrl}" style="color: #d4a853; text-decoration: none;">Browse happenings</a>
</p>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Thanks for claiming ${eventTitle}. We've received your request and it's now under review.

We'll email you once your claim is approved or if we need more information.

This usually takes 1-2 business days.

In the meantime, check out other events in the community:
${happeningsUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
