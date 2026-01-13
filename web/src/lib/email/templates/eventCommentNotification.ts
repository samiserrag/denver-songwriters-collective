/**
 * Event Comment Notification Email Template
 *
 * Sent when someone comments on an event or replies to a comment.
 * Part of the event_updates notification category.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

export interface EventCommentNotificationEmailParams {
  /** Event title */
  eventTitle: string;
  /** Full URL to event with #comments anchor */
  eventUrl: string;
  /** Name of the person who commented */
  commenterName: string;
  /** Preview of the comment content (truncated) */
  commentPreview: string;
  /** Whether this is a reply notification */
  isReply: boolean;
  /** Recipient's name (optional) */
  recipientName?: string | null;
  /** Phase ABC6: Occurrence date for per-occurrence context (e.g., "Sat, Jan 18") */
  occurrenceDate?: string;
}

export function getEventCommentNotificationEmail(params: EventCommentNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    eventTitle,
    eventUrl,
    commenterName,
    commentPreview,
    isReply,
    recipientName,
    occurrenceDate,
  } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeCommenter = escapeHtml(commenterName);
  const safePreview = escapeHtml(commentPreview);
  // Phase ABC6: Include occurrence date in subject and message for context
  const dateText = occurrenceDate ? ` (${occurrenceDate})` : "";

  const subject = isReply
    ? `${commenterName} replied to your comment`
    : `New comment on "${eventTitle}"${dateText}`;

  // HTML version
  const htmlContent = `
    ${getGreeting(recipientName)}

    ${paragraph(
      isReply
        ? `<strong>${safeCommenter}</strong> replied to your comment on <strong>"${safeTitle}"</strong>${dateText}:`
        : `<strong>${safeCommenter}</strong> left a comment on your happening <strong>"${safeTitle}"</strong>${dateText}:`
    )}

    <!-- Comment preview box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="background-color: ${EMAIL_COLORS.bgMuted}; border-left: 4px solid ${EMAIL_COLORS.accent}; padding: 16px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.5; font-style: italic;">
            "${safePreview}${commentPreview.length >= 200 ? "..." : ""}"
          </p>
        </td>
      </tr>
    </table>

    ${createButton("View Comment", eventUrl)}

    ${paragraph(
      `<span style="color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
        You're receiving this email because you ${isReply ? "commented on this happening" : "are a host of this happening"}.
        You can adjust your notification preferences in your <a href="${SITE_URL}/dashboard/settings" style="color: ${EMAIL_COLORS.accent};">account settings</a>.
      </span>`
    )}
  `;

  const html = wrapEmailHtml(htmlContent);

  // Plain text version
  const textContent = `
${isReply ? `${commenterName} replied to your comment` : `New comment on "${eventTitle}"${dateText}`}

${isReply
  ? `${commenterName} replied to your comment on "${eventTitle}"${dateText}:`
  : `${commenterName} left a comment on your happening "${eventTitle}"${dateText}:`}

"${commentPreview}${commentPreview.length >= 200 ? "..." : ""}"

View the comment: ${eventUrl}

---
You're receiving this email because you ${isReply ? "commented on this happening" : "are a host of this happening"}.
Manage notifications: ${SITE_URL}/dashboard/settings
`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
