/**
 * One-Click Digest Unsubscribe Endpoint
 *
 * GET /api/digest/unsubscribe?uid={userId}&sig={hmacSignature}
 *
 * Validates HMAC-signed token, sets email_event_updates=false,
 * then redirects to confirmation page. No login required.
 *
 * Idempotent: calling multiple times has the same effect.
 *
 * Phase: GTM-2
 */

import { NextRequest, NextResponse } from "next/server";
import { validateUnsubscribeToken } from "@/lib/digest/unsubscribeToken";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

const SITE_URL =
  process.env.PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://coloradosongwriterscollective.org";

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  const sig = request.nextUrl.searchParams.get("sig");

  // Validate required params
  if (!uid || !sig) {
    console.warn("[Unsubscribe] Missing uid or sig param");
    return NextResponse.redirect(
      `${SITE_URL}/digest/unsubscribed?error=invalid`
    );
  }

  // Validate HMAC signature
  if (!validateUnsubscribeToken(uid, sig)) {
    console.warn(`[Unsubscribe] Invalid signature for uid=${uid}`);
    return NextResponse.redirect(
      `${SITE_URL}/digest/unsubscribed?error=invalid`
    );
  }

  // Set email_event_updates=false via service role (bypasses RLS)
  try {
    const supabase = createServiceRoleClient();

    // Upsert notification_preferences to disable digest emails
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: uid,
          email_event_updates: false,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("[Unsubscribe] DB error:", error);
      return NextResponse.redirect(
        `${SITE_URL}/digest/unsubscribed?error=failed`
      );
    }

    console.log(`[Unsubscribe] Successfully unsubscribed uid=${uid}`);

    return NextResponse.redirect(`${SITE_URL}/digest/unsubscribed?success=1`);
  } catch (error) {
    console.error("[Unsubscribe] Unexpected error:", error);
    return NextResponse.redirect(
      `${SITE_URL}/digest/unsubscribed?error=failed`
    );
  }
}
