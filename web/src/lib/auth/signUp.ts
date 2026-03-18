"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  applyReferralParams,
  sanitizeReferralParams,
  type ReferralParams,
} from "@/lib/referrals";

interface SignUpResult {
  ok: boolean;
  error?: string;
  message?: string;
  requiresEmailConfirmation?: boolean;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  referral?: ReferralParams,
): Promise<SignUpResult> {
  try {
    const supabase = createSupabaseBrowserClient();

    const redirectTo = typeof window !== "undefined"
      ? (() => {
          const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
          redirectUrl.searchParams.set("type", "signup");
          applyReferralParams(redirectUrl.searchParams, sanitizeReferralParams(referral));
          return redirectUrl.toString();
        })()
      : undefined;

    console.log("[Email Signup] Starting signup for:", email, "redirect:", redirectTo);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      console.error("[Email Signup] Error:", error.message, error);
      return { ok: false, error: error.message ?? "Unable to create account." };
    }

    // user can be null for existing accounts (anti-enumeration). When session or
    // confirmed_at/email_confirmed_at is present, the account is already active.
    const hasSession = !!data?.session;
    const hasConfirmedUser = !!(data?.user?.email_confirmed_at || data?.user?.confirmed_at);
    const requiresEmailConfirmation = !hasSession && !hasConfirmedUser;

    console.log(
      "[Email Signup] Success - user created:",
      !!data?.user,
      "session:",
      hasSession,
      "requiresEmailConfirmation:",
      requiresEmailConfirmation,
    );

    return {
      ok: true,
      message: requiresEmailConfirmation
        ? "Check your email for a confirmation link."
        : "Account created successfully.",
      requiresEmailConfirmation,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create account.";
    console.error("[Email Signup] Exception:", message, err);
    return { ok: false, error: message };
  }
}
