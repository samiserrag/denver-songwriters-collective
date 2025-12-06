import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = ["/dashboard", "/events/manage", "/booking", "/admin"];
const PROTECTED_PATTERNS = [/^\/studios\/[^/]+\/book\//];

function isProtectedPath(pathname: string): boolean {
  return (
    PROTECTED_PATHS.some((path) => pathname.startsWith(path)) ||
    PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname))
  );
}

export async function middleware(req: NextRequest) {
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
    .select("role, onboarding_complete")
    .eq("id", user.id)
    .single();

  // User needs onboarding if they have no role set
  const needsRoleSelection = !profile?.role;

  // All onboarding paths should be accessible during onboarding
  const onboardingPaths = ["/onboarding/role", "/onboarding/profile", "/onboarding/complete"];
  const isOnboardingPath = onboardingPaths.some(p => pathname.startsWith(p));

  // If user needs to select a role and isn't on an onboarding page, redirect to role selection
  if (needsRoleSelection && !isOnboardingPath) {
    const redirectUrl = new URL("/onboarding/role", req.url);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/events/manage/:path*",
    "/booking/:path*",
    "/admin/:path*",
    "/studios/:path*/book/:path*",
  ],
};
