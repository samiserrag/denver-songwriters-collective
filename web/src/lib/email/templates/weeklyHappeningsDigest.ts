/**
 * Weekly Happenings Digest Email Template
 *
 * Sent every Sunday night (8:00 PM Denver time) listing ALL upcoming happenings
 * for the next 7 days (Sunday through Saturday).
 *
 * GTM-1 MVP:
 * - No personalization (all recipients get same list)
 * - Simple day-grouped list format
 * - Links to event detail pages
 * - Unsubscribe links to /dashboard/settings
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  EMAIL_COLORS,
  SITE_URL,
} from "../render";
import type { HappeningOccurrence } from "@/lib/digest/weeklyHappenings";
import { formatTimeDisplay } from "@/lib/digest/weeklyHappenings";
import { EVENT_TYPE_CONFIG } from "@/types/events";

// ============================================================
// Types
// ============================================================

export interface WeeklyHappeningsDigestParams {
  /** Recipient's first name (null for "friend" fallback) */
  firstName: string | null;
  /** Happenings grouped by date key */
  byDate: Map<string, HappeningOccurrence[]>;
  /** Total count of happenings */
  totalCount: number;
  /** Total count of unique venues */
  venueCount: number;
}

// ============================================================
// HTML Helpers
// ============================================================

function getEventTypeEmoji(eventType: string): string {
  const config = EVENT_TYPE_CONFIG[eventType as keyof typeof EVENT_TYPE_CONFIG];
  return config?.icon || "🎵";
}

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

function formatHappeningHtml(occurrence: HappeningOccurrence): string {
  const { event } = occurrence;
  const eventUrl = `${SITE_URL}/events/${event.slug || event.id}?date=${occurrence.dateKey}`;
  const time = formatTimeDisplay(event.start_time);
  const venue = event.venue?.name || "Location TBD";
  const cost = event.is_free ? "Free" : event.cost_label || "";
  const emoji = getEventTypeEmoji(event.event_type);

  // Build venue + cost line
  const metaParts = [time, venue, cost].filter(Boolean);
  const metaLine = metaParts.join(" · ");

  return `
    <tr>
      <td style="padding: 12px 0;">
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          <tr>
            <td style="vertical-align: top; padding-right: 12px;">
              <span style="font-size: 20px;">${emoji}</span>
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
          No happenings scheduled this week.
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

function formatHappeningText(occurrence: HappeningOccurrence): string {
  const { event } = occurrence;
  const eventUrl = `${SITE_URL}/events/${event.slug || event.id}?date=${occurrence.dateKey}`;
  const time = formatTimeDisplay(event.start_time);
  const venue = event.venue?.name || "Location TBD";
  const cost = event.is_free ? "Free" : event.cost_label || "";
  const emoji = getEventTypeEmoji(event.event_type);

  const lines = [
    `${emoji} ${event.title}`,
    `   ${time} · ${venue}${cost ? ` · ${cost}` : ""}`,
    `   ${eventUrl}`,
  ];

  return lines.join("\n");
}

// ============================================================
// Main Template Function
// ============================================================

export function getWeeklyHappeningsDigestEmail(
  params: WeeklyHappeningsDigestParams
): { subject: string; html: string; text: string } {
  const { firstName, byDate, totalCount, venueCount } = params;

  const subject = "Happenings This Week in Denver";

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
        eventsHtml += formatHappeningHtml(occurrence);
      }
    }
  }

  // Summary line
  const summaryText = totalCount === 0
    ? ""
    : `That's ${totalCount} happening${totalCount === 1 ? "" : "s"} across ${venueCount} venue${venueCount === 1 ? "" : "s"} this week.`;

  const htmlContent = `
    ${getGreeting(firstName)}

    <p style="margin: 0 0 16px 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.6;">
      Here's what's happening in the Denver songwriter community this week.
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
          <a href="${SITE_URL}/happenings" style="display: inline-block; padding: 14px 28px; color: ${EMAIL_COLORS.textOnAccent}; text-decoration: none; font-weight: 600; font-size: 15px;">
            Browse All Happenings
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 16px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; font-style: italic;">
      Want to see more or tailor this to you? Browse all happenings with your filters applied!
    </p>

    <hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.border}; margin: 24px 0;" />

    <p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px;">
      You're receiving this because you opted in to event updates.
      <a href="${SITE_URL}/dashboard/settings" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">Manage your email preferences</a>
    </p>
  `;

  const html = wrapEmailHtml(htmlContent);

  // ============================================================
  // Plain Text Version
  // ============================================================

  let eventsText = "";

  if (totalCount === 0) {
    eventsText = "\nNo happenings scheduled this week.\nCheck back soon — new happenings are added regularly!";
  } else {
    const sortedDates = Array.from(byDate.keys()).sort();

    for (const dateKey of sortedDates) {
      const occurrences = byDate.get(dateKey) || [];
      eventsText += formatDayHeaderText(dateKey) + "\n";

      for (const occurrence of occurrences) {
        eventsText += "\n" + formatHappeningText(occurrence) + "\n";
      }
    }
  }

  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  const textParts = [
    greeting,
    "",
    "Here's what's happening in the Denver songwriter community this week.",
    eventsText,
    "",
    summaryText,
    "",
    `Browse All Happenings: ${SITE_URL}/happenings`,
    "",
    "Want to see more or tailor this to you? Browse all happenings with your filters applied!",
    "",
    "---",
    "You're receiving this because you opted in to event updates.",
    `Manage your email preferences: ${SITE_URL}/dashboard/settings`,
  ].filter((line) => line !== undefined);

  const text = wrapEmailText(textParts.join("\n"));

  return { subject, html, text };
}
