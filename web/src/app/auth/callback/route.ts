import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  REFERRAL_COOKIE_NAME,
  hasReferralParams,
  sanitizeReferralParams,
  serializeReferralCookie,
} from "@/lib/referrals";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const provider = searchParams.get("provider") ?? undefined;
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const referral = sanitizeReferralParams(searchParams);

  console.log("[Auth Callback] Received request:", {
    hasCode: !!code,
    type,
    provider,
    error: errorParam,
    errorDescription,
  });

  // Handle OAuth errors (e.g., user denied access, provider error)
  if (errorParam) {
    console.error("[Auth Callback] OAuth error:", errorParam, errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || errorParam)}`
    );
  }

  if (code) {
    const cookieStore = await cookies();
    const isSecure = origin.startsWith("https://");

    if (hasReferralParams(referral)) {
      cookieStore.set({
        name: REFERRAL_COOKIE_NAME,
        value: serializeReferralCookie(referral),
        httpOnly: true,
        sameSite: "lax",
        secure: isSecure,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...(options as any) });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: "", ...(options as any), maxAge: 0 });
        },
      },
    },
  );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] Exchange code error:", error.message, error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, onboarding_complete")
      .eq("id", session.user.id)
      .single();

    const needsOnboarding = !profile?.onboarding_complete;

    const applyReferralToUrl = (path: string) => {
      const target = new URL(path, origin);
      if (hasReferralParams(referral)) {
        if (referral.ref) target.searchParams.set("ref", referral.ref);
        if (referral.via) target.searchParams.set("via", referral.via);
        if (referral.src) target.searchParams.set("src", referral.src);
      }
      return target;
    };

    // Handle Google OAuth
    if (provider === "google" || type === "google") {
      const redirectTo = needsOnboarding
        ? "/onboarding/profile?google=1"
        : "/dashboard?google=1";
      return NextResponse.redirect(applyReferralToUrl(redirectTo));
    }

    // Handle Magic Link login
    if (type === "magic" || type === "magiclink") {
      const redirectTo = needsOnboarding
        ? "/onboarding/profile?magic=1"
        : "/dashboard?magic=1";
      return NextResponse.redirect(applyReferralToUrl(redirectTo));
    }

    // Handle signup
    if (type === "signup") {
      return NextResponse.redirect(applyReferralToUrl("/onboarding/profile?signup=1"));
    }

    // Next param support / default fallback
    const nextParam = searchParams.get("next");
    const next = nextParam ?? (needsOnboarding ? "/onboarding/profile" : "/dashboard");
    return NextResponse.redirect(applyReferralToUrl(next));
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
