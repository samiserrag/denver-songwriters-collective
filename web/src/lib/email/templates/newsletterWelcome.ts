/**
 * Newsletter Welcome Email Template
 *
 * Sent when someone subscribes to the DSC newsletter.
 * Warm, welcoming, and sets expectations for what they'll receive.
 */

import {
  wrapEmailHtml,
  wrapEmailText,
  paragraph,
  createButton,
  SITE_URL,
  EMAIL_COLORS,
} from "../render";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NewsletterWelcomeEmailParams {
  // No params needed - generic welcome
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getNewsletterWelcomeEmail(_params?: NewsletterWelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const happeningsUrl = `${SITE_URL}/happenings`;
  const privacyUrl = `${SITE_URL}/privacy`;
  const contactUrl = `${SITE_URL}/contact`;

  const subject = "Welcome to The Denver Songwriters Collective!";

  const htmlContent = `
${paragraph("Hi there,")}

${paragraph("Thanks for joining the Denver Songwriters Collective newsletter. You're now connected to Denver's vibrant songwriter scene.")}

<div style="background-color: ${EMAIL_COLORS.bgMuted}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <p style="margin: 0 0 16px 0; color: ${EMAIL_COLORS.textPrimary}; font-size: 15px; font-weight: 500;">Here's what you can expect:</p>
  <ul style="margin: 0; padding-left: 20px; color: ${EMAIL_COLORS.textSecondary}; font-size: 15px; line-height: 1.8;">
    <li>Open mics and songwriter events worth knowing about</li>
    <li>Featured artist spotlights</li>
    <li>Tips and resources for songwriters</li>
    <li>Community news and opportunities</li>
  </ul>
</div>

${paragraph("In the meantime, check out what's happening this week:", { muted: true })}

${createButton("Browse Happenings", happeningsUrl)}

<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid ${EMAIL_COLORS.border};">
  <p style="margin: 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 12px;">
    <a href="${privacyUrl}" style="color: ${EMAIL_COLORS.textMuted}; text-decoration: underline;">Privacy Policy</a>
    &nbsp;|&nbsp;
    <a href="${contactUrl}" style="color: ${EMAIL_COLORS.textMuted}; text-decoration: underline;">Contact Us</a>
  </p>
</div>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `Hi there,

Thanks for joining the Denver Songwriters Collective newsletter. You're now connected to Denver's vibrant songwriter scene.

Here's what you can expect:
- Open mics and songwriter events worth knowing about
- Featured artist spotlights
- Tips and resources for songwriters
- Community news and opportunities

Browse happenings: ${happeningsUrl}

Privacy Policy: ${privacyUrl}
Contact Us: ${contactUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
