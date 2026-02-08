/**
 * Claim Confirmation Email Template
 *
 * Sent from POST /api/guest/verify-code
 * Two variants: confirmed (got the slot) or waitlist (on waitlist)
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createSecondaryLink,
  successBox,
  infoBox,
} from "../render";

export interface ClaimConfirmedEmailParams {
  guestName: string | null;
  eventTitle: string;
  slotNumber?: number;
  cancelUrl: string;
  status: "confirmed" | "waitlist";
  waitlistPosition?: number;
}

export function getClaimConfirmedEmail(params: ClaimConfirmedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { guestName, eventTitle, slotNumber, cancelUrl, status, waitlistPosition } = params;
  const safeEventTitle = escapeHtml(eventTitle);

  if (status === "confirmed") {
    return getConfirmedVariant(guestName, safeEventTitle, eventTitle, slotNumber, cancelUrl);
  } else {
    return getWaitlistVariant(guestName, safeEventTitle, eventTitle, waitlistPosition, cancelUrl);
  }
}

function getConfirmedVariant(
  guestName: string | null,
  safeEventTitle: string,
  eventTitle: string,
  slotNumber: number | undefined,
  cancelUrl: string
): { subject: string; html: string; text: string } {
  const subject = `You're on the lineup for ${eventTitle} — The Colorado Songwriters Collective`;

  const slotInfo = slotNumber !== undefined
    ? `You've got <strong>slot #${slotNumber}</strong>.`
    : "Your spot is confirmed.";

  const htmlContent = `
${paragraph(getGreeting(guestName))}

${paragraph(`Great news! You're confirmed for <strong>${safeEventTitle}</strong>.`)}

${paragraph(slotInfo)}

${successBox("🎵", "You're on the lineup!")}

${paragraph("Can't wait to hear you — see you soon!", { muted: true })}

${paragraph("Questions? Reach out to your host or post a comment on the event page.", { muted: true })}

${createSecondaryLink("I can't make it", cancelUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${guestName?.trim() ? `Hi ${guestName.trim()},` : "Hi there,"}

Great news! You're confirmed for ${eventTitle}.

${slotNumber !== undefined ? `You've got slot #${slotNumber}.` : "Your spot is confirmed."}

You're on the lineup!

Can't wait to hear you — see you soon!

Questions? Reach out to your host or post a comment on the event page.

Can't make it? Cancel here: ${cancelUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}

function getWaitlistVariant(
  guestName: string | null,
  safeEventTitle: string,
  eventTitle: string,
  waitlistPosition: number | undefined,
  cancelUrl: string
): { subject: string; html: string; text: string } {
  const subject = `You're on the waitlist for ${eventTitle} — The Colorado Songwriters Collective`;

  const positionInfo = waitlistPosition !== undefined
    ? `You're <strong>#${waitlistPosition}</strong> on the waitlist.`
    : "You're on the waitlist.";

  const htmlContent = `
${paragraph(getGreeting(guestName))}

${paragraph(`Thanks for signing up for <strong>${safeEventTitle}</strong>!`)}

${paragraph(positionInfo)}

${infoBox("📬", "We'll email you right away if a spot opens up.")}

${paragraph("Spots open up more often than you'd think — keep an eye on your inbox!", { muted: true })}

${createSecondaryLink("Remove me from the waitlist", cancelUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${guestName?.trim() ? `Hi ${guestName.trim()},` : "Hi there,"}

Thanks for signing up for ${eventTitle}!

${waitlistPosition !== undefined ? `You're #${waitlistPosition} on the waitlist.` : "You're on the waitlist."}

We'll email you right away if a spot opens up.

Spots open up more often than you'd think — keep an eye on your inbox!

Remove me from the waitlist: ${cancelUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
