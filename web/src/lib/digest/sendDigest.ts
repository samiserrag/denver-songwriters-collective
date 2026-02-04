/**
 * Shared Digest Send Function
 *
 * Extracted from cron handlers to enable reuse by:
 * - Cron jobs (full send with idempotency lock)
 * - Admin "Send now" button (full send with idempotency lock)
 * - Admin "Send test to me" (single recipient, bypasses lock)
 * - Admin "Preview" (dry run, no emails sent)
 *
 * Phase: GTM-2
 */

import { sendEmail } from "@/lib/email/mailer";
import type { DigestRecipient } from "@/lib/digest/weeklyHappenings";

// ============================================================
// Types
// ============================================================

export type SendDigestMode =
  | "full"          // Normal send: uses idempotency lock, sends to all recipients
  | "test"          // Test send: single recipient, bypasses idempotency lock
  | "dryRun";       // Preview: no emails sent, returns what would be sent

export interface SendDigestParams {
  mode: SendDigestMode;
  recipients: DigestRecipient[];
  /** Function to build email for a given recipient */
  buildEmail: (recipient: DigestRecipient) => {
    subject: string;
    html: string;
    text: string;
  };
  /** Template name for mailer logging */
  templateName: string;
  /** Log prefix for console output (e.g., "[WeeklyHappenings]") */
  logPrefix: string;
}

export interface SendDigestResult {
  sent: number;
  failed: number;
  total: number;
  /** In dryRun mode, the preview HTML for the first recipient */
  previewHtml?: string;
  /** In dryRun mode, the preview subject */
  previewSubject?: string;
}

// ============================================================
// Main Send Function
// ============================================================

/**
 * Send digest emails to recipients.
 *
 * Modes:
 * - `full`: Send to all recipients (100ms delay between each)
 * - `test`: Send to the first recipient only (no delay)
 * - `dryRun`: Build email for first recipient, return HTML without sending
 */
export async function sendDigestEmails(
  params: SendDigestParams
): Promise<SendDigestResult> {
  const { mode, recipients, buildEmail, templateName, logPrefix } = params;

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, total: 0 };
  }

  // ============================================================
  // Dry Run Mode — preview only
  // ============================================================
  if (mode === "dryRun") {
    const firstRecipient = recipients[0];
    const email = buildEmail(firstRecipient);
    return {
      sent: 0,
      failed: 0,
      total: recipients.length,
      previewHtml: email.html,
      previewSubject: email.subject,
    };
  }

  // ============================================================
  // Test Mode — single recipient
  // ============================================================
  if (mode === "test") {
    const firstRecipient = recipients[0];
    const email = buildEmail(firstRecipient);

    console.log(`${logPrefix} Sending test email to ${firstRecipient.email}`);

    const sent = await sendEmail({
      to: firstRecipient.email,
      subject: `[TEST] ${email.subject}`,
      html: email.html,
      text: email.text,
      templateName,
    });

    return {
      sent: sent ? 1 : 0,
      failed: sent ? 0 : 1,
      total: 1,
    };
  }

  // ============================================================
  // Full Mode — send to all recipients
  // ============================================================
  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    const email = buildEmail(recipient);

    const sent = await sendEmail({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      templateName,
    });

    if (sent) {
      sentCount++;
    } else {
      failedCount++;
    }

    // Small delay to avoid overwhelming SMTP
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`${logPrefix} Complete: ${sentCount} sent, ${failedCount} failed`);

  return {
    sent: sentCount,
    failed: failedCount,
    total: recipients.length,
  };
}
