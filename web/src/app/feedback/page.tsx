"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageContainer, HeroSection } from "@/components/layout";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Category = "bug" | "feature" | "other";

export default function FeedbackPage() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category>("bug");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Hidden field for spam detection
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error" | "rate_limited">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Prefill from URL params (for deep-linking from early contributors, etc.)
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam && ["bug", "feature", "other"].includes(categoryParam)) {
      setCategory(categoryParam as Category);
    }
    const subjectParam = searchParams.get("subject");
    if (subjectParam) {
      setSubject(decodeURIComponent(subjectParam));
    }
    const pageUrlParam = searchParams.get("pageUrl");
    if (pageUrlParam) {
      setPageUrl(decodeURIComponent(pageUrlParam));
    }
  }, [searchParams]);

  // Prefill name/email if logged in
  useEffect(() => {
    const prefillUser = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (profile?.full_name) {
          setName(profile.full_name);
        }
        if (user.email) {
          setEmail(user.email);
        }
      }
    };

    prefillUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    // Basic validation
    if (!name || !email || !subject || !description) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (subject.length > 200) {
      setErrorMessage("Subject must be 200 characters or less.");
      return;
    }

    if (description.length > 5000) {
      setErrorMessage("Description must be 5000 characters or less.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStatus("sending");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          category,
          subject,
          description,
          pageUrl: pageUrl || null,
          honeypot, // Will be empty for real users
        }),
      });

      if (response.status === 429) {
        setStatus("rate_limited");
        setErrorMessage("You've submitted too many requests. Please try again later.");
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      setStatus("success");
      // Reset form
      setName("");
      setEmail("");
      setCategory("bug");
      setSubject("");
      setDescription("");
      setPageUrl("");
    } catch (err) {
      console.error("Feedback form error:", err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <PageContainer className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full text-center px-6">
          <div className="text-6xl mb-6 text-[var(--color-text-accent)]">✓</div>
          <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-4">
            Feedback Received
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Thank you for taking the time to share your feedback. We review all submissions but cannot respond individually.
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
            Submit Feedback
          </h1>
          <p className="text-lg text-white/90 drop-shadow">
            Report a bug, request a feature, or share your thoughts
          </p>
        </div>
      </HeroSection>

      <PageContainer className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Disclaimer */}
          <div className="mb-8 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-lg">
            <p className="text-sm text-[var(--color-text-secondary)]">
              We review all submissions but cannot respond individually. For urgent matters, please use the{" "}
              <Link href="/contact" className="text-[var(--color-text-accent)] hover:underline">
                contact form
              </Link>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot field - hidden from real users */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Your Name <span className="text-red-500">*</span>
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

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Email Address <span className="text-red-500">*</span>
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

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                required
                className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
              >
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="other">Other Feedback</option>
              </select>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Subject <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
                  ({subject.length}/200)
                </span>
              </label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, 200))}
                required
                maxLength={200}
                className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                placeholder="Brief summary of your feedback"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Description <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
                  ({description.length}/5000)
                </span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
                required
                maxLength={5000}
                rows={8}
                className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] resize-none"
                placeholder={
                  category === "bug"
                    ? "Please describe what happened, what you expected, and steps to reproduce if possible."
                    : category === "feature"
                    ? "Please describe the feature you'd like to see and why it would be helpful."
                    : "Share your thoughts, suggestions, or questions."
                }
              />
            </div>

            {/* Page URL (optional) */}
            <div>
              <label htmlFor="pageUrl" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Page URL <span className="text-[var(--color-text-tertiary)]">(optional)</span>
              </label>
              <input
                type="url"
                id="pageUrl"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
                placeholder="https://denversongwriterscollective.org/..."
              />
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                If this relates to a specific page, paste the URL here.
              </p>
            </div>

            {/* Error message */}
            {(status === "error" || status === "rate_limited" || errorMessage) && (
              <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-red-800 dark:text-red-300 text-sm">
                  {errorMessage || "Something went wrong. Please try again."}
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
            >
              {status === "sending" ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        </div>
      </PageContainer>
    </>
  );
}
