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
  createButton,
  infoBox,
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

${infoBox("📋", "We'll email you once your claim is approved or if we need more information.")}

${paragraph("This usually takes 1-2 business days.", { muted: true })}

${paragraph(`In the meantime, check out other events in the community:`, { muted: true })}

${createButton("Browse happenings", happeningsUrl)}
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
