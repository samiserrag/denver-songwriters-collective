/**
 * Legacy Email Entry Point
 *
 * DEPRECATED: This file is maintained for backwards compatibility.
 * New code should import from @/lib/email/index.ts instead:
 *
 *   import { sendEmail, getTemplate } from "@/lib/email";
 *
 * See docs/emails/EMAIL_INVENTORY.md for the complete list of templates.
 * See docs/emails/EMAIL_STYLE_GUIDE.md for voice and tone guidelines.
 */

// Re-export everything from the new email module
export * from "./email/index";
