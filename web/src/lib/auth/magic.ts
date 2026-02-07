"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  applyReferralParams,
  sanitizeReferralParams,
  type ReferralParams,
} from "@/lib/referrals";

interface MagicLinkResult {
  ok: boolean;
  error?: string;
}

export async function sendMagicLink(
  email: string,
  referral?: ReferralParams,
): Promise<MagicLinkResult> {
  try {
    const supabase = createSupabaseBrowserClient();

    const redirectTo = typeof window !== "undefined"
      ? (() => {
          const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
          redirectUrl.searchParams.set("type", "magic");
          applyReferralParams(redirectUrl.searchParams, sanitizeReferralParams(referral));
          return redirectUrl.toString();
        })()
      : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      console.error("Magic link error:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to send magic link.";
    console.error("Magic link exception:", message);
    return { ok: false, error: message };
  }
}
