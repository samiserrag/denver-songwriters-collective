/**
 * Weekly Open Mics Digest Email Template
 *
 * Sent every Sunday night (8:00 PM Denver time) listing upcoming open mics
 * for the next 7 days (Sunday through Saturday).
 *
 * Phase 1 MVP:
 * - No personalization (all recipients get same list)
 * - Simple day-grouped list format
 * - Links to event detail pages
 *
 * GTM-2:
 * - HMAC-signed one-click unsubscribe link (no login required)
 * - Warm community-forward footer copy
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  EMAIL_COLORS,
  SITE_URL,
} from "../render";
import type { OpenMicOccurrence } from "@/lib/digest/weeklyOpenMics";
import { formatTimeDisplay } from "@/lib/digest/weeklyOpenMics";
import { buildUnsubscribeUrl } from "@/lib/digest/unsubscribeToken";
import {
  INVITE_CTA_BODY,
  INVITE_CTA_HEADLINE,
  INVITE_CTA_LABEL,
} from "@/lib/referrals";

// ============================================================
// Types
// ============================================================

export interface WeeklyOpenMicsDigestParams {
  /** Recipient's first name (null for "friend" fallback) */
  firstName: string | null;
  /** Recipient's user ID (for HMAC unsubscribe link) */
  userId: string;
  /** Open mics grouped by date key */
  byDate: Map<string, OpenMicOccurrence[]>;
  /** Total count of open mics */
  totalCount: number;
  /** Total count of unique venues */
  venueCount: number;
}

// ============================================================
// HTML Helpers
// ============================================================

function formatDayHeaderHtml(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  }).toUpperCase();

  return `
    <tr>
      <td style="padding: 24px 0 12px 0; border-bottom: 2px solid ${EMAIL_COLORS.border};">
        <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">
          ${escapeHtml(formatted)}
        </p>
      </td>
    </tr>
  `;
}

function formatOpenMicHtml(occurrence: OpenMicOccurrence): string {
  const { event } = occurrence;
  const eventUrl = `${SITE_URL}/events/${event.slug || event.id}?date=${occurrence.dateKey}`;
  const time = formatTimeDisplay(event.start_time);
  const venue = event.venue?.name || "Location TBD";
  const cost = event.is_free ? "Free" : event.cost_label || "";

  // Build venue + cost line
  const metaParts = [time, venue, cost].filter(Boolean);
  const metaLine = metaParts.join(" · ");

  return `
    <tr>
      <td style="padding: 12px 0;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="vertical-align: top; padding-right: 12px;">
              <span style="font-size: 20px;">🎤</span>
            </td>
            <td style="vertical-align: top; width: 100%;">
              <a href="${eventUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none; font-size: 15px; font-weight: 600;">
                ${escapeHtml(event.title)}
              </a>
              <p style="margin: 4px 0 0 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">
                ${escapeHtml(metaLine)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function formatEmptyStateHtml(): string {
  return `
    <tr>
      <td style="padding: 32px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px;">
          No open mics scheduled this week.
        </p>
        <p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">
          Check back soon — new happenings are added regularly!
        </p>
      </td>
    </tr>
  `;
}

// ============================================================
// Text Helpers
// ============================================================

function formatDayHeaderText(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  }).toUpperCase();

  return `\n────────────────────────────────\n${formatted}\n────────────────────────────────`;
}

function formatOpenMicText(occurrence: OpenMicOccurrence): string {
  const { event } = occurrence;
  const eventUrl = `${SITE_URL}/events/${event.slug || event.id}?date=${occurrence.dateKey}`;
  const time = formatTimeDisplay(event.start_time);
  const venue = event.venue?.name || "Location TBD";
  const cost = event.is_free ? "Free" : event.cost_label || "";

  const lines = [
    `🎤 ${event.title}`,
    `   ${time} · ${venue}${cost ? ` · ${cost}` : ""}`,
    `   ${eventUrl}`,
  ];

  return lines.join("\n");
}

// ============================================================
// Main Template Function
// ============================================================

export function getWeeklyOpenMicsDigestEmail(
  params: WeeklyOpenMicsDigestParams
): { subject: string; html: string; text: string } {
  const { firstName, userId, byDate, totalCount, venueCount } = params;

  // Build one-click unsubscribe URL (HMAC-signed, no login required)
  const unsubscribeUrl = buildUnsubscribeUrl(userId) || `${SITE_URL}/dashboard/settings`;
  const inviteUrl = `${SITE_URL}/`;

  const subject = "🎤 Open Mics This Week in Denver";

  // ============================================================
  // HTML Version
  // ============================================================

  let eventsHtml = "";

  if (totalCount === 0) {
    eventsHtml = formatEmptyStateHtml();
  } else {
    // Sort date keys chronologically
    const sortedDates = Array.from(byDate.keys()).sort();

    for (const dateKey of sortedDates) {
      const occurrences = byDate.get(dateKey) || [];
      eventsHtml += formatDayHeaderHtml(dateKey);

      for (const occurrence of occurrences) {
        eventsHtml += formatOpenMicHtml(occurrence);
      }
    }
  }

  // Summary line
  const summaryText = totalCount === 0
    ? ""
    : `That's ${totalCount} open mic${totalCount === 1 ? "" : "s"} across ${venueCount} venue${venueCount === 1 ? "" : "s"} this week.`;

  const htmlContent = `
    ${getGreeting(firstName)}

    <p style="margin: 0 0 16px 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.6;">
      Here are the open mics happening this week:
    </p>

    <table cellpadding="0" cellspacing="0" style="width: 100%;">
      ${eventsHtml}
    </table>

    ${summaryText ? `
    <p style="margin: 24px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">
      ${escapeHtml(summaryText)}
    </p>
    ` : ""}

    <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${EMAIL_COLORS.accent}; border-radius: 8px;">
          <a href="${SITE_URL}/happenings?type=open_mic" style="display: inline-block; padding: 14px 28px; color: ${EMAIL_COLORS.textOnAccent}; text-decoration: none; font-weight: 600; font-size: 15px;">
            Browse All Open Mics
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 4px 0 18px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">
      ${escapeHtml(INVITE_CTA_HEADLINE)} ${escapeHtml(INVITE_CTA_BODY)}
    </p>

    <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px;">
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; color: ${EMAIL_COLORS.accent}; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${escapeHtml(INVITE_CTA_LABEL)}
          </a>
        </td>
      </tr>
    </table>

    <hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.border}; margin: 24px 0;" />

    <p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
      You're receiving this weekly digest because you're part of the Denver Songwriters Collective community.
      If you'd rather not receive these, you can
      <a href="${unsubscribeUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">unsubscribe with one click</a>
      — you can always re-subscribe from your
      <a href="${SITE_URL}/dashboard/settings" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">settings</a>.
    </p>
    <p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
      Questions or feedback? Just reply to this email.
    </p>
  `;

  const html = wrapEmailHtml(htmlContent);

  // ============================================================
  // Plain Text Version
  // ============================================================

  let eventsText = "";

  if (totalCount === 0) {
    eventsText = "\nNo open mics scheduled this week.\nCheck back soon — new happenings are added regularly!";
  } else {
    const sortedDates = Array.from(byDate.keys()).sort();

    for (const dateKey of sortedDates) {
      const occurrences = byDate.get(dateKey) || [];
      eventsText += formatDayHeaderText(dateKey) + "\n";

      for (const occurrence of occurrences) {
        eventsText += "\n" + formatOpenMicText(occurrence) + "\n";
      }
    }
  }

  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  const textParts = [
    greeting,
    "",
    "Here are the open mics happening this week:",
    eventsText,
    "",
    summaryText,
    "",
    `Browse All Open Mics: ${SITE_URL}/happenings?type=open_mic`,
    `${INVITE_CTA_HEADLINE} ${INVITE_CTA_BODY} ${inviteUrl}`,
    "",
    "---",
    "You're receiving this weekly digest because you're part of the Denver Songwriters Collective community.",
    `If you'd rather not receive these, unsubscribe here: ${unsubscribeUrl}`,
    `You can always re-subscribe from your settings: ${SITE_URL}/dashboard/settings`,
    "",
    "Questions or feedback? Just reply to this email.",
  ].filter((line) => line !== undefined);

  const text = wrapEmailText(textParts.join("\n"));

  return { subject, html, text };
}
