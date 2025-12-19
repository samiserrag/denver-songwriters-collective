"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ResetRequestPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/reset`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-bold mb-4">Reset your password</h1>

      {sent ? (
        <p className="text-green-500">
          Check your email for a reset link.
        </p>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            className="w-full border border-[var(--color-border-input)] px-3 py-2 rounded bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] mb-3"
          />
          {error && <p className="text-red-500 mb-3">{error}</p>}
          <button
            onClick={submit}
            className="px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] rounded transition-colors"
          >
            Send reset email
          </button>
        </>
      )}

      <div className="mt-4">
        <Link href="/login" className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
