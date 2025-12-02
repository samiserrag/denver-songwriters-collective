import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const provider = searchParams.get("provider") ?? undefined;

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", session.user.id)
      .single();

    const needsOnboarding = !profile?.role;

    // Handle Google OAuth
    if (provider === "google" || type === "google") {
      const redirectTo = needsOnboarding
        ? "/onboarding/role?google=1"
        : "/dashboard?google=1";
      return NextResponse.redirect(new URL(redirectTo, origin));
    }

    // Handle Magic Link login
    if (type === "magic" || type === "magiclink") {
      const redirectTo = needsOnboarding
        ? "/onboarding/role?magic=1"
        : "/dashboard?magic=1";
      return NextResponse.redirect(new URL(redirectTo, origin));
    }

    // Handle signup
    if (type === "signup") {
      return NextResponse.redirect(new URL("/onboarding/role?signup=1", origin));
    }

    // Next param support / default fallback
    const nextParam = searchParams.get("next");
    const next = nextParam ?? (needsOnboarding ? "/onboarding/role" : "/dashboard");
    return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
