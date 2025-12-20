"use client";

import { useState } from "react";
import { sendMagicLink } from "@/lib/auth/magic";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui";
import Link from "next/link";

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
    <PageContainer as="main" className="min-h-screen flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="w-full max-w-md card-base px-8 py-10">
          <h1 className="text-[var(--color-text-accent)] text-[length:var(--font-size-heading-lg)] font-[var(--font-family-serif)] italic mb-6 text-center">
            Magic Link
          </h1>
          <p className="text-center text-sm text-[var(--color-text-secondary)] mb-6">
            Password-free login — we&apos;ll email you a one-click sign-in link.
          </p>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm text-[var(--color-text-secondary)]">Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-accent)]/60"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
            Prefer a password?{" "}
            <Link href="/login" className="text-[var(--color-text-accent)] hover:underline">
              Log in with password
            </Link>
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
