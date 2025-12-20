/**
 * Legacy Email Templates
 *
 * DEPRECATED: This file is maintained for backwards compatibility.
 * New code should import from @/lib/email instead.
 *
 * All templates have been consolidated into the new email system.
 * See docs/emails/EMAIL_INVENTORY.md for the complete list.
 */

// Re-export from the new email system for backwards compatibility
export {
  getRsvpConfirmationEmail,
  getWaitlistPromotionEmail,
  getHostApprovalEmail,
  getHostRejectionEmail,
} from "@/lib/email";

// Re-export types for backwards compatibility
export type {
  RsvpConfirmationEmailParams,
  WaitlistPromotionEmailParams,
  HostApprovalEmailParams,
  HostRejectionEmailParams,
} from "@/lib/email";
