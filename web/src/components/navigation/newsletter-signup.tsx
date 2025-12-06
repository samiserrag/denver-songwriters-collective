"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function NewsletterSignup() {
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
      const supabase = createClient();

      const { error } = await supabase
        .from("newsletter_subscribers")
        .upsert(
          { email: email.toLowerCase().trim(), source: "footer" },
          { onConflict: "email", ignoreDuplicates: true }
        );

      if (error) {
        console.error("Newsletter signup error:", error);
        setStatus("error");
        setMessage("Something went wrong. Try again.");
        return;
      }

      setStatus("success");
      setMessage("You're in!");
      setEmail("");

      // Reset after 3 seconds
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 3000);
    } catch (err) {
      console.error("Newsletter signup error:", err);
      setStatus("error");
      setMessage("Something went wrong. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={status === "loading" || status === "success"}
          className="flex-1 px-3 py-2 bg-[var(--color-indigo-950)] border border-white/10 rounded-lg text-[var(--color-warm-white)] text-sm placeholder:text-[var(--color-warm-gray-dark)] focus:border-[var(--color-gold)] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="px-4 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "..." : status === "success" ? "✓" : "Join"}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${status === "error" ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
