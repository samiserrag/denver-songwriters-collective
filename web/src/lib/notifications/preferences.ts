/**
 * Notification Preferences
 *
 * Helpers for managing user email preferences.
 * These preferences gate email sending only - dashboard notifications always appear.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  email_claim_updates: boolean;
  email_event_updates: boolean;
  email_admin_notifications: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Default preferences (all emails enabled)
 */
export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at"> = {
  email_enabled: true,
  email_claim_updates: true,
  email_event_updates: true,
  email_admin_notifications: true,
};

/**
 * Get user's notification preferences with defaults if not set
 */
export async function getPreferences(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Return defaults if no preferences exist yet
    return {
      user_id: userId,
      ...DEFAULT_PREFERENCES,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data;
}

/**
 * Upsert user's notification preferences
 */
export async function upsertPreferences(
  supabase: SupabaseClient<Database>,
  userId: string,
  patch: Partial<Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at">>
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase.rpc("upsert_notification_preferences", {
    p_user_id: userId,
    p_email_enabled: patch.email_enabled,
    p_email_claim_updates: patch.email_claim_updates,
    p_email_event_updates: patch.email_event_updates,
    p_email_admin_notifications: patch.email_admin_notifications,
  });

  if (error) {
    console.error("Failed to upsert notification preferences:", error);
    return null;
  }

  return data as unknown as NotificationPreferences;
}

/**
 * Check if user wants to receive a specific category of email
 */
export async function shouldSendEmail(
  supabase: SupabaseClient<Database>,
  userId: string,
  category: "claim_updates" | "event_updates" | "admin_notifications"
): Promise<boolean> {
  const prefs = await getPreferences(supabase, userId);

  // Master kill-switch: no emails at all
  if (!prefs.email_enabled) return false;

  switch (category) {
    case "claim_updates":
      return prefs.email_claim_updates;
    case "event_updates":
      return prefs.email_event_updates;
    case "admin_notifications":
      return prefs.email_admin_notifications;
    default:
      return true; // Default to sending if unknown category
  }
}

/**
 * Essential emails that bypass all preference checks.
 * These are security or account-recovery emails that must always be delivered.
 */
export const ESSENTIAL_EMAILS: ReadonlySet<string> = new Set([
  "verificationCode", // Guest slot claim verification — security
]);

/**
 * Category mapping for email templates.
 *
 * DEVELOPER CONTRACT: Every template in registry.ts MUST appear here
 * or in ESSENTIAL_EMAILS. A test enforces this — if you add a new
 * template without categorizing it, CI will fail.
 *
 * See docs/email-preferences.md for the full checklist.
 */
export const EMAIL_CATEGORY_MAP: Record<string, "claim_updates" | "event_updates" | "admin_notifications"> = {
  // Claim-related templates (events)
  eventClaimSubmitted: "claim_updates",
  eventClaimApproved: "claim_updates",
  eventClaimRejected: "claim_updates",
  hostApproval: "claim_updates",
  hostRejection: "claim_updates",
  claimConfirmed: "claim_updates",
  // Claim-related templates (venues) - ABC8
  venueClaimApproved: "claim_updates",
  venueClaimRejected: "claim_updates",

  // Event-related templates
  eventReminder: "event_updates",
  eventUpdated: "event_updates",
  eventCancelled: "event_updates",
  eventRestored: "event_updates",
  occurrenceCancelledHost: "event_updates",
  occurrenceModifiedHost: "event_updates",
  rsvpConfirmation: "event_updates",
  waitlistOffer: "event_updates",
  waitlistPromotion: "event_updates",
  eventCommentNotification: "event_updates",
  rsvpHostNotification: "event_updates",
  weeklyOpenMicsDigest: "event_updates",
  weeklyHappeningsDigest: "event_updates",
  newsletterWelcome: "event_updates",
  suggestionResponse: "event_updates",
  cohostInvitation: "event_updates",
  attendeeInvitation: "event_updates",

  // Gallery-related templates
  collaboratorAdded: "event_updates",
  collaboratorInvited: "event_updates",

  // Admin-related templates
  adminEventClaimNotification: "admin_notifications",
  adminSuggestionNotification: "admin_notifications",
  contactNotification: "admin_notifications",
  feedbackNotification: "admin_notifications",
};

/**
 * Get the preference category for a given email template
 */
export function getEmailCategory(
  templateKey: string
): "claim_updates" | "event_updates" | "admin_notifications" | null {
  return EMAIL_CATEGORY_MAP[templateKey] ?? null;
}

/**
 * Check if a template is an essential email that bypasses preferences
 */
export function isEssentialEmail(templateKey: string): boolean {
  return ESSENTIAL_EMAILS.has(templateKey);
}
