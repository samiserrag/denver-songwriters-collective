"use client";

import { useState } from "react";

interface NewsletterSectionProps {
  source?: string;
}

export function NewsletterSection({ source = "homepage" }: NewsletterSectionProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Try again.");
        return;
      }

      setStatus("success");
      setMessage(data.alreadySubscribed ? "You're already on the list!" : "Welcome aboard!");
      setEmail("");

      // Reset after 5 seconds
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 5000);
    } catch (err) {
      console.error("Newsletter signup error:", err);
      setStatus("error");
      setMessage("Something went wrong. Try again.");
    }
  };

  return (
    <section className="py-12 px-6 border-t border-[var(--color-border-default)] bg-gradient-to-br from-[var(--color-accent-primary)]/5 to-transparent">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="font-[var(--font-family-serif)] text-2xl md:text-3xl text-[var(--color-text-primary)] mb-3">
          Stay in the Loop
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-2">
          Get the inside scoop on Denver&apos;s songwriter scene — open mics, gatherings, and the occasional terrible pun.
        </p>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
          We promise to only email you when we have something actually worth saying. No spam, ever.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            disabled={status === "loading" || status === "success"}
            className="flex-1 px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          >
            {status === "loading" ? "Joining..." : status === "success" ? "You're In!" : "Join the DSC Newsletter"}
          </button>
        </form>

        {message && (
          <p className={`mt-3 text-sm ${status === "error" ? "text-red-800 dark:text-red-400" : "text-emerald-800 dark:text-emerald-400"}`}>
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
