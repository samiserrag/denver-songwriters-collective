/**
 * Email Preview Script
 *
 * Generates a sample email HTML file for visual review.
 * Run with: npx tsx scripts/preview-email.ts
 * Then open: scripts/email-preview.html
 */

import * as fs from "fs";
import * as path from "path";

// Mock the render functions inline since we can't import easily
const EMAIL_COLORS = {
  bgPage: "#f8f8f8",
  bgCard: "#ffffff",
  bgMuted: "#f5f5f5",
  bgAccent: "#f0f4ff",
  headerBg: "#1e3a5f",
  headerText: "#ffffff",
  accent: "#2563eb",
  accentHover: "#1d4ed8",
  textPrimary: "#1a1a1a",
  textSecondary: "#525252",
  textMuted: "#737373",
  textOnAccent: "#ffffff",
  border: "#e5e5e5",
  borderAccent: "#2563eb",
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

const SITE_URL = "https://denversongwriterscollective.org";

function wrapEmailHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Denver Songwriters Collective - Email Preview</title>
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
                — Denver Songwriters Collective
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

function paragraph(text: string, muted = false): string {
  const color = muted ? EMAIL_COLORS.textMuted : EMAIL_COLORS.textPrimary;
  return `<p style="margin: 0 0 16px 0; color: ${color}; font-size: 15px; line-height: 1.6;">${text}</p>`;
}

function createButton(text: string, url: string, color: "gold" | "green" = "gold"): string {
  const bgColor = color === "green" ? EMAIL_COLORS.success : EMAIL_COLORS.accent;
  return `<table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td style="background-color: ${bgColor}; border-radius: 8px;">
      <a href="${url}" style="display: inline-block; padding: 14px 28px; color: ${EMAIL_COLORS.textOnAccent}; text-decoration: none; font-weight: 600; font-size: 15px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

function successBox(emoji: string, headline: string, subtext?: string): string {
  return `<div style="background-color: ${EMAIL_COLORS.successBg}; border: 1px solid ${EMAIL_COLORS.successBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0 0 ${subtext ? "8px" : "0"} 0; color: ${EMAIL_COLORS.success}; font-size: 15px; font-weight: 600;">
    ${emoji} ${headline}
  </p>
  ${subtext ? `<p style="margin: 0; color: ${EMAIL_COLORS.textMuted}; font-size: 14px;">${subtext}</p>` : ""}
</div>`;
}

function quoteBlock(label: string, content: string): string {
  return `<div style="background-color: ${EMAIL_COLORS.bgMuted}; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 3px solid ${EMAIL_COLORS.accent};">
  <p style="margin: 0 0 8px 0; color: ${EMAIL_COLORS.textMuted}; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
    ${label}
  </p>
  <p style="margin: 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
${content}
  </p>
</div>`;
}

// Generate the preview email (similar to the screenshot)
const emailContent = `
${paragraph("Hi there,")}

${paragraph("Thanks for being part of the Denver Songwriters Collective community!")}

${successBox("🎉", "Your correction has been applied!", "Re: Node Arts Collective")}

${quoteBlock("From the DSC team:", "Thank you for your contribution! Your correction has been approved and the listing has been updated.")}

${paragraph("Thanks for keeping our community info accurate — it really helps!")}

${createButton("View open mics", `${SITE_URL}/happenings?type=open_mic`)}
`;

const html = wrapEmailHtml(emailContent);

// Write to file
const outputPath = path.join(__dirname, "email-preview.html");
fs.writeFileSync(outputPath, html);

console.log(`✅ Email preview generated: ${outputPath}`);
console.log("Open this file in your browser to see the new color scheme.");
