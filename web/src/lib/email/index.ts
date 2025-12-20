/**
 * Email Module
 *
 * Transactional email system for DSC.
 * All emails are delivery + branding only — no mailing list enrollment.
 *
 * See docs/emails/EMAIL_STYLE_GUIDE.md for voice and tone guidelines.
 * See docs/emails/EMAIL_INVENTORY.md for complete use case listing.
 */

// Mailer
export { sendEmail, isEmailConfigured, ADMIN_EMAIL } from "./mailer";
export type { EmailPayload } from "./mailer";

// Rendering utilities
export {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  codeBlock,
  expiryWarning,
  createButton,
  createSecondaryLink,
  SITE_URL,
} from "./render";

// Registry (unified template access)
export {
  getTemplate,
  getAllTemplateKeys,
  getTemplateMetadata,
  TEMPLATE_REGISTRY,
  type EmailTemplateKey,
  type EmailTemplateParams,
  type EmailOutput,
  type TemplateMetadata,
} from "./registry";

// Individual templates (direct access)
// Guest templates
export {
  getVerificationCodeEmail,
  type VerificationCodeEmailParams,
} from "./templates/verificationCode";

export {
  getClaimConfirmedEmail,
  type ClaimConfirmedEmailParams,
} from "./templates/claimConfirmed";

export {
  getWaitlistOfferEmail,
  type WaitlistOfferEmailParams,
} from "./templates/waitlistOffer";

// Member templates
export {
  getRsvpConfirmationEmail,
  type RsvpConfirmationEmailParams,
} from "./templates/rsvpConfirmation";

export {
  getWaitlistPromotionEmail,
  type WaitlistPromotionEmailParams,
} from "./templates/waitlistPromotion";

export {
  getHostApprovalEmail,
  type HostApprovalEmailParams,
} from "./templates/hostApproval";

export {
  getHostRejectionEmail,
  type HostRejectionEmailParams,
} from "./templates/hostRejection";

// Admin templates
export {
  getContactNotificationEmail,
  type ContactNotificationEmailParams,
} from "./templates/contactNotification";

// Subscriber templates
export {
  getNewsletterWelcomeEmail,
  type NewsletterWelcomeEmailParams,
} from "./templates/newsletterWelcome";

// Event lifecycle templates (template only, not wired to triggers)
export {
  getEventReminderEmail,
  type EventReminderEmailParams,
} from "./templates/eventReminder";

export {
  getEventUpdatedEmail,
  type EventUpdatedEmailParams,
} from "./templates/eventUpdated";

export {
  getEventCancelledEmail,
  type EventCancelledEmailParams,
} from "./templates/eventCancelled";

// Suggestion response template
export {
  getSuggestionResponseEmail,
  type SuggestionResponseEmailParams,
  type SuggestionStatus,
} from "./templates/suggestionResponse";
