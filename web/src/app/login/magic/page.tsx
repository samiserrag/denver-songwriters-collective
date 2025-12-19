"use client";

import { useState } from "react";
import { sendMagicLink } from "@/lib/auth/magic";
import { toast } from "sonner";

export default function MagicLoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await sendMagicLink(email);

    setLoading(false);

    if (!result.ok) {
      toast.error(result.error || "Unable to send magic link.");
      return;
    }

    toast.success("Magic link sent! Check your email.");
  }

  return (
    <div className="mx-auto max-w-md pt-20">
      <h1 className="text-3xl font-bold text-center mb-6">
        Log in with a Magic Link
      </h1>
      <p className="text-center text-sm text-[var(--color-text-tertiary)] mb-6">
        Password-free login — we’ll email you a one-click sign-in link.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded bg-black/40 p-3 text-[var(--color-text-primary)]"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-500 py-2 font-semibold"
        >
          {loading ? "Sending..." : "Send Magic Link"}
        </button>
      </form>
    </div>
  );
}
