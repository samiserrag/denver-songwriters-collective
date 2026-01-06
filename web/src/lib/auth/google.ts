"use client";

import { createClient } from "@/lib/supabase/client";

interface GoogleSignInResult {
  ok: boolean;
  error?: string;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?type=google`;

    console.log("[Google OAuth] Starting sign-in, redirect URL:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error("[Google OAuth] Error:", error.message, error);
      return { ok: false, error: error.message };
    }

    // Log successful OAuth URL generation
    console.log("[Google OAuth] OAuth URL generated:", data?.url ? "yes" : "no");

    // If successful, browser will redirect to Google OAuth
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to sign in with Google.";
    console.error("[Google OAuth] Exception:", message, err);
    return { ok: false, error: message };
  }
}
