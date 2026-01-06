"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface SignUpResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<SignUpResult> {
  try {
    const supabase = createSupabaseBrowserClient();

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?type=signup`
        : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      console.error("Sign up error:", error.message);
      return { ok: false, error: error.message ?? "Unable to create account." };
    }

    return {
      ok: true,
      message: "Check your email for a confirmation link.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create account.";
    console.error("Sign up exception:", message);
    return { ok: false, error: message };
  }
}
