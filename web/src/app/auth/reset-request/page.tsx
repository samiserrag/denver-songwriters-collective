"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ResetRequestPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setError("");
    setLoading(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/reset`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      // Handle rate limiting specifically
      if (error.message.includes("rate") || error.message.includes("limit")) {
        setError("Too many requests. Please wait a minute before trying again.");
      } else {
        setError(error.message);
      }
    } else {
      setSent(true);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
        Reset your password
      </h1>

      {sent ? (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-400 font-medium mb-2">
              Check your email for a reset link
            </p>
            <p className="text-[var(--color-text-secondary)] text-sm">
              We sent a password reset link to <strong>{email}</strong>
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-amber-400 text-sm font-medium mb-1">
              Didn&apos;t receive an email?
            </p>
            <ul className="text-[var(--color-text-secondary)] text-sm space-y-1 list-disc list-inside">
              <li>Check your spam or junk folder</li>
              <li>Make sure you entered the correct email</li>
              <li>The link expires in 1 hour</li>
            </ul>
          </div>

          <button
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline text-sm"
          >
            Try a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[var(--color-text-secondary)] text-sm mb-4">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full border border-[var(--color-border-input)] px-3 py-2 rounded bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}

      <div className="mt-6 pt-4 border-t border-[var(--color-border-secondary)]">
        <Link
          href="/login"
          className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline text-sm"
        >
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
