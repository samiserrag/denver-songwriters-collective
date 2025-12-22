"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUpWithEmail } from "@/lib/auth/signUp";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui";
import Link from "next/link";
import { toast } from "sonner";
import { signInWithGoogle } from "@/lib/auth/google";
import { sendMagicLink } from "@/lib/auth/magic";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _redirectTo = searchParams.get("redirectTo") ?? "/"; // Reserved for future use
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitted] = React.useState(false); // Submit state (redirect handles success)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const result = await signUpWithEmail(email, password);

    if (!result.ok) {
      setError(result.error || "Signup failed.");
      setLoading(false);
      return;
    }

    // Redirect to confirmation sent page
    router.push(`/auth/confirm-sent?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="w-full max-w-md card-base px-8 py-10">
      <h1 className="text-[var(--color-text-accent)] text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] italic mb-6 text-center">
        Sign up
      </h1>

      {!submitted ? (
        <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm text-[var(--color-text-secondary)]">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
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
            className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[var(--color-text-secondary)]">Confirm password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
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
      ) : (
        <div className="text-center py-8 text-[var(--color-text-accent)]">
          <h2 className="text-xl font-semibold mb-2">Check your email</h2>
          <p className="text-[var(--color-text-secondary)] mb-4">
            We&apos;ve sent a confirmation link to <strong className="text-[var(--color-text-primary)]">{email}</strong>.
            Click the link to activate your account.
          </p>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Didn&apos;t receive the email? Check your spam or junk folder.
          </p>
        </div>
      )}

      {!submitted && (
        <div className="mt-6 space-y-3 text-center">
          <button
            onClick={async () => {
              const result = await sendMagicLink(email);
              if (!result.ok) toast.error(result.error || "Unable to send magic link.");
              else toast.success("Magic link sent! Check your email.");
            }}
            className="text-sm text-[var(--color-link)] hover:underline w-full"
          >
            Sign up with a magic link
          </button>

          <button
            onClick={() => signInWithGoogle()}
            className="w-full rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] py-2 font-semibold hover:border-[var(--color-border-accent)] transition-colors"
          >
            Continue with Google
          </button>

          <p className="text-sm text-[var(--color-text-tertiary)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--color-text-accent)] hover:underline">
              Log in
            </Link>
          </p>

          <p className="text-xs text-[var(--color-text-tertiary)] mt-4">
            By signing up, you agree to our{" "}
            <Link href="/privacy" className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default function SignupPage() {
  return (
    <PageContainer as="main" className="min-h-screen flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 py-12">
        <Suspense fallback={<div className="text-[var(--color-text-tertiary)]">Loading...</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </PageContainer>
  );
}
