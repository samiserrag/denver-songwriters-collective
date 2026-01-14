/**
 * Email Rendering Utilities
 *
 * Shared layout and styling for all transactional emails.
 * DSC branding with warm, friendly tone.
 *
 * Color Palette (Light Theme - better email client compatibility):
 * - Background: #f8f8f8 (light gray)
 * - Card: #ffffff (white)
 * - Header: #b8860b (dark goldenrod - DSC brand)
 * - Primary text: #1a1a1a (near black)
 * - Secondary text: #525252 (dark gray)
 * - Muted text: #737373 (medium gray)
 * - Accent: #b8860b (dark goldenrod)
 * - Border: #e5e5e5 (light gray)
 * - Success: #16a34a (green)
 * - Warning: #d97706 (amber)
 */

import { escapeHtml } from "@/lib/highlight";

const SITE_URL = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://denversongwriterscollective.org";

export { SITE_URL };

// Color constants for consistent theming
export const EMAIL_COLORS = {
  // Backgrounds
  bgPage: "#f8f8f8",
  bgCard: "#ffffff",
  bgMuted: "#f5f5f5",
  bgAccent: "#f0f4ff",

  // Brand - Deep navy blue
  headerBg: "#1e3a5f",
  headerText: "#ffffff",
  accent: "#2563eb",
  accentHover: "#1d4ed8",

  // Text
  textPrimary: "#1a1a1a",
  textSecondary: "#525252",
  textMuted: "#737373",
  textOnAccent: "#ffffff",

  // Borders
  border: "#e5e5e5",
  borderAccent: "#2563eb",

  // Status colors
  success: "#16a34a",
  successBg: "#f0fdf4",
  successBorder: "#bbf7d0",
  warning: "#d97706",
  warningBg: "#fffbeb",
  warningBorder: "#fde68a",
  error: "#dc2626",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  info: "#0284c7",
  infoBg: "#f0f9ff",
  infoBorder: "#bae6fd",
};

/**
 * Get greeting with fallback
 */
export function getGreeting(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? `Hi ${escapeHtml(trimmed)},` : "Hi there,";
}

/**
 * Shared email layout wrapper
 *
 * Design: Clean, mobile-first, no tracking pixels
 * - Header: "Denver Songwriters Collective" with gold brand color
 * - Content block on white card
 * - Footer with signature
 */
export function wrapEmailHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Denver Songwriters Collective</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.bgPage}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${EMAIL_COLORS.bgPage}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: ${EMAIL_COLORS.bgCard}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${EMAIL_COLORS.headerBg}; padding: 24px; text-align: center;">
              <img src="https://oipozdbfxyskoscsgbfq.supabase.co/storage/v1/object/public/email-images/logo-email.png" alt="Denver Songwriters Collective" style="max-width: 280px; height: auto;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 28px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; border-top: 1px solid ${EMAIL_COLORS.border}; background-color: ${EMAIL_COLORS.bgMuted};">
              <p style="margin: 0 0 12px 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px; line-height: 1.5;">
                — From <a href="${SITE_URL}/songwriters/sami-serrag" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">Sami Serrag</a> on Behalf of the Denver Songwriters Collective
              </p>
              <p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; line-height: 1.5;">
                You can reply directly to this email if you need anything.
              </p>
              <p style="margin: 16px 0 0 0; font-size: 12px;">
                <a href="${SITE_URL}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">denversongwriterscollective.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Create a primary CTA button
 */
export function createButton(text: string, url: string, color: "gold" | "green" = "gold"): string {
  const bgColor = color === "green" ? EMAIL_COLORS.success : EMAIL_COLORS.accent;
  const textColor = EMAIL_COLORS.textOnAccent;

  return `<table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="background-color: ${bgColor}; border-radius: 8px;">
      <a href="${url}" style="display: inline-block; padding: 14px 28px; color: ${textColor}; text-decoration: none; font-weight: 600; font-size: 15px;">
        ${escapeHtml(text)}
      </a>
    </td>
  </tr>
</table>`;
}

/**
 * Create a secondary text link
 */
export function createSecondaryLink(text: string, url: string): string {
  return `<p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">
  <a href="${url}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">${escapeHtml(text)}</a>
</p>`;
}

/**
 * Create paragraph text
 */
export function paragraph(text: string, options?: { muted?: boolean }): string {
  const color = options?.muted ? EMAIL_COLORS.textMuted : EMAIL_COLORS.textPrimary;
  return `<p style="margin: 0 0 16px 0; color: ${color}; font-size: 15px; line-height: 1.6;">${text}</p>`;
}

/**
 * Create code display (for verification codes)
 */
export function codeBlock(code: string): string {
  return `<div style="background-color: ${EMAIL_COLORS.bgAccent}; border: 2px solid ${EMAIL_COLORS.borderAccent}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
  <span style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: ${EMAIL_COLORS.accent};">
    ${escapeHtml(code)}
  </span>
</div>`;
}

/**
 * Create expiry warning box
 */
export function expiryWarning(text: string): string {
  return `<div style="background-color: ${EMAIL_COLORS.warningBg}; border: 1px solid ${EMAIL_COLORS.warningBorder}; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
  <p style="margin: 0; color: ${EMAIL_COLORS.warning}; font-size: 14px; font-weight: 500;">
    ${escapeHtml(text)}
  </p>
</div>`;
}

/**
 * Create a success callout box
 */
export function successBox(emoji: string, headline: string, subtext?: string): string {
  return `<div style="background-color: ${EMAIL_COLORS.successBg}; border: 1px solid ${EMAIL_COLORS.successBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 ${subtext ? "8px" : "0"} 0; color: ${EMAIL_COLORS.success}; font-size: 15px; font-weight: 600;">
    ${emoji} ${escapeHtml(headline)}
  </p>
  ${subtext ? `<p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">${escapeHtml(subtext)}</p>` : ""}
</div>`;
}

/**
 * Create an info callout box
 */
export function infoBox(emoji: string, headline: string, subtext?: string): string {
  return `<div style="background-color: ${EMAIL_COLORS.infoBg}; border: 1px solid ${EMAIL_COLORS.infoBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 ${subtext ? "8px" : "0"} 0; color: ${EMAIL_COLORS.info}; font-size: 15px; font-weight: 600;">
    ${emoji} ${escapeHtml(headline)}
  </p>
  ${subtext ? `<p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">${escapeHtml(subtext)}</p>` : ""}
</div>`;
}

/**
 * Create a neutral/muted callout box (for rejections, neutral info)
 */
export function neutralBox(emoji: string, headline: string, subtext?: string): string {
  return `<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 ${subtext ? "8px" : "0"} 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; font-weight: 600;">
    ${emoji} ${escapeHtml(headline)}
  </p>
  ${subtext ? `<p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">${escapeHtml(subtext)}</p>` : ""}
</div>`;
}

/**
 * Create a quote/message block (for admin messages, notes)
 */
export function quoteBlock(label: string, content: string): string {
  return `<div style="background-color: ${EMAIL_COLORS.bgMuted}; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 3px solid ${EMAIL_COLORS.accent};">
  <p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
    ${escapeHtml(label)}
  </p>
  <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
${escapeHtml(content)}
  </p>
</div>`;
}

/**
 * Create a card-style event link for emails
 */
export function eventCard(eventTitle: string, eventUrl: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin: 16px 0; width: 100%;">
  <tr>
    <td style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 16px;">
      <a href="${eventUrl}" style="text-decoration: none; display: block;">
        <p style="margin: 0; color: ${EMAIL_COLORS.accent}; font-size: 15px; font-weight: 600;">
          ${escapeHtml(eventTitle)} →
        </p>
      </a>
    </td>
  </tr>
</table>`;
}

/**
 * Create a link to the user's RSVPs dashboard
 */
export function rsvpsDashboardLink(): string {
  const rsvpsUrl = `${SITE_URL}/dashboard/my-rsvps`;
  return `<p style="margin: 20px 0 0 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">
  <a href="${rsvpsUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">View all your RSVPs →</a>
</p>`;
}

/**
 * Wrap plain text email with consistent footer
 */
export function wrapEmailText(content: string): string {
  return `${content}

---
— From Sami Serrag on Behalf of the Denver Songwriters Collective
You can reply directly to this email if you need anything.
${SITE_URL}`;
}
