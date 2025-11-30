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
    return { ok: false, error: error.message ?? "Unable to create account." };
  }

  return {
    ok: true,
    message: "Check your email for a confirmation link.",
  };
}
