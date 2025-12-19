import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = ["/dashboard", "/booking", "/admin"];
const PROTECTED_PATTERNS = [/^\/studios\/[^/]+\/book\//];

function isProtectedPath(pathname: string): boolean {
  return (
    PROTECTED_PATHS.some((path) => pathname.startsWith(path)) ||
    PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname))
  );
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          res.cookies.set({
            name,
            value: "",
            ...options,
            maxAge: 0,
          });
        },
      },
    }
  );

  // Use getUser() instead of getSession() to properly validate the JWT
  // getSession() only reads from cookies and can be stale
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirectTo", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  // Fetch user profile to determine onboarding status
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single();

  // All onboarding paths should be accessible during onboarding
  const isOnboardingPath = pathname.startsWith("/onboarding");

  // User needs onboarding if onboarding_complete is false/null
  const needsOnboarding = !profile?.onboarding_complete;

  // Redirect to onboarding if not complete
  if (needsOnboarding && !isOnboardingPath) {
    const redirectUrl = new URL("/onboarding/profile", req.url);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/booking/:path*",
    "/admin/:path*",
    "/studios/:path*/book/:path*",
  ],
};
