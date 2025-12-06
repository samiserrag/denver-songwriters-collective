"use client";

import { useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout";

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
          <div className="text-6xl mb-6 text-[var(--color-gold)]">✓</div>
          <h1 className="font-display text-3xl text-white mb-4">
            Message Sent!
          </h1>
          <p className="text-neutral-300 mb-8">
            Thanks for reaching out. We&apos;ll get back to you soon.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-black font-medium rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="min-h-screen py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-4xl text-white mb-4">Contact Us</h1>
        <p className="text-neutral-400 mb-8">
          Have a question, suggestion, or want to get involved? We&apos;d love to hear from you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-neutral-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:border-[var(--color-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:border-[var(--color-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
              placeholder="jane@example.com"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-neutral-300 mb-2">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:border-[var(--color-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)] resize-none"
              placeholder="How can we help?"
            />
          </div>

          {status === "error" && (
            <p className="text-red-400 text-sm">
              Something went wrong. Please try again or email us directly at{" "}
              <a href="mailto:sami.serrag@gmail.com" className="underline">
                sami.serrag@gmail.com
              </a>
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-neutral-800">
          <h2 className="text-lg font-semibold text-white mb-4">Other Ways to Reach Us</h2>
          <p className="text-neutral-400">
            Email:{" "}
            <a href="mailto:sami.serrag@gmail.com" className="text-[var(--color-gold)] hover:underline">
              sami.serrag@gmail.com
            </a>
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
