/**
 * Email Module
 *
 * Transactional email system for CSC.
 * All emails are delivery + branding only — no mailing list enrollment.
 *
 * See docs/emails/EMAIL_STYLE_GUIDE.md for voice and tone guidelines.
 * See docs/emails/EMAIL_INVENTORY.md for complete use case listing.
 */

// Mailer
export { sendEmail, isEmailConfigured, ADMIN_EMAIL } from "./mailer";
export type { EmailPayload } from "./mailer";

// Preference-aware sending
export {
  sendEmailWithPreferences,
  sendAdminEmailWithPreferences,
  type SendWithPreferencesOptions,
  type SendWithPreferencesResult,
} from "./sendWithPreferences";

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

// Event claim templates
export {
  getEventClaimSubmittedEmail,
  type EventClaimSubmittedEmailParams,
} from "./templates/eventClaimSubmitted";

export {
  getEventClaimApprovedEmail,
  type EventClaimApprovedEmailParams,
} from "./templates/eventClaimApproved";

export {
  getEventClaimRejectedEmail,
  type EventClaimRejectedEmailParams,
} from "./templates/eventClaimRejected";

export {
  getAdminEventClaimNotificationEmail,
  type AdminEventClaimNotificationEmailParams,
} from "./templates/adminEventClaimNotification";

export {
  getAdminSuggestionNotificationEmail,
  type AdminSuggestionNotificationEmailParams,
} from "./templates/adminSuggestionNotification";

// Occurrence override templates
export {
  getOccurrenceCancelledHostEmail,
  type OccurrenceCancelledHostEmailParams,
} from "./templates/occurrenceCancelledHost";

export {
  getOccurrenceModifiedHostEmail,
  type OccurrenceModifiedHostEmailParams,
} from "./templates/occurrenceModifiedHost";

// Comment notification template
export {
  getEventCommentNotificationEmail,
  type EventCommentNotificationEmailParams,
} from "./templates/eventCommentNotification";

// Co-host invitation template
export {
  getCohostInvitationEmail,
  type CohostInvitationEmailParams,
} from "./templates/cohostInvitation";

export {
  getAttendeeInvitationEmail,
  type AttendeeInvitationEmailParams,
} from "./templates/attendeeInvitation";

// Feedback notification template
export {
  getFeedbackNotificationEmail,
  type FeedbackNotificationEmailParams,
} from "./templates/feedbackNotification";
