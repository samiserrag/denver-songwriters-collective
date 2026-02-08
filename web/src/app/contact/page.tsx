"use client";

import { useState } from "react";
import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !message) {
      return;
    }

    setStatus("sending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!response.ok) {
        throw new Error("Failed to send");
      }

      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      console.error("Contact form error:", err);
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <PageContainer className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full text-center px-6">
          <div className="text-6xl mb-6 text-[var(--color-text-accent)]">✓</div>
          <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-4">
            Message Sent!
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Thanks for reaching out. We&apos;ll get back to you soon.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-medium rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <>
      {/* Hero Section */}
      <HeroSection minHeight="xs" showVignette showBottomFade>
        <div className="text-center px-6 py-6">
          <h1 className="font-[var(--font-family-display)] font-bold text-4xl md:text-5xl text-white tracking-tight mb-2 drop-shadow-lg">
            Contact Us
          </h1>
          <p className="text-lg text-white/90 drop-shadow">
            Have a question, suggestion, or want to get involved?
          </p>
        </div>
      </HeroSection>

      <PageContainer className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              placeholder="jane@example.com"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] resize-none"
              placeholder="How can we help?"
            />
          </div>

          {status === "error" && (
            <p className="text-red-400 text-sm">
              Something went wrong. Please try again or email us directly at{" "}
              <a href="mailto:admin@coloradosongwriterscollective.org" className="underline">
                admin@coloradosongwriterscollective.org
              </a>
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          >
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>
        </form>

          <div className="mt-12 pt-8 border-t border-[var(--color-border-subtle)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Other Ways to Reach Us</h2>
            <p className="text-[var(--color-text-tertiary)]">
              Email:{" "}
              <a href="mailto:admin@coloradosongwriterscollective.org" className="text-[var(--color-text-accent)] hover:underline">
                admin@coloradosongwriterscollective.org
              </a>
            </p>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
