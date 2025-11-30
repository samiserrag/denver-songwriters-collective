import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const isSignup = searchParams.get("type") === "signup";
  const isMagic = searchParams.get("type") === "magic";
  const isGoogle = searchParams.get("type") === "google";

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

    if (!error) {
      const nextParam = searchParams.get("next");
      const type = searchParams.get("type");

      let next = "/dashboard";

      if (nextParam) next = nextParam;
      if (type === "signup") next = "/dashboard?welcome=true";

      const redirectUrl = new URL(next, origin);

      if (isMagic) {
        redirectUrl.searchParams.set("magic", "1");
      }

      const isGoogle = searchParams.get("type") === "google";

      if (isGoogle) {
        redirectUrl.searchParams.set("google", "1");
      }

      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
