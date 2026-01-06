"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface MagicLinkResult {
  ok: boolean;
  error?: string;
}

export async function sendMagicLink(email: string): Promise<MagicLinkResult> {
  try {
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
