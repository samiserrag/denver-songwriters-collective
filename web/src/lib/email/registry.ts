/**
 * Email Template Registry
 *
 * Single source of truth for all DSC email templates.
 * Provides type-safe template keys and a unified interface for generating emails.
 */

import {
  getVerificationCodeEmail,
  type VerificationCodeEmailParams,
} from "./templates/verificationCode";
import {
  getClaimConfirmedEmail,
  type ClaimConfirmedEmailParams,
} from "./templates/claimConfirmed";
import {
  getWaitlistOfferEmail,
  type WaitlistOfferEmailParams,
} from "./templates/waitlistOffer";
import {
  getRsvpConfirmationEmail,
  type RsvpConfirmationEmailParams,
} from "./templates/rsvpConfirmation";
import {
  getWaitlistPromotionEmail,
  type WaitlistPromotionEmailParams,
} from "./templates/waitlistPromotion";
import {
  getHostApprovalEmail,
  type HostApprovalEmailParams,
} from "./templates/hostApproval";
import {
  getHostRejectionEmail,
  type HostRejectionEmailParams,
} from "./templates/hostRejection";
import {
  getContactNotificationEmail,
  type ContactNotificationEmailParams,
} from "./templates/contactNotification";
import {
  getNewsletterWelcomeEmail,
  type NewsletterWelcomeEmailParams,
} from "./templates/newsletterWelcome";
import {
  getEventReminderEmail,
  type EventReminderEmailParams,
} from "./templates/eventReminder";
import {
  getEventUpdatedEmail,
  type EventUpdatedEmailParams,
} from "./templates/eventUpdated";
import {
  getEventCancelledEmail,
  type EventCancelledEmailParams,
} from "./templates/eventCancelled";

/**
 * All available email template keys
 */
export type EmailTemplateKey =
  | "verificationCode"
  | "claimConfirmed"
  | "waitlistOffer"
  | "rsvpConfirmation"
  | "waitlistPromotion"
  | "hostApproval"
  | "hostRejection"
  | "contactNotification"
  | "newsletterWelcome"
  | "eventReminder"
  | "eventUpdated"
  | "eventCancelled";

/**
 * Map of template keys to their parameter types
 */
export interface EmailTemplateParams {
  verificationCode: VerificationCodeEmailParams;
  claimConfirmed: ClaimConfirmedEmailParams;
  waitlistOffer: WaitlistOfferEmailParams;
  rsvpConfirmation: RsvpConfirmationEmailParams;
  waitlistPromotion: WaitlistPromotionEmailParams;
  hostApproval: HostApprovalEmailParams;
  hostRejection: HostRejectionEmailParams;
  contactNotification: ContactNotificationEmailParams;
  newsletterWelcome: NewsletterWelcomeEmailParams;
  eventReminder: EventReminderEmailParams;
  eventUpdated: EventUpdatedEmailParams;
  eventCancelled: EventCancelledEmailParams;
}

/**
 * Standard email output format
 */
export interface EmailOutput {
  subject: string;
  html: string;
  text: string;
}

/**
 * Template metadata for documentation and testing
 */
export interface TemplateMetadata {
  key: EmailTemplateKey;
  name: string;
  description: string;
  audience: "guest" | "member" | "admin" | "subscriber";
  hasLinks: boolean;
  requiresEventTitle: boolean;
}

/**
 * Registry of all templates with metadata
 */
export const TEMPLATE_REGISTRY: Record<EmailTemplateKey, TemplateMetadata> = {
  verificationCode: {
    key: "verificationCode",
    name: "Verification Code",
    description: "6-digit code for guest slot claims",
    audience: "guest",
    hasLinks: false,
    requiresEventTitle: true,
  },
  claimConfirmed: {
    key: "claimConfirmed",
    name: "Claim Confirmed",
    description: "Slot claim confirmation (confirmed or waitlist)",
    audience: "guest",
    hasLinks: true,
    requiresEventTitle: true,
  },
  waitlistOffer: {
    key: "waitlistOffer",
    name: "Waitlist Offer",
    description: "Spot opened up - guest promotion",
    audience: "guest",
    hasLinks: true,
    requiresEventTitle: true,
  },
  rsvpConfirmation: {
    key: "rsvpConfirmation",
    name: "RSVP Confirmation",
    description: "Event RSVP confirmation for members",
    audience: "member",
    hasLinks: true,
    requiresEventTitle: true,
  },
  waitlistPromotion: {
    key: "waitlistPromotion",
    name: "Waitlist Promotion",
    description: "Spot opened up - member promotion",
    audience: "member",
    hasLinks: true,
    requiresEventTitle: true,
  },
  hostApproval: {
    key: "hostApproval",
    name: "Host Approval",
    description: "Host application approved",
    audience: "member",
    hasLinks: true,
    requiresEventTitle: false,
  },
  hostRejection: {
    key: "hostRejection",
    name: "Host Rejection",
    description: "Host application not approved",
    audience: "member",
    hasLinks: true,
    requiresEventTitle: false,
  },
  contactNotification: {
    key: "contactNotification",
    name: "Contact Notification",
    description: "Contact form submission to admin",
    audience: "admin",
    hasLinks: true,
    requiresEventTitle: false,
  },
  newsletterWelcome: {
    key: "newsletterWelcome",
    name: "Newsletter Welcome",
    description: "Welcome email for newsletter subscribers",
    audience: "subscriber",
    hasLinks: true,
    requiresEventTitle: false,
  },
  eventReminder: {
    key: "eventReminder",
    name: "Event Reminder",
    description: "Reminder before event (tonight/tomorrow)",
    audience: "member",
    hasLinks: true,
    requiresEventTitle: true,
  },
  eventUpdated: {
    key: "eventUpdated",
    name: "Event Updated",
    description: "Event details changed (time/location)",
    audience: "member",
    hasLinks: true,
    requiresEventTitle: true,
  },
  eventCancelled: {
    key: "eventCancelled",
    name: "Event Cancelled",
    description: "Event has been cancelled",
    audience: "member",
    hasLinks: true,
    requiresEventTitle: true,
  },
};

/**
 * Get a template by key with proper typing
 *
 * @example
 * const email = getTemplate("verificationCode", {
 *   guestName: "John",
 *   eventTitle: "Open Mic",
 *   code: "ABC123",
 *   expiresInMinutes: 15,
 * });
 */
export function getTemplate<K extends EmailTemplateKey>(
  key: K,
  params: EmailTemplateParams[K]
): EmailOutput {
  switch (key) {
    case "verificationCode":
      return getVerificationCodeEmail(params as VerificationCodeEmailParams);
    case "claimConfirmed":
      return getClaimConfirmedEmail(params as ClaimConfirmedEmailParams);
    case "waitlistOffer":
      return getWaitlistOfferEmail(params as WaitlistOfferEmailParams);
    case "rsvpConfirmation":
      return getRsvpConfirmationEmail(params as RsvpConfirmationEmailParams);
    case "waitlistPromotion":
      return getWaitlistPromotionEmail(params as WaitlistPromotionEmailParams);
    case "hostApproval":
      return getHostApprovalEmail(params as HostApprovalEmailParams);
    case "hostRejection":
      return getHostRejectionEmail(params as HostRejectionEmailParams);
    case "contactNotification":
      return getContactNotificationEmail(params as ContactNotificationEmailParams);
    case "newsletterWelcome":
      return getNewsletterWelcomeEmail(params as NewsletterWelcomeEmailParams);
    case "eventReminder":
      return getEventReminderEmail(params as EventReminderEmailParams);
    case "eventUpdated":
      return getEventUpdatedEmail(params as EventUpdatedEmailParams);
    case "eventCancelled":
      return getEventCancelledEmail(params as EventCancelledEmailParams);
    default: {
      // Exhaustive check - this should never happen
      const _exhaustive: never = key;
      throw new Error(`Unknown template key: ${_exhaustive}`);
    }
  }
}

/**
 * Get all template keys
 */
export function getAllTemplateKeys(): EmailTemplateKey[] {
  return Object.keys(TEMPLATE_REGISTRY) as EmailTemplateKey[];
}

/**
 * Get template metadata
 */
export function getTemplateMetadata(key: EmailTemplateKey): TemplateMetadata {
  return TEMPLATE_REGISTRY[key];
}

// Re-export individual template functions for direct use
export {
  getVerificationCodeEmail,
  getClaimConfirmedEmail,
  getWaitlistOfferEmail,
  getRsvpConfirmationEmail,
  getWaitlistPromotionEmail,
  getHostApprovalEmail,
  getHostRejectionEmail,
  getContactNotificationEmail,
  getNewsletterWelcomeEmail,
  getEventReminderEmail,
  getEventUpdatedEmail,
  getEventCancelledEmail,
};

// Re-export param types
export type {
  VerificationCodeEmailParams,
  ClaimConfirmedEmailParams,
  WaitlistOfferEmailParams,
  RsvpConfirmationEmailParams,
  WaitlistPromotionEmailParams,
  HostApprovalEmailParams,
  HostRejectionEmailParams,
  ContactNotificationEmailParams,
  NewsletterWelcomeEmailParams,
  EventReminderEmailParams,
  EventUpdatedEmailParams,
  EventCancelledEmailParams,
};
