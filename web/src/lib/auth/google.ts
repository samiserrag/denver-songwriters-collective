"use client";

import { createClient } from "@/lib/supabase/client";

interface GoogleSignInResult {
  ok: boolean;
  error?: string;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?type=google`,
      },
    });

    if (error) {
      console.error("Google sign-in error:", error.message);
      return { ok: false, error: error.message };
    }

    // If successful, browser will redirect to Google OAuth
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to sign in with Google.";
    console.error("Google sign-in exception:", message);
    return { ok: false, error: message };
  }
}
