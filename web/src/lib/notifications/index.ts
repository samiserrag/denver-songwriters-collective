/**
 * Notifications Module
 *
 * Centralized exports for notification-related functionality.
 */

// Preferences
export {
  getPreferences,
  upsertPreferences,
  shouldSendEmail,
  getEmailCategory,
  DEFAULT_PREFERENCES,
  EMAIL_CATEGORY_MAP,
  type NotificationPreferences,
} from "./preferences";
