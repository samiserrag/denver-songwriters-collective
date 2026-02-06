/**
 * Weekly Happenings Digest Email Template
 *
 * Sent every Sunday afternoon (4-5 PM Denver time) listing ALL upcoming happenings
 * for the next 7 days (Sunday through Saturday).
 *
 * GTM-1 MVP:
 * - No personalization (all recipients get same list)
 * - Simple day-grouped list format
 * - Links to event detail pages
 *
 * GTM-2:
 * - HMAC-signed one-click unsubscribe link (no login required)
 * - Warm community-forward footer copy
 *
 * GTM-3:
 * - Optional editorial sections (intro note, featured happenings, spotlights)
 * - Subject line override
 * - All editorial sections are optional — email renders normally without them
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  EMAIL_COLORS,
  SITE_URL,
  renderEmailBaseballCard,
} from "../render";
import type { HappeningOccurrence } from "@/lib/digest/weeklyHappenings";
import { formatTimeDisplay } from "@/lib/digest/weeklyHappenings";
import { EVENT_TYPE_CONFIG } from "@/types/events";
import { buildUnsubscribeUrl } from "@/lib/digest/unsubscribeToken";
import type { ResolvedEditorial } from "@/lib/digest/digestEditorial";

// ============================================================
// Types
// ============================================================

export interface WeeklyHappeningsDigestParams {
  /** Recipient's first name (null for "friend" fallback) */
  firstName: string | null;
  /** Recipient's user ID (for HMAC unsubscribe link) */
  userId: string;
  /** Happenings grouped by date key */
  byDate: Map<string, HappeningOccurrence[]>;
  /** Total count of happenings */
  totalCount: number;
  /** Total count of unique venues */
  venueCount: number;
  /** Optional editorial content (GTM-3) */
  editorial?: ResolvedEditorial;
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
// Editorial HTML Helpers (GTM-3)
// ============================================================

function formatIntroNoteHtml(introNote: string): string {
  const trimmed = introNote.trim();
  if (!trimmed) return "";

  const escaped = escapeHtml(trimmed);
  const paragraphs = escaped.split(/\n\s*\n/);
  const paragraphHtml = paragraphs
    .map((paragraph) => {
      const withBreaks = paragraph.replace(/\n/g, "<br>");
      return `<p style="margin: 0 0 12px 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.6; font-style: italic;">${withBreaks}</p>`;
    })
    .join("");

  return `
    <tr>
      <td style="padding: 0 0 20px 0;">
        ${paragraphHtml}
      </td>
    </tr>
  `;
}

function formatFeaturedEventHtml(
  featured: NonNullable<ResolvedEditorial["featuredHappenings"]>[number]
): string {
  const metaParts: string[] = [];
  if (featured.date) metaParts.push(escapeHtml(featured.date));
  if (featured.time) metaParts.push(escapeHtml(featured.time));
  if (featured.venue) {
    const venueText = escapeHtml(featured.venue);
    const venueLink = featured.venueUrl
      ? `<a href="${escapeHtml(featured.venueUrl)}" style="color: ${EMAIL_COLORS.textSecondary}; text-decoration: underline;">${venueText}</a>`
      : venueText;
    metaParts.push(venueLink);
  }
  const subtitleHtml = metaParts.length > 0 ? metaParts.join(" · ") : undefined;
  return `
    <tr>
      <td style="padding: 16px 0;">
        <p style="margin: 0 0 12px 0; color: ${EMAIL_COLORS.accent}; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">
          ⭐ FEATURED EVENT
        </p>
        ${renderEmailBaseballCard({
          coverUrl: featured.coverUrl,
          coverAlt: featured.title,
          title: featured.title,
          titleUrl: featured.url,
          subtitleHtml,
          ctaText: "View Happening",
          ctaUrl: featured.url,
        })}
      </td>
    </tr>
  `;
}

function formatFeaturedHappeningsHtml(
  featured: NonNullable<ResolvedEditorial["featuredHappenings"]>
): string {
  const cards = featured
    .map((f) => {
      const metaParts: string[] = [];
      if (f.date) metaParts.push(escapeHtml(f.date));
      if (f.time) metaParts.push(escapeHtml(f.time));
      if (f.venue) {
        const venueText = escapeHtml(f.venue);
        const venueLink = f.venueUrl
          ? `<a href="${escapeHtml(f.venueUrl)}" style="color: ${EMAIL_COLORS.textSecondary}; text-decoration: underline;">${venueText}</a>`
          : venueText;
        metaParts.push(venueLink);
      }
      const subtitleHtml = metaParts.length > 0 ? metaParts.join(" · ") : undefined;
      return renderEmailBaseballCard({
        coverUrl: f.coverUrl,
        coverAlt: f.title,
        title: f.title,
        titleUrl: f.url,
        subtitleHtml,
        ctaText: "View Happening",
        ctaUrl: f.url,
      });
    })
    .join("");

  return `
    <tr>
      <td style="padding: 16px 0 20px 0;">
        <p style="margin: 0 0 12px 0; color: ${EMAIL_COLORS.accent}; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">
          ⭐ FEATURED THIS WEEK
        </p>
        ${cards}
      </td>
    </tr>
  `;
}

function formatMemberSpotlightHtml(
  spotlight: NonNullable<ResolvedEditorial["memberSpotlight"]>
): string {
  return `
    <tr>
      <td style="padding: 16px 0;">
        <p style="margin: 0 0 12px 0; color: ${EMAIL_COLORS.accent}; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">
          🎤 MEMBER SPOTLIGHT
        </p>
        ${renderEmailBaseballCard({
          coverUrl: spotlight.avatarUrl,
          coverAlt: spotlight.name,
          title: spotlight.name,
          titleUrl: spotlight.url,
          subtitle: spotlight.bio,
          ctaText: "View Profile",
          ctaUrl: spotlight.url,
        })}
      </td>
    </tr>
  `;
}

function formatVenueSpotlightHtml(
  spotlight: NonNullable<ResolvedEditorial["venueSpotlight"]>
): string {
  const ctaUrl = spotlight.websiteUrl || spotlight.url;
  const ctaText = spotlight.websiteUrl ? "Visit Website" : "View Venue";

  return `
    <tr>
      <td style="padding: 16px 0;">
        <p style="margin: 0 0 12px 0; color: ${EMAIL_COLORS.accent}; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">
          📍 VENUE SPOTLIGHT
        </p>
        ${renderEmailBaseballCard({
          coverUrl: spotlight.coverUrl,
          coverAlt: spotlight.name,
          title: spotlight.name,
          titleUrl: spotlight.url,
          subtitle: spotlight.city,
          ctaText,
          ctaUrl,
        })}
      </td>
    </tr>
  `;
}

function formatBlogFeatureHtml(
  feature: NonNullable<ResolvedEditorial["blogFeature"]>
): string {
  return `
    <tr>
      <td style="padding: 16px 0;">
        <p style="margin: 0 0 12px 0; color: ${EMAIL_COLORS.accent}; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">
          📝 FROM THE BLOG
        </p>
        ${renderEmailBaseballCard({
          coverUrl: feature.coverUrl,
          coverAlt: feature.title,
          title: feature.title,
          titleUrl: feature.url,
          subtitle: feature.excerpt,
          ctaText: "Read Post",
          ctaUrl: feature.url,
        })}
      </td>
    </tr>
  `;
}

function formatGalleryFeatureHtml(
  feature: NonNullable<ResolvedEditorial["galleryFeature"]>
): string {
  const hasUrl = !!feature.url;
  return `
    <tr>
      <td style="padding: 16px 0;">
        <p style="margin: 0 0 12px 0; color: ${EMAIL_COLORS.accent}; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">
          📸 FROM THE GALLERY
        </p>
        ${renderEmailBaseballCard({
          coverUrl: feature.coverUrl,
          coverAlt: feature.title,
          title: feature.title,
          titleUrl: hasUrl ? feature.url : undefined,
          ctaText: hasUrl ? "View Album" : undefined,
          ctaUrl: hasUrl ? feature.url : undefined,
        })}
      </td>
    </tr>
  `;
}

// ============================================================
// Editorial Text Helpers (GTM-3)
// ============================================================

function formatIntroNoteText(introNote: string): string {
  return introNote;
}

function formatFeaturedHappeningsText(
  featured: NonNullable<ResolvedEditorial["featuredHappenings"]>
): string {
  const lines = ["⭐ FEATURED THIS WEEK", ""];
  for (const f of featured) {
    const metaParts = [f.date, f.time, f.venue].filter(Boolean);
    const metaLine = metaParts.join(" · ");
    lines.push(`${f.emoji || "⭐"} ${f.title}`);
    if (metaLine) lines.push(`   ${metaLine}`);
    lines.push(`   ${f.url}`);
    lines.push("");
  }
  return lines.join("\n");
}

function formatMemberSpotlightText(
  spotlight: NonNullable<ResolvedEditorial["memberSpotlight"]>
): string {
  const lines = ["🎤 MEMBER SPOTLIGHT", ""];
  lines.push(spotlight.name);
  if (spotlight.bio) lines.push(spotlight.bio);
  lines.push(spotlight.url);
  return lines.join("\n");
}

function formatVenueSpotlightText(
  spotlight: NonNullable<ResolvedEditorial["venueSpotlight"]>
): string {
  const lines = ["📍 VENUE SPOTLIGHT", ""];
  lines.push(spotlight.name);
  if (spotlight.city) lines.push(spotlight.city);
  lines.push(spotlight.url);
  return lines.join("\n");
}

function formatBlogFeatureText(
  feature: NonNullable<ResolvedEditorial["blogFeature"]>
): string {
  const lines = ["📝 FROM THE BLOG", ""];
  lines.push(feature.title);
  if (feature.excerpt) lines.push(feature.excerpt);
  lines.push(feature.url);
  return lines.join("\n");
}

function formatGalleryFeatureText(
  feature: NonNullable<ResolvedEditorial["galleryFeature"]>
): string {
  const lines = ["📸 FROM THE GALLERY", ""];
  lines.push(feature.title);
  if (feature.url) lines.push(feature.url);
  return lines.join("\n");
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
  const { firstName, userId, byDate, totalCount, venueCount, editorial } = params;

  // Build one-click unsubscribe URL (HMAC-signed, no login required)
  const unsubscribeUrl = buildUnsubscribeUrl(userId) || `${SITE_URL}/dashboard/settings`;

  // GTM-3: Editorial subject override takes precedence
  const subject = editorial?.subjectOverride || "Happenings This Week in Denver";

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
  const summaryLine = totalCount === 0
    ? ""
    : `That's ${totalCount} happening${totalCount === 1 ? "" : "s"} across ${venueCount} venue${venueCount === 1 ? "" : "s"} this week.`;

  // GTM-3: Build editorial HTML sections
  const introNoteHtml = editorial?.introNote
    ? formatIntroNoteHtml(editorial.introNote)
    : "";

  const featuredHappenings = editorial?.featuredHappenings ?? [];
  const [featuredEvent, ...remainingFeatured] = featuredHappenings;

  const featuredTopRows: string[] = [];
  if (editorial?.memberSpotlight) {
    featuredTopRows.push(formatMemberSpotlightHtml(editorial.memberSpotlight));
  }
  if (featuredEvent) {
    featuredTopRows.push(formatFeaturedEventHtml(featuredEvent));
  }
  if (editorial?.blogFeature) {
    featuredTopRows.push(formatBlogFeatureHtml(editorial.blogFeature));
  }
  if (editorial?.galleryFeature) {
    featuredTopRows.push(formatGalleryFeatureHtml(editorial.galleryFeature));
  }
  const featuredTopHtml = featuredTopRows.join("");

  const remainingFeaturedHtml = remainingFeatured.length
    ? formatFeaturedHappeningsHtml(remainingFeatured)
    : "";

  // Spotlights after the CTA (venue only; other featured items are at top)
  let spotlightsHtml = "";
  if (editorial?.venueSpotlight) {
    spotlightsHtml += formatVenueSpotlightHtml(editorial.venueSpotlight);
  }

  const happeningsLinkHtml = `Want to tailor this to you? Browse all <a href="${SITE_URL}/happenings" style="color: ${EMAIL_COLORS.accent}; text-decoration: underline;">happenings</a> with your filters applied!`;
  const happeningsNudgeHtml = `
    <p style="margin: 16px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px; font-weight: 700;">
      ${happeningsLinkHtml}
    </p>
  `;

  const htmlContent = `
    ${getGreeting(firstName)}

    <p style="margin: 0 0 16px 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.6;">
      Here's what's happening in the Denver songwriter community this week.
    </p>

    ${introNoteHtml ? `<table cellpadding="0" cellspacing="0" style="width: 100%;">${introNoteHtml}</table>` : ""}

    ${featuredTopHtml ? `<table cellpadding="0" cellspacing="0" style="width: 100%;">${featuredTopHtml}</table>` : ""}

    ${remainingFeaturedHtml ? `<table cellpadding="0" cellspacing="0" style="width: 100%;">${remainingFeaturedHtml}</table>` : ""}

    ${happeningsNudgeHtml}

    <table cellpadding="0" cellspacing="0" style="width: 100%;">
      ${eventsHtml}
    </table>

    ${happeningsNudgeHtml}

    ${summaryLine ? `
    <p style="margin: 24px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px;">
      ${escapeHtml(summaryLine)}
    </p>
    ` : ""}

    ${spotlightsHtml ? `<table cellpadding="0" cellspacing="0" style="width: 100%;">${spotlightsHtml}</table>` : ""}

    <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${EMAIL_COLORS.accent}; border-radius: 8px;">
          <a href="${SITE_URL}/happenings" style="display: inline-block; padding: 14px 28px; color: ${EMAIL_COLORS.textOnAccent}; text-decoration: none; font-weight: 600; font-size: 15px;">
            Browse All Happenings
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

  // GTM-3: Build editorial text sections
  const editorialTextParts: string[] = [];

  if (editorial?.introNote) {
    editorialTextParts.push(formatIntroNoteText(editorial.introNote));
    editorialTextParts.push("");
  }

  const featuredTextParts: string[] = [];
  if (editorial?.memberSpotlight) {
    featuredTextParts.push(formatMemberSpotlightText(editorial.memberSpotlight));
    featuredTextParts.push("");
  }
  if (featuredEvent) {
    featuredTextParts.push(formatFeaturedHappeningsText([featuredEvent]));
    featuredTextParts.push("");
  }
  if (editorial?.blogFeature) {
    featuredTextParts.push(formatBlogFeatureText(editorial.blogFeature));
    featuredTextParts.push("");
  }
  if (editorial?.galleryFeature) {
    featuredTextParts.push(formatGalleryFeatureText(editorial.galleryFeature));
    featuredTextParts.push("");
  }
  if (remainingFeatured.length > 0) {
    featuredTextParts.push(formatFeaturedHappeningsText(remainingFeatured));
  }

  const spotlightsTextParts: string[] = [];
  if (editorial?.venueSpotlight) {
    spotlightsTextParts.push(formatVenueSpotlightText(editorial.venueSpotlight));
    spotlightsTextParts.push("");
  }

  const happeningsNudgeText = `Want to tailor this to you? Browse all happenings with your filters applied! ${SITE_URL}/happenings`;

  const textParts = [
    greeting,
    "",
    "Here's what's happening in the Denver songwriter community this week.",
    "",
    ...editorialTextParts,
    ...featuredTextParts,
    happeningsNudgeText,
    eventsText,
    "",
    happeningsNudgeText,
    "",
    summaryLine,
    "",
    ...spotlightsTextParts,
    `Browse All Happenings: ${SITE_URL}/happenings`,
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
