/**
 * Waitlist Offer Email Template
 *
 * Sent when a spot opens up and a waitlisted guest is promoted to "offered" status.
 * Contains confirm and cancel/pass links with clear expiry language.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  createSecondaryLink,
  EMAIL_COLORS,
} from "../render";

export interface WaitlistOfferEmailParams {
  guestName: string | null;
  eventTitle: string;
  confirmUrl: string;
  cancelUrl: string;
  expiresAt: string; // ISO timestamp
}

export function getWaitlistOfferEmail(params: WaitlistOfferEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { guestName, eventTitle, confirmUrl, cancelUrl, expiresAt } = params;
  const safeEventTitle = escapeHtml(eventTitle);

  // Format expiry time
  const expiryDate = new Date(expiresAt);
  const formattedExpiry = expiryDate.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  const subject = `A spot just opened up at ${eventTitle} — The Denver Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(guestName))}

${paragraph(`Good news! A spot just opened up at <strong>${safeEventTitle}</strong>, and you're next in line.`)}

<div style="background-color: ${EMAIL_COLORS.successBg}; border: 1px solid ${EMAIL_COLORS.successBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; color: ${EMAIL_COLORS.success}; font-size: 15px; font-weight: 500;">
    Confirm by ${escapeHtml(formattedExpiry)} to lock in your spot.
  </p>
</div>

${createButton("Confirm my spot", confirmUrl, "green")}

${paragraph("If you can't make it, no worries — just let us know so we can offer the spot to someone else.", { muted: true })}

${createSecondaryLink("I can't make it", cancelUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${guestName?.trim() ? `Hi ${guestName.trim()},` : "Hi there,"}

Good news! A spot just opened up at ${eventTitle}, and you're next in line.

Confirm by ${formattedExpiry} to lock in your spot.

CONFIRM MY SPOT: ${confirmUrl}

If you can't make it, no worries — just let us know so we can offer the spot to someone else.

I can't make it: ${cancelUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
