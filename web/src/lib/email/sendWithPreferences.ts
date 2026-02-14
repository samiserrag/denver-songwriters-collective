/**
 * Send Email with Preference Checks
 *
 * Wraps the base sendEmail function to respect user email preferences.
 * Always creates dashboard notification first (canonical), then sends email
 * only if the user's preferences allow it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { sendEmail, type EmailPayload } from "./mailer";
import { shouldSendEmail, getEmailCategory } from "../notifications/preferences";

export interface SendWithPreferencesOptions {
  /**
   * The Supabase client to use for preference lookup
   */
  supabase: SupabaseClient<Database>;

  /**
   * The user ID whose preferences to check
   */
  userId: string;

  /**
   * The email template key (used to determine preference category)
   */
  templateKey: string;

  /**
   * The email payload to send
   */
  payload: EmailPayload;

  /**
   * Optional: Create dashboard notification before sending email
   * If provided, the notification is created regardless of email preference
   */
  notification?: {
    type: string;
    title: string;
    message?: string;
    link?: string;
  };
}

export interface SendWithPreferencesResult {
  /**
   * Whether the dashboard notification was created (if requested)
   */
  notificationCreated: boolean;

  /**
   * Whether the email was sent
   */
  emailSent: boolean;

  /**
   * If email was skipped, the reason why
   */
  skipReason?: "preference_disabled" | "no_category" | "send_failed" | "missing_recipient";
}

/**
 * Send an email respecting user preferences
 *
 * Always creates the dashboard notification first (if requested), then
 * only sends the email if the user's preferences allow it for that category.
 */
export async function sendEmailWithPreferences(
  options: SendWithPreferencesOptions
): Promise<SendWithPreferencesResult> {
  const { supabase, userId, templateKey, payload, notification } = options;

  const result: SendWithPreferencesResult = {
    notificationCreated: false,
    emailSent: false,
  };

  // Step 0: Defensive guard — never attempt to send with an empty recipient
  const toValue = Array.isArray(payload.to) ? payload.to[0] : payload.to;
  if (!toValue || !toValue.trim()) {
    console.warn(`[Email] Missing recipient for ${templateKey}, skipping email send`);
    result.skipReason = "missing_recipient";

    // Still create the notification if requested
    if (notification) {
      const { error } = await supabase.rpc("create_user_notification", {
        p_user_id: userId,
        p_type: notification.type,
        p_title: notification.title,
        p_message: notification.message,
        p_link: notification.link,
      });
      if (!error) {
        result.notificationCreated = true;
      } else {
        console.error("[Email] Failed to create notification:", error.message);
      }
    }

    return result;
  }

  // Step 1: Create dashboard notification (always, if requested)
  if (notification) {
    const { error } = await supabase.rpc("create_user_notification", {
      p_user_id: userId,
      p_type: notification.type,
      p_title: notification.title,
      p_message: notification.message,
      p_link: notification.link,
    });

    if (!error) {
      result.notificationCreated = true;
    } else {
      console.error("[Email] Failed to create notification:", error.message);
    }
  }

  // Step 2: Check preference category for this template
  const category = getEmailCategory(templateKey);
  if (!category) {
    // Unknown category - send email anyway (backwards compatibility)
    const sent = await sendEmail(payload);
    result.emailSent = sent;
    if (!sent) {
      result.skipReason = "send_failed";
    }
    return result;
  }

  // Step 3: Check user preference
  const shouldSend = await shouldSendEmail(supabase, userId, category);
  if (!shouldSend) {
    result.skipReason = "preference_disabled";
    console.log(`[Email] Skipped (preference off): ${templateKey} for user`);
    return result;
  }

  // Step 4: Send email
  const sent = await sendEmail(payload);
  result.emailSent = sent;
  if (!sent) {
    result.skipReason = "send_failed";
  }

  return result;
}

/**
 * Convenience wrapper for admin notifications
 *
 * Admin notifications go to the admin email address directly,
 * not to a user. They still respect the admin's own preferences
 * if they have a user account.
 */
export async function sendAdminEmailWithPreferences(
  supabase: SupabaseClient<Database>,
  adminUserId: string | null,
  templateKey: string,
  payload: EmailPayload
): Promise<boolean> {
  // If we know the admin's user ID, check their preferences
  if (adminUserId) {
    const category = getEmailCategory(templateKey);
    if (category) {
      const shouldSend = await shouldSendEmail(supabase, adminUserId, category);
      if (!shouldSend) {
        console.log(`[Email] Skipped (admin preference off): ${templateKey}`);
        return false;
      }
    }
  }

  // Send the email
  return sendEmail(payload);
}
