/**
 * Contact Notification Email Template
 *
 * Sent to admin when someone submits the contact form.
 * This is an admin-facing email, so the tone is more functional.
 */

import { escapeHtml } from "@/lib/highlight";
import { wrapEmailHtml, wrapEmailText } from "../render";

export interface ContactNotificationEmailParams {
  senderName: string;
  senderEmail: string;
  message: string;
}

export function getContactNotificationEmail(params: ContactNotificationEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { senderName, senderEmail, message } = params;

  const safeName = escapeHtml(senderName);
  const safeEmail = escapeHtml(senderEmail);
  const safeMessage = escapeHtml(message);

  const subject = `[DSC Contact] Message from ${senderName}`;

  const htmlContent = `
<p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">
  New message from the contact form:
</p>

<div style="background-color: #262626; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">From</p>
        <p style="margin: 0; color: #ffffff; font-size: 16px;">${safeName}</p>
      </td>
    </tr>
    <tr>
      <td style="padding-bottom: 16px;">
        <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</p>
        <p style="margin: 0; color: #d4a853; font-size: 16px;">
          <a href="mailto:${safeEmail}" style="color: #d4a853; text-decoration: none;">${safeEmail}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td>
        <p style="margin: 0 0 8px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Message</p>
        <div style="background-color: #171717; border-radius: 6px; padding: 16px;">
          <p style="margin: 0; color: #a3a3a3; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</p>
        </div>
      </td>
    </tr>
  </table>
</div>

<table cellpadding="0" cellspacing="0">
  <tr>
    <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); border-radius: 8px;">
      <a href="mailto:${safeEmail}" style="display: inline-block; padding: 12px 24px; color: #0a0a0a; text-decoration: none; font-weight: 600; font-size: 14px;">
        Reply to ${safeName}
      </a>
    </td>
  </tr>
</table>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `New Contact Form Submission
============================

From: ${senderName}
Email: ${senderEmail}

Message:
${message}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
