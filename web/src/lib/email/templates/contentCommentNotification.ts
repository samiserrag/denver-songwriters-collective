/**
 * Content Comment Notification Email Template
 *
 * Sent when someone comments on a gallery photo, album, blog post, or profile.
 * Part of the event_updates notification category (we use the same category for all comments).
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

export type ContentType = "photo" | "album" | "blog" | "profile" | "event";

export interface ContentCommentNotificationEmailParams {
  /** Type of content being commented on */
  contentType: ContentType;
  /** Title/name of the content (album name, blog post title, profile name) */
  contentTitle: string;
  /** Full URL to the content */
  contentUrl: string;
  /** Name of the person who commented */
  commenterName: string;
  /** Preview of the comment content (truncated) */
  commentPreview: string;
  /** Whether this is a reply notification */
  isReply: boolean;
  /** Recipient's name (optional) */
  recipientName?: string | null;
}

const CONTENT_TYPE_LABELS: Record<ContentType, { singular: string; ownerType: string }> = {
  photo: { singular: "photo", ownerType: "the photo uploader" },
  album: { singular: "album", ownerType: "the album owner" },
  blog: { singular: "blog post", ownerType: "the author" },
  profile: { singular: "profile", ownerType: "this profile" },
  event: { singular: "event", ownerType: "the event host" },
};

export function getContentCommentNotificationEmail(params: ContentCommentNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    contentType,
    contentTitle,
    contentUrl,
    commenterName,
    commentPreview,
    isReply,
    recipientName,
  } = params;

  const safeTitle = escapeHtml(contentTitle);
  const safeCommenter = escapeHtml(commenterName);
  const safePreview = escapeHtml(commentPreview);
  const labels = CONTENT_TYPE_LABELS[contentType];

  const subject = isReply
    ? `${commenterName} replied to your comment`
    : `New comment on your ${labels.singular}${contentType !== "profile" ? ` "${contentTitle}"` : ""}`;

  // HTML version
  const htmlContent = `
    ${getGreeting(recipientName)}

    ${paragraph(
      isReply
        ? `<strong>${safeCommenter}</strong> replied to your comment on ${contentType === "profile" ? "your profile" : `<strong>"${safeTitle}"</strong>`}:`
        : `<strong>${safeCommenter}</strong> left a comment on your ${labels.singular}${contentType !== "profile" ? ` <strong>"${safeTitle}"</strong>` : ""}:`
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

    ${createButton("View Comment", contentUrl)}

    ${paragraph(
      `<span style="color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
        You're receiving this email because you are ${isReply ? "the comment author" : labels.ownerType}.
        You can adjust your notification preferences in your <a href="${SITE_URL}/dashboard/settings" style="color: ${EMAIL_COLORS.accent};">account settings</a>.
      </span>`
    )}
  `;

  const html = wrapEmailHtml(htmlContent);

  // Plain text version
  const textContent = `
${isReply ? `${commenterName} replied to your comment` : `New comment on your ${labels.singular}${contentType !== "profile" ? ` "${contentTitle}"` : ""}`}

${isReply
  ? `${commenterName} replied to your comment on ${contentType === "profile" ? "your profile" : `"${contentTitle}"`}:`
  : `${commenterName} left a comment on your ${labels.singular}${contentType !== "profile" ? ` "${contentTitle}"` : ""}:`}

"${commentPreview}${commentPreview.length >= 200 ? "..." : ""}"

View the comment: ${contentUrl}

---
You're receiving this email because you are ${isReply ? "the comment author" : labels.ownerType}.
Manage notifications: ${SITE_URL}/dashboard/settings
`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
