/**
 * Send Email with Preference Checks
 *
 * Wraps the base sendEmail function to respect user email preferences.
 * Always creates dashboard notification first (canonical), then sends email
 * only if the user's preferences allow it.
 *
 * All decisions are audit-logged via appLogger for admin observability.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { sendEmail, type EmailPayload } from "./mailer";
import { shouldSendEmail, getEmailCategory } from "../notifications/preferences";
import { appLogger } from "../appLogger";

/** Extract recipient domain for logging (no full address) */
function recipientDomain(to: string | string[] | undefined): string | undefined {
  const addr = Array.isArray(to) ? to[0] : to;
  if (!addr) return undefined;
  const parts = addr.split("@");
  return parts.length === 2 ? parts[1] : undefined;
}

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

  // Shared context for all audit log entries in this call
  const auditCtx = {
    templateKey,
    userId,
    notificationType: notification?.type ?? null,
    recipientDomain: recipientDomain(payload.to),
  };

  // Step 0: Defensive guard — never attempt to send with an empty recipient
  const toValue = Array.isArray(payload.to) ? payload.to[0] : payload.to;
  if (!toValue || !toValue.trim()) {
    result.skipReason = "missing_recipient";

    appLogger.warn("email_audit: skipped — missing recipient", {
      ...auditCtx,
      skipReason: "missing_recipient",
    }, { source: "email_prefs_audit", userId });

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
        appLogger.error("email_audit: failed to create notification", {
          ...auditCtx,
          error: error.message,
        }, { source: "email_prefs_audit", userId });
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
      appLogger.info("email_audit: notification created", {
        ...auditCtx,
      }, { source: "email_prefs_audit", userId });
    } else {
      appLogger.error("email_audit: failed to create notification", {
        ...auditCtx,
        error: error.message,
      }, { source: "email_prefs_audit", userId });
    }
  }

  // Step 2: Check preference category for this template
  const category = getEmailCategory(templateKey);
  if (!category) {
    // Unknown category - send email anyway (backwards compatibility)
    appLogger.warn("email_audit: no category mapping, sending anyway", {
      ...auditCtx,
      skipReason: "no_category",
    }, { source: "email_prefs_audit", userId });

    const sent = await sendEmail(payload);
    result.emailSent = sent;
    if (!sent) {
      result.skipReason = "send_failed";
      appLogger.error("email_audit: send failed (no category)", {
        ...auditCtx,
        skipReason: "send_failed",
      }, { source: "email_prefs_audit", userId });
    } else {
      appLogger.info("email_audit: sent (no category, backwards compat)", {
        ...auditCtx,
        outcome: "sent",
      }, { source: "email_prefs_audit", userId });
    }
    return result;
  }

  // Step 3: Check user preference
  const shouldSend = await shouldSendEmail(supabase, userId, category);
  if (!shouldSend) {
    result.skipReason = "preference_disabled";

    appLogger.info("email_audit: skipped — preference disabled", {
      ...auditCtx,
      category,
      skipReason: "preference_disabled",
    }, { source: "email_prefs_audit", userId });

    return result;
  }

  // Step 4: Send email
  const sent = await sendEmail(payload);
  result.emailSent = sent;
  if (!sent) {
    result.skipReason = "send_failed";
    appLogger.error("email_audit: send failed", {
      ...auditCtx,
      category,
      skipReason: "send_failed",
    }, { source: "email_prefs_audit", userId });
  } else {
    appLogger.info("email_audit: sent", {
      ...auditCtx,
      category,
      outcome: "sent",
    }, { source: "email_prefs_audit", userId });
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
        appLogger.info("email_audit: admin email skipped — preference disabled", {
          templateKey,
          userId: adminUserId,
          category,
          skipReason: "preference_disabled",
        }, { source: "email_prefs_audit", userId: adminUserId });
        return false;
      }
    }
  }

  // Send the email
  return sendEmail(payload);
}
