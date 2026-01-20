/**
 * Suggestion Response Email Template
 *
 * Sent when an admin approves, rejects, or requests more info
 * for a community-submitted event suggestion.
 *
 * Tone: Warm, appreciative, encouraging — we love our contributors!
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  successBox,
  neutralBox,
  quoteBlock,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

export type SuggestionStatus = "approved" | "rejected" | "needs_info";

export interface SuggestionResponseEmailParams {
  submitterName?: string | null;
  status: SuggestionStatus;
  isNewEvent: boolean;
  eventTitle?: string | null;
  eventSlug?: string | null;
  eventId?: string | null;
  adminMessage: string;
}

const STATUS_CONFIG = {
  approved: {
    subjectNew: "Your open mic submission is live! — The Denver Songwriters Collective",
    subjectEdit: "Your suggestion was approved! — The Denver Songwriters Collective",
    emoji: "🎉",
    headlineNew: "Your open mic is now live on Denver Songwriters Collective!",
    headlineEdit: "Your correction has been applied!",
  },
  rejected: {
    subjectNew: "About your open mic submission — The Denver Songwriters Collective",
    subjectEdit: "About your suggestion — The Denver Songwriters Collective",
    emoji: "💬",
    headlineNew: "We weren't able to add this open mic just yet.",
    headlineEdit: "We weren't able to make this change.",
  },
  needs_info: {
    subjectNew: "Quick question about your open mic submission — The Denver Songwriters Collective",
    subjectEdit: "Quick question about your suggestion — The Denver Songwriters Collective",
    emoji: "🤔",
    headlineNew: "We'd love a bit more info before adding this!",
    headlineEdit: "We need a bit more info to make this change.",
  },
};

export function getSuggestionResponseEmail(params: SuggestionResponseEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { submitterName, status, isNewEvent, eventTitle, eventSlug, eventId, adminMessage } = params;
  const config = STATUS_CONFIG[status];

  const subject = isNewEvent ? config.subjectNew : config.subjectEdit;

  // Build event link if we have the info
  const eventLink = eventSlug
    ? `${SITE_URL}/open-mics/${eventSlug}`
    : eventId
    ? `${SITE_URL}/events/${eventId}`
    : null;

  // Personalized opening
  const openingLines = [
    "Thanks for being part of the Denver Songwriters Collective community!",
    "We really appreciate you taking the time to help keep our listings accurate.",
    "People like you make this community awesome.",
  ];
  const opening = openingLines[Math.floor(Math.random() * openingLines.length)];

  const headline = isNewEvent ? config.headlineNew : config.headlineEdit;

  // Closing based on status
  let closing = "";
  if (status === "approved") {
    closing = isNewEvent
      ? "Thanks for helping Denver musicians discover new places to play!"
      : "Thanks for keeping our community info accurate — it really helps!";
  } else if (status === "rejected") {
    closing = "No worries though! Feel free to resubmit if you have more details, or reach out if you have questions.";
  } else {
    // needs_info - always tell them to reply to email
    closing = "Just reply to this email with any additional info and we'll take another look!";
  }

  // Build status box based on type
  let statusBoxHtml = "";
  if (status === "approved") {
    statusBoxHtml = successBox(config.emoji, headline, eventTitle ? `Re: ${eventTitle}` : undefined);
  } else if (status === "rejected") {
    statusBoxHtml = neutralBox(config.emoji, headline, eventTitle ? `Re: ${eventTitle}` : undefined);
  } else {
    // needs_info - use warning style
    statusBoxHtml = `<div style="background-color: ${EMAIL_COLORS.warningBg}; border: 1px solid ${EMAIL_COLORS.warningBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.warning}; font-size: 15px; font-weight: 600;">
    ${config.emoji} ${escapeHtml(headline)}
  </p>
  ${eventTitle ? `<p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">Re: ${escapeHtml(eventTitle)}</p>` : ""}
</div>`;
  }

  const htmlContent = `
${paragraph(getGreeting(submitterName))}

${paragraph(opening)}

${statusBoxHtml}

${adminMessage ? quoteBlock("From the DSC team:", adminMessage) : ""}

${paragraph(closing)}

${status === "approved" && eventLink ? createButton("View the listing", eventLink, "green") : ""}
${status === "approved" && !eventLink ? createButton("View open mics", `${SITE_URL}/happenings?type=open_mic`, "green") : ""}
${status === "needs_info" && eventLink ? createButton("View the happening", eventLink) : ""}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${getGreeting(submitterName)}

${opening}

${headline}
${eventTitle ? `Re: ${eventTitle}` : ""}

${adminMessage ? `From the DSC team:\n${adminMessage}` : ""}

${closing}

${status === "approved" && eventLink ? `View the listing: ${eventLink}` : ""}
${status === "approved" && !eventLink ? `View open mics: ${SITE_URL}/happenings?type=open_mic` : ""}
${status === "needs_info" && eventLink ? `View the happening: ${eventLink}` : ""}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
