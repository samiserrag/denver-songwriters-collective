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
            className="w-full border px-3 py-2 rounded bg-white text-black mb-3"
          />
          {error && <p className="text-red-500 mb-3">{error}</p>}
          <button
            onClick={submit}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Send reset email
          </button>
        </>
      )}

      <div className="mt-4">
        <Link href="/login" className="text-blue-400 underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
