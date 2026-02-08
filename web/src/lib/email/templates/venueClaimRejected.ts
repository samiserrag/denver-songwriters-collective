/**
 * Venue Claim Rejected Email Template - ABC8
 *
 * Sent when an admin rejects a user's claim for a venue.
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

export interface VenueClaimRejectedEmailParams {
  userName?: string | null;
  venueName: string;
  venueId: string;
  venueSlug?: string | null;
  reason?: string | null;
}

export function getVenueClaimRejectedEmail(params: VenueClaimRejectedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, venueName, venueId, venueSlug, reason } = params;
  const safeName = escapeHtml(venueName);
  const safeReason = reason ? escapeHtml(reason) : null;
  const venueIdentifier = venueSlug || venueId;
  const venueUrl = `${SITE_URL}/venues/${venueIdentifier}`;

  const subject = `Update on your claim for ${venueName} — The Colorado Songwriters Collective`;

  const htmlContent = `
${paragraph(getGreeting(userName))}

${paragraph(`Thanks for your interest in managing <strong>${safeName}</strong>.`)}

${paragraph("After reviewing your claim, we're not able to approve it at this time.")}

${safeReason ? quoteBlock("Feedback", reason!) : ""}

${paragraph("If you have questions or think there's been a mix-up, feel free to reply to this email.", { muted: true })}

${paragraph("In the meantime, we'd love to see you at community events!", { muted: true })}

${createButton("View venue", venueUrl)}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${userName?.trim() ? `Hi ${userName.trim()},` : "Hi there,"}

Thanks for your interest in managing ${venueName}.

After reviewing your claim, we're not able to approve it at this time.
${safeReason ? `\nFeedback: ${safeReason}\n` : ""}
If you have questions or think there's been a mix-up, feel free to reply to this email.

In the meantime, we'd love to see you at community events!

View venue: ${venueUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
