"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function sendMagicLink(email: string) {
  const supabase = createSupabaseBrowserClient();

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?type=magic`
      : undefined;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
