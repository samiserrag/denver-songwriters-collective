"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui";
import Link from "next/link";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message || "Unable to sign up.");
      return;
    }

    router.push(redirectTo);
  }

  return (
    <div className="w-full max-w-md card-base px-8 py-10">
      <h1 className="text-gradient-gold text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] italic mb-6 text-center">
        Sign up
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm text-[var(--color-warm-gray-light)]">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-[var(--color-warm-white)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/60"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[var(--color-warm-gray-light)]">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-[var(--color-warm-white)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/60"
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[var(--color-warm-gray-light)]">Confirm password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-[var(--color-warm-white)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/60"
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-warm-gray)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--color-gold)] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <PageContainer as="main" className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<div className="text-neutral-400">Loading...</div>}>
        <SignupForm />
      </Suspense>
    </PageContainer>
  );
}
