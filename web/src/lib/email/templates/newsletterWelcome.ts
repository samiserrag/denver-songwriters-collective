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
} from "../render";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NewsletterWelcomeEmailParams {
  // No params needed - generic welcome
}

export function getNewsletterWelcomeEmail(_params?: NewsletterWelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const openMicsUrl = `${SITE_URL}/open-mics`;
  const privacyUrl = `${SITE_URL}/privacy`;
  const contactUrl = `${SITE_URL}/contact`;

  const subject = "Welcome to the Denver Songwriters Collective!";

  const htmlContent = `
${paragraph("Hi there,")}

${paragraph("Thanks for joining the Denver Songwriters Collective newsletter. You're now connected to Denver's vibrant songwriter scene.")}

<div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 20px 0;">
  <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 15px; font-weight: 500;">Here's what you can expect:</p>
  <ul style="margin: 0; padding-left: 20px; color: #a3a3a3; font-size: 15px; line-height: 1.8;">
    <li>Weekly roundups of open mics and songwriter events</li>
    <li>Featured artist spotlights</li>
    <li>Tips and resources for songwriters</li>
    <li>Community news and opportunities</li>
  </ul>
</div>

${paragraph("In the meantime, check out what's happening this week:", { muted: true })}

${createButton("Browse Open Mics", openMicsUrl)}

<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #262626;">
  <p style="margin: 0 0 8px 0; color: #d4a853; font-size: 14px; font-weight: 500;">
    Find your people. Find your stage. Find your songs.
  </p>
  <p style="margin: 0; color: #525252; font-size: 12px;">
    <a href="${privacyUrl}" style="color: #737373; text-decoration: underline;">Privacy Policy</a>
    &nbsp;|&nbsp;
    <a href="${contactUrl}" style="color: #737373; text-decoration: underline;">Contact Us</a>
  </p>
</div>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `Hi there,

Thanks for joining the Denver Songwriters Collective newsletter. You're now connected to Denver's vibrant songwriter scene.

Here's what you can expect:
- Weekly roundups of open mics and songwriter events
- Featured artist spotlights
- Tips and resources for songwriters
- Community news and opportunities

Browse open mics: ${openMicsUrl}

Find your people. Find your stage. Find your songs.

Privacy Policy: ${privacyUrl}
Contact Us: ${contactUrl}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
