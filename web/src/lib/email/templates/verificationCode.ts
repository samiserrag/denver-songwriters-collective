/**
 * Verification Code Email Template
 *
 * Sent from POST /api/guest/request-code, /api/guest/rsvp/request-code, /api/guest/event-comment/request-code
 * Contains 6-digit verification code for guest actions (slot claims, RSVPs, comments).
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

export type VerificationPurpose = "slot" | "rsvp" | "comment";

export interface VerificationCodeEmailParams {
  guestName: string | null;
  eventTitle: string;
  code: string;
  expiresInMinutes: number;
  /** Purpose of verification: slot claim, RSVP, or comment. Defaults to "slot" for backwards compatibility. */
  purpose?: VerificationPurpose;
}

const PURPOSE_COPY: Record<VerificationPurpose, { action: string; confirm: string }> = {
  slot: {
    action: "claim a slot at",
    confirm: "Enter this code on the event page to confirm your spot.",
  },
  rsvp: {
    action: "RSVP to",
    confirm: "Enter this code on the event page to confirm your RSVP.",
  },
  comment: {
    action: "post a comment on",
    confirm: "Enter this code on the event page to post your comment.",
  },
};

export function getVerificationCodeEmail(params: VerificationCodeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { guestName, eventTitle, code, expiresInMinutes, purpose = "slot" } = params;
  const safeEventTitle = escapeHtml(eventTitle);
  const copy = PURPOSE_COPY[purpose];

  // Subject
  const subject = `Your code for ${eventTitle} — The Denver Songwriters Collective`;

  // HTML content
  const htmlContent = `
${paragraph(getGreeting(guestName))}

${paragraph(`You requested a code to ${copy.action} <strong>${safeEventTitle}</strong>:`)}

${codeBlock(code)}

${expiryWarning(`This code expires in ${expiresInMinutes} minutes.`)}

${paragraph(copy.confirm, { muted: true })}

${paragraph("If you didn't request this code, you can safely ignore this email.", { muted: true })}
`;

  const html = wrapEmailHtml(htmlContent);

  // Plain text
  const textContent = `${guestName?.trim() ? `Hi ${guestName.trim()},` : "Hi there,"}

You requested a code to ${copy.action} ${eventTitle}:

${code}

This code expires in ${expiresInMinutes} minutes.

${copy.confirm}

If you didn't request this code, you can safely ignore this email.`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
