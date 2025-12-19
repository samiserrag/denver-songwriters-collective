/**
 * Email Module
 *
 * Transactional email system for guest verification.
 * All emails are delivery + branding only — no mailing list enrollment.
 */

export { sendEmail, isEmailConfigured, ADMIN_EMAIL } from "./mailer";
export type { EmailPayload } from "./mailer";

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
