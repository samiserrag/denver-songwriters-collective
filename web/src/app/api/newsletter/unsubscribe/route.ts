/**
 * One-Click Newsletter Unsubscribe Endpoint
 *
 * GET /api/newsletter/unsubscribe?email={email}&sig={hmacSignature}
 *
 * Validates HMAC-signed token, sets unsubscribed_at on newsletter_subscribers,
 * then redirects to confirmation page. No login required.
 *
 * Idempotent: calling multiple times has the same effect.
 *
 * Phase: GTM-3
 */

import { NextRequest, NextResponse } from "next/server";
import { validateNewsletterUnsubscribeToken } from "@/lib/digest/unsubscribeToken";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

const SITE_URL =
  process.env.PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://denversongwriterscollective.org";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const sig = request.nextUrl.searchParams.get("sig");

  // Validate required params
  if (!email || !sig) {
    console.warn("[NewsletterUnsubscribe] Missing email or sig param");
    return NextResponse.redirect(
      `${SITE_URL}/newsletter/unsubscribed?error=invalid`
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate HMAC signature
  if (!validateNewsletterUnsubscribeToken(normalizedEmail, sig)) {
    console.warn(
      `[NewsletterUnsubscribe] Invalid signature for email=${normalizedEmail}`
    );
    return NextResponse.redirect(
      `${SITE_URL}/newsletter/unsubscribed?error=invalid`
    );
  }

  // Set unsubscribed_at on newsletter_subscribers via service role (bypasses RLS)
  try {
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("email", normalizedEmail);

    if (error) {
      console.error("[NewsletterUnsubscribe] DB error:", error);
      return NextResponse.redirect(
        `${SITE_URL}/newsletter/unsubscribed?error=failed`
      );
    }

    console.log(
      `[NewsletterUnsubscribe] Successfully unsubscribed email=${normalizedEmail}`
    );

    return NextResponse.redirect(
      `${SITE_URL}/newsletter/unsubscribed?success=1`
    );
  } catch (error) {
    console.error("[NewsletterUnsubscribe] Unexpected error:", error);
    return NextResponse.redirect(
      `${SITE_URL}/newsletter/unsubscribed?error=failed`
    );
  }
}
