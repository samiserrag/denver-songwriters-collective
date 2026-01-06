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
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      console.error("[Google OAuth] Error:", error.message, error);
      return { ok: false, error: error.message };
    }

    // Log successful OAuth URL generation
    console.log("[Google OAuth] Response data:", data);
    console.log("[Google OAuth] OAuth URL:", data?.url);

    // If we have a URL but browser didn't redirect, manually redirect
    if (data?.url) {
      console.log("[Google OAuth] Manually redirecting to:", data.url);
      window.location.href = data.url;
    }

    // If successful, browser will redirect to Google OAuth
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to sign in with Google.";
    console.error("[Google OAuth] Exception:", message, err);
    return { ok: false, error: message };
  }
}
