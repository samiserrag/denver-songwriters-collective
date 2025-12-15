"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui";
import { toast } from "sonner";
import Link from "next/link";
import { signInWithGoogle } from "@/lib/auth/google";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, resendConfirmationEmail } = useAuth();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [user, authLoading, router, redirectTo]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="w-full max-w-md card-base px-8 py-10 text-center">
        <p className="text-neutral-400">Checking authentication...</p>
      </div>
    );
  }

  // If user is logged in, show redirecting message
  if (user) {
    return (
      <div className="w-full max-w-md card-base px-8 py-10 text-center">
        <p className="text-neutral-400">Redirecting...</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      if (error.message?.includes("Email not confirmed")) {
        setError("You must confirm your email before logging in. Check your inbox.");
        toast.error(
          error.message.includes("email") && error.message.includes("confirm")
            ? "Please confirm your email before logging in."
            : error.message
        );
        return;
      }
      setError(error.message || "Unable to sign in.");
      return;
    }

    // Refresh to sync auth state with server before redirecting
    router.refresh();
    router.push(redirectTo);
  }

  return (
    <div className="w-full max-w-md card-base px-8 py-10">
      <h1 className="text-gradient-gold text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] italic mb-6 text-center">
        Log in
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm text-[var(--color-text-secondary)]">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[var(--color-text-secondary)]">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
            {error === "You must confirm your email before logging in. Check your inbox." && (
              <button
                type="button"
                className="text-sm text-[var(--color-text-accent)] underline hover:text-[var(--color-gold-200)]"
                onClick={async () => {
                  const res = await resendConfirmationEmail(email);
                  if (res.success) {
                    toast.success("Confirmation email sent!");
                  } else {
                    toast.error(res.error || "Failed to send email");
                  }
                }}
              >
                Resend confirmation email
              </button>
            )}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center">
        <Link
          href="/auth/reset-request"
          className="text-sm text-blue-400 hover:underline"
        >
          Forgot your password?
        </Link>
        <br />
        <Link
          href="/login/magic"
          className="text-sm text-blue-400 hover:underline"
        >
          Log in with a magic link
        </Link>
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        className="w-full mt-4 bg-white text-black py-2 rounded border border-gray-300 hover:bg-gray-100"
      >
        Continue with Google
      </button>


      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Need an account?{" "}
        <Link href="/signup" className="text-[var(--color-text-accent)] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PageContainer as="main" className="min-h-screen flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 py-12">
        <Suspense fallback={<div className="text-neutral-400">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </PageContainer>
  );
}
