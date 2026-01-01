/**
 * Verification Code Email Template
 *
 * Sent from POST /api/guest/request-code
 * Contains 6-digit verification code for guest slot claims.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  codeBlock,
  expiryWarning,
} from "../render";

export interface VerificationCodeEmailParams {
  guestName: string | null;
  eventTitle: string;
  code: string;
  expiresInMinutes: number;
}

export function getVerificationCodeEmail(params: VerificationCodeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { guestName, eventTitle, code, expiresInMinutes } = params;
  const safeEventTitle = escapeHtml(eventTitle);

  // Subject
  const subject = `Your code for ${eventTitle} — The Denver Songwriters Collective`;

  // HTML content
  const htmlContent = `
${paragraph(getGreeting(guestName))}

${paragraph(`You requested a code to claim a slot at <strong>${safeEventTitle}</strong>:`)}

${codeBlock(code)}

${expiryWarning(`This code expires in ${expiresInMinutes} minutes.`)}

${paragraph("Enter this code on the event page to confirm your spot.", { muted: true })}

${paragraph("If you didn't request this code, you can safely ignore this email.", { muted: true })}
`;

  const html = wrapEmailHtml(htmlContent);

  // Plain text
  const textContent = `${guestName?.trim() ? `Hi ${guestName.trim()},` : "Hi there,"}

You requested a code to claim a slot at ${eventTitle}:

${code}

This code expires in ${expiresInMinutes} minutes.

Enter this code on the event page to confirm your spot.

If you didn't request this code, you can safely ignore this email.`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
