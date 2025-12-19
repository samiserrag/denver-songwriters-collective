/**
 * Email Rendering Utilities
 *
 * Shared layout and styling for all transactional emails.
 * DSC branding with warm, friendly tone.
 */

import { escapeHtml } from "@/lib/highlight";

const SITE_URL = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://denver-songwriters-collective.vercel.app";

export { SITE_URL };

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
 * - Header: "Denver Songwriters Collective"
 * - Content block
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
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #171717; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #0a0a0a; font-size: 18px; font-weight: 600; letter-spacing: 0.5px;">
                Denver Songwriters Collective
              </h1>
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
            <td style="padding: 20px 28px; border-top: 1px solid #262626;">
              <p style="margin: 0 0 12px 0; color: #a3a3a3; font-size: 14px; line-height: 1.5;">
                — Denver Songwriters Collective
              </p>
              <p style="margin: 0; color: #737373; font-size: 13px; line-height: 1.5;">
                You can reply directly to this email if you need anything.
              </p>
              <p style="margin: 16px 0 0 0; color: #525252; font-size: 12px;">
                <a href="${SITE_URL}" style="color: #d4a853; text-decoration: none;">denversongwriterscollective.org</a>
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
  const gradient = color === "green"
    ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
    : "linear-gradient(135deg, #d4a853 0%, #b8943f 100%)";
  const textColor = color === "green" ? "#ffffff" : "#0a0a0a";

  return `<table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="background: ${gradient}; border-radius: 8px;">
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
  return `<p style="margin: 0; color: #737373; font-size: 14px;">
  <a href="${url}" style="color: #d4a853; text-decoration: none;">${escapeHtml(text)}</a>
</p>`;
}

/**
 * Create paragraph text
 */
export function paragraph(text: string, options?: { muted?: boolean }): string {
  const color = options?.muted ? "#737373" : "#a3a3a3";
  return `<p style="margin: 0 0 16px 0; color: ${color}; font-size: 15px; line-height: 1.6;">${text}</p>`;
}

/**
 * Create code display (for verification codes)
 */
export function codeBlock(code: string): string {
  return `<div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
  <span style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #d4a853;">
    ${escapeHtml(code)}
  </span>
</div>`;
}

/**
 * Create expiry warning box
 */
export function expiryWarning(text: string): string {
  return `<div style="background-color: #f59e0b15; border: 1px solid #f59e0b30; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
  <p style="margin: 0; color: #f59e0b; font-size: 14px; font-weight: 500;">
    ${escapeHtml(text)}
  </p>
</div>`;
}

/**
 * Wrap plain text email with consistent footer
 */
export function wrapEmailText(content: string): string {
  return `${content}

---
— Denver Songwriters Collective
You can reply directly to this email if you need anything.
${SITE_URL}`;
}
