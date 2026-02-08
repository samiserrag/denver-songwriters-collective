/**
 * Email Mailer
 *
 * SMTP transport using Fastmail with secure configuration.
 * Minimal logging (no email bodies, tokens, or credentials).
 */

import nodemailer from "nodemailer";
import { DEFAULT_EMAIL_HEADER_IMAGE } from "./render";
import { getServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

// Rate limiting cache: email+template -> last sent timestamp
const rateLimitCache = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 1000; // 1 minute per email per template

// Cached email header image URL from site settings (5-minute TTL)
let _cachedHeaderImageUrl: string | null = null;
let _cachedHeaderImageAt = 0;
const HEADER_IMAGE_CACHE_MS = 5 * 60 * 1000;

async function getEmailHeaderImageUrl(): Promise<string | null> {
  if (_cachedHeaderImageUrl !== null && Date.now() - _cachedHeaderImageAt < HEADER_IMAGE_CACHE_MS) {
    return _cachedHeaderImageUrl;
  }
  try {
    const supabase = getServiceRoleClient();
    const { data } = await (supabase as any)
      .from("site_settings")
      .select("email_header_image_url")
      .eq("id", "global")
      .single();
    const url = data?.email_header_image_url || null;
    _cachedHeaderImageUrl = url;
    _cachedHeaderImageAt = Date.now();
    return url;
  } catch {
    return null;
  }
}

/**
 * Get configured SMTP transporter
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  templateName?: string;
  replyTo?: string;
}

// Admin email for receiving contact form submissions
export const ADMIN_EMAIL = "sami@coloradosongwriterscollective.org";

/**
 * Send an email via SMTP
 *
 * Logging rules:
 * - Template name: logged
 * - Recipient domain only: logged (never full email)
 * - Email body: NEVER logged
 * - Tokens: NEVER logged
 * - Credentials: NEVER logged
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const { to, subject, html, text, templateName, replyTo } = payload;

  // Normalize to to a string for logging
  const toStr = Array.isArray(to) ? to[0] : to;
  const recipientDomain = toStr.split("@")[1] || "unknown";
  const logName = templateName || "email";

  // Rate limit check (only for templated emails)
  if (templateName) {
    const rateLimitKey = `${toStr}:${templateName}`;
    const lastSent = rateLimitCache.get(rateLimitKey);
    if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
      console.log(`[Email] Rate limited: ${logName} to @${recipientDomain}`);
      return false;
    }
  }

  // Replace default header image with admin-configured URL from site settings
  const siteHeaderUrl = await getEmailHeaderImageUrl();
  let finalHtml = html;
  if (siteHeaderUrl && siteHeaderUrl !== DEFAULT_EMAIL_HEADER_IMAGE) {
    finalHtml = html.replace(DEFAULT_EMAIL_HEADER_IMAGE, siteHeaderUrl);
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[Email] SMTP not configured, skipping: ${logName}`);
    return false;
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || "The Colorado Songwriters Collective";

  if (!fromEmail) {
    console.log(`[Email] SMTP_FROM_EMAIL not set, skipping: ${logName}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html: finalHtml,
      text,
      replyTo,
    });

    // Update rate limit cache (only for templated emails)
    if (templateName) {
      const rateLimitKey = `${toStr}:${templateName}`;
      rateLimitCache.set(rateLimitKey, Date.now());
    }

    console.log(`[Email] Sent: ${logName} to @${recipientDomain}`);
    return true;
  } catch (error) {
    // Log error without sensitive details
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Email] Failed: ${logName} to @${recipientDomain} - ${errorMessage}`);
    return false;
  }
}

/**
 * Check if SMTP is configured
 */
export function isEmailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.SMTP_FROM_EMAIL
  );
}
