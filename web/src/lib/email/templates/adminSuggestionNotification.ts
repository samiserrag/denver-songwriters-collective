/**
 * Admin Suggestion Notification Email Template
 *
 * Sent to admin when a user submits an event update suggestion.
 * Similar tone to adminEventClaimNotification.ts - functional, admin-facing.
 */

import { escapeHtml } from "@/lib/highlight";
import { wrapEmailHtml, wrapEmailText, SITE_URL, EMAIL_COLORS } from "../render";

export interface AdminSuggestionNotificationEmailParams {
  submitterName?: string | null;
  submitterEmail?: string | null;
  eventTitle: string;
  eventId: string;
  eventSlug?: string | null;
  field: string;
  oldValue?: string | null;
  newValue: string;
  notes?: string | null;
}

export function getAdminSuggestionNotificationEmail(params: AdminSuggestionNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { submitterName, submitterEmail, eventTitle, eventId, eventSlug, field, oldValue, newValue, notes } = params;

  const safeName = escapeHtml(submitterName || "Anonymous");
  const safeTitle = escapeHtml(eventTitle);
  const safeField = escapeHtml(field);
  const safeOld = escapeHtml(oldValue || "(empty)");
  const safeNew = escapeHtml(newValue);
  const safeNotes = notes ? escapeHtml(notes) : null;

  const suggestionsUrl = `${SITE_URL}/dashboard/admin/event-update-suggestions`;
  const eventIdentifier = eventSlug || eventId;
  const eventUrl = `${SITE_URL}/events/${eventIdentifier}`;

  const subject = `[CSC Suggestion] ${safeName} suggested a change to ${safeTitle}`;

  const htmlContent = `
<p style="margin: 0 0 24px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.6;">
  New event update suggestion:
</p>

<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Submitted By</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 16px;">${safeName}${submitterEmail ? ` (${escapeHtml(submitterEmail)})` : ""}</p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Event</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.accent}; font-size: 16px;">
          <a href="${eventUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">${safeTitle}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Field Changed</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 16px;">${safeField}</p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Suggested Change</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 14px;">
          <span style="color: #ef4444; text-decoration: line-through;">${safeOld}</span>
          <span style="color: ${EMAIL_COLORS.textMuted};"> &rarr; </span>
          <span style="color: #22c55e; font-weight: 600;">${safeNew}</span>
        </p>
      </td>
    </tr>
    ${safeNotes ? `
    <tr>
      <td>
        <p style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Notes</p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px; font-style: italic;">${safeNotes}</p>
      </td>
    </tr>
    ` : ""}
  </table>
</div>

<table cellpadding="0" cellspacing="0">
  <tr>
    <td style="background-color: ${EMAIL_COLORS.accent}; border-radius: 8px;">
      <a href="${suggestionsUrl}" style="display: inline-block; padding: 12px 24px; color: ${EMAIL_COLORS.textOnAccent}; text-decoration: none; font-weight: 600; font-size: 14px;">
        Review Suggestions
      </a>
    </td>
  </tr>
</table>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `New Event Update Suggestion
============================

Submitted By: ${submitterName || "Anonymous"}${submitterEmail ? ` (${submitterEmail})` : ""}
Event: ${eventTitle}
Field: ${field}
Change: ${oldValue || "(empty)"} -> ${newValue}
${notes ? `Notes: ${notes}` : ""}

Review suggestions: ${suggestionsUrl}
View event: ${eventUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
