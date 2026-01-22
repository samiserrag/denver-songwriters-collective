/**
 * Feedback Notification Email Template
 *
 * Sent to admin when someone submits feedback (bug, feature, or other).
 * This is an admin-facing email, so the tone is functional.
 */

import { escapeHtml } from "@/lib/highlight";
import { wrapEmailHtml, wrapEmailText, EMAIL_COLORS } from "../render";

export interface FeedbackNotificationEmailParams {
  category: "bug" | "feature" | "other";
  subject: string;
  description: string;
  pageUrl: string | null;
  name: string;
  email: string;
  submittedAt: string;
  attachments?: string[];
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  bug: { label: "Bug Report", color: "#ef4444" },
  feature: { label: "Feature Request", color: "#3b82f6" },
  other: { label: "Other Feedback", color: "#6b7280" },
};

export function getFeedbackNotificationEmail(params: FeedbackNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { category, subject, description, pageUrl, name, email, submittedAt, attachments = [] } = params;

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeDescription = escapeHtml(description);
  const safePageUrl = pageUrl ? escapeHtml(pageUrl) : null;

  const categoryInfo = CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
  const formattedDate = new Date(submittedAt).toLocaleString("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const emailSubject = `[DSC Feedback] ${categoryInfo.label}: ${subject.substring(0, 50)}${subject.length > 50 ? "..." : ""}`;

  const htmlContent = `
<p style="margin: 0 0 24px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.6;">
  New feedback submission:
</p>

<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Category</p>
        <span style="display: inline-block; padding: 4px 12px; background-color: ${categoryInfo.color}; color: white; border-radius: 12px; font-size: 13px; font-weight: 600;">
          ${categoryInfo.label}
        </span>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Subject</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 16px; font-weight: 600;">${safeSubject}</p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Description</p>
        <div style="background-color: ${EMAIL_COLORS.bgCard}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 6px; padding: 16px;">
          <p style="margin: 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safeDescription}</p>
        </div>
      </td>
    </tr>
    ${safePageUrl ? `
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Related Page</p>
        <p style="margin: 0;">
          <a href="${safePageUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: underline; font-size: 14px; word-break: break-all;">${safePageUrl}</a>
        </p>
      </td>
    </tr>
    ` : ""}
    ${attachments.length > 0 ? `
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Attachments (${attachments.length})</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${attachments.map((url, i) => `
            <a href="${escapeHtml(url)}" target="_blank" style="display: inline-block; padding: 8px 16px; background-color: ${EMAIL_COLORS.bgCard}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 6px; color: ${EMAIL_COLORS.accent}; text-decoration: none; font-size: 13px;">
              Screenshot ${i + 1}
            </a>
          `).join("")}
        </div>
      </td>
    </tr>
    ` : ""}
    <tr>
      <td style="padding-bottom: 8px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Submitted By</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px;">
          ${safeName} &lt;<a href="mailto:${safeEmail}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">${safeEmail}</a>&gt;
        </p>
      </td>
    </tr>
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Submitted At</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">${formattedDate} (MT)</p>
      </td>
    </tr>
  </table>
</div>

<table cellpadding="0" cellspacing="0">
  <tr>
    <td style="background-color: ${EMAIL_COLORS.accent}; border-radius: 8px;">
      <a href="mailto:${safeEmail}?subject=Re: ${encodeURIComponent(subject)}" style="display: inline-block; padding: 12px 24px; color: ${EMAIL_COLORS.textOnAccent}; text-decoration: none; font-weight: 600; font-size: 14px;">
        Reply to ${safeName}
      </a>
    </td>
  </tr>
</table>
`;

  const html = wrapEmailHtml(htmlContent);

  const attachmentsText = attachments.length > 0
    ? `\nAttachments:\n${attachments.map((url, i) => `  ${i + 1}. ${url}`).join("\n")}`
    : "";

  const textContent = `New Feedback Submission
========================

Category: ${categoryInfo.label}
Subject: ${subject}

Description:
${description}
${pageUrl ? `\nRelated Page: ${pageUrl}` : ""}${attachmentsText}

Submitted By: ${name} <${email}>
Submitted At: ${formattedDate} (MT)`;

  const text = wrapEmailText(textContent);

  return { subject: emailSubject, html, text };
}
