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
  SITE_URL,
} from "../render";

export type SuggestionStatus = "approved" | "rejected" | "needs_info";

export interface SuggestionResponseEmailParams {
  submitterName?: string | null;
  status: SuggestionStatus;
  isNewEvent: boolean;
  eventTitle?: string | null;
  adminMessage: string;
}

const STATUS_CONFIG = {
  approved: {
    subjectNew: "Your open mic submission is live! — The Denver Songwriters Collective",
    subjectEdit: "Your suggestion was approved! — The Denver Songwriters Collective",
    emoji: "🎉",
    boxBg: "#22c55e15",
    boxBorder: "#22c55e30",
    boxColor: "#22c55e",
    headlineNew: "Your open mic is now live on Denver Songwriters Collective!",
    headlineEdit: "Your correction has been applied!",
  },
  rejected: {
    subjectNew: "About your open mic submission — The Denver Songwriters Collective",
    subjectEdit: "About your suggestion — The Denver Songwriters Collective",
    emoji: "💬",
    boxBg: "#f5f5f515",
    boxBorder: "#52525230",
    boxColor: "#a3a3a3",
    headlineNew: "We weren't able to add this open mic just yet.",
    headlineEdit: "We weren't able to make this change.",
  },
  needs_info: {
    subjectNew: "Quick question about your open mic submission — The Denver Songwriters Collective",
    subjectEdit: "Quick question about your suggestion — The Denver Songwriters Collective",
    emoji: "🤔",
    boxBg: "#f59e0b15",
    boxBorder: "#f59e0b30",
    boxColor: "#f59e0b",
    headlineNew: "We'd love a bit more info before adding this!",
    headlineEdit: "We need a bit more info to make this change.",
  },
};

export function getSuggestionResponseEmail(params: SuggestionResponseEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { submitterName, status, isNewEvent, eventTitle, adminMessage } = params;
  const config = STATUS_CONFIG[status];

  const subject = isNewEvent ? config.subjectNew : config.subjectEdit;

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
    closing = "Just reply to this email with any additional info and we'll take another look!";
  }

  const htmlContent = `
${paragraph(getGreeting(submitterName))}

${paragraph(opening)}

<div style="background-color: ${config.boxBg}; border: 1px solid ${config.boxBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 8px 0; color: ${config.boxColor}; font-size: 15px; font-weight: 600;">
    ${config.emoji} ${headline}
  </p>
  ${eventTitle ? `<p style="margin: 0; color: #737373; font-size: 14px;">Re: ${escapeHtml(eventTitle)}</p>` : ""}
</div>

${adminMessage ? `
<div style="background-color: #262626; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 3px solid #d4a853;">
  <p style="margin: 0 0 8px 0; color: #737373; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
    From the DSC team:
  </p>
  <p style="margin: 0; color: #e5e5e5; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
${escapeHtml(adminMessage)}
  </p>
</div>
` : ""}

${paragraph(closing)}

${status === "approved" && isNewEvent ? createButton("Check it out", `${SITE_URL}/happenings?type=open_mic`, "green") : ""}
${status === "approved" && !isNewEvent ? createButton("View open mics", `${SITE_URL}/happenings?type=open_mic`) : ""}
${status === "needs_info" ? createButton("Submit more info", `${SITE_URL}/submit-open-mic`) : ""}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${getGreeting(submitterName)}

${opening}

${headline}
${eventTitle ? `Re: ${eventTitle}` : ""}

${adminMessage ? `From the DSC team:\n${adminMessage}` : ""}

${closing}

${status === "approved" ? `Check it out: ${SITE_URL}/happenings?type=open_mic` : ""}
${status === "needs_info" ? `Submit more info: ${SITE_URL}/submit-open-mic` : ""}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
