"use client";

import { useState } from "react";

const MAX_COMMENT_LENGTH = 500;

// Guest comment flow states
type GuestFlowState = "idle" | "form" | "verification" | "success";

export type GuestCommentType =
  | "gallery_photo"
  | "gallery_album"
  | "blog"
  | "profile";

interface GuestCommentFormProps {
  /** Type of content being commented on */
  type: GuestCommentType;
  /** ID of the entity being commented on (image_id, album_id, post_id, or profile_id) */
  targetId: string;
  /** Callback when comment is successfully posted */
  onSuccess: () => void;
  /** Maximum comment length (defaults to 500) */
  maxLength?: number;
}

const API_ENDPOINTS: Record<GuestCommentType, string> = {
  gallery_photo: "/api/guest/gallery-photo-comment",
  gallery_album: "/api/guest/gallery-album-comment",
  blog: "/api/guest/blog-comment",
  profile: "/api/guest/profile-comment",
};

const ID_FIELD_NAMES: Record<GuestCommentType, string> = {
  gallery_photo: "image_id",
  gallery_album: "album_id",
  blog: "post_id",
  profile: "profile_id",
};

const LABELS: Record<GuestCommentType, { title: string; placeholder: string }> = {
  gallery_photo: { title: "Comment on photo", placeholder: "Share your thoughts about this photo..." },
  gallery_album: { title: "Comment on album", placeholder: "Share your thoughts about this album..." },
  blog: { title: "Comment on post", placeholder: "Share your thoughts..." },
  profile: { title: "Leave a comment", placeholder: "Say something nice..." },
};

/**
 * Guest Comment Form Component
 *
 * Reusable component for guest commenting with email verification.
 * Used by GalleryComments, BlogComments, and ProfileComments.
 */
export function GuestCommentForm({
  type,
  targetId,
  onSuccess,
  maxLength = MAX_COMMENT_LENGTH,
}: GuestCommentFormProps) {
  const [guestFlow, setGuestFlow] = useState<GuestFlowState>("idle");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestComment, setGuestComment] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiBase = API_ENDPOINTS[type];
  const idField = ID_FIELD_NAMES[type];
  const labels = LABELS[type];

  // Request verification code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${apiBase}/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [idField]: targetId,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim().toLowerCase(),
          content: guestComment.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send code");
      }

      setVerificationId(data.verification_id);
      setGuestFlow("verification");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  // Verify code and post comment
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${apiBase}/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: verificationId,
          code: verificationCode.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify code");
      }

      setGuestFlow("success");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  // Reset flow
  const resetGuestFlow = () => {
    setGuestFlow("idle");
    setGuestName("");
    setGuestEmail("");
    setGuestComment("");
    setVerificationId("");
    setVerificationCode("");
    setError("");
  };

  // Idle state: show sign in link + guest option
  if (guestFlow === "idle") {
    return (
      <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <p className="text-[var(--color-text-secondary)] mb-3 text-center text-sm">
          Sign in to leave a comment
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <a
            href={`/login?redirectTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`}
            className="px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] transition-colors text-center text-sm"
          >
            Sign In
          </a>
          <button
            onClick={() => setGuestFlow("form")}
            className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg font-medium hover:bg-[var(--color-bg-primary)] transition-colors text-sm"
          >
            Comment as Guest
          </button>
        </div>
      </div>
    );
  }

  // Form state: collect name, email, comment
  if (guestFlow === "form") {
    return (
      <form onSubmit={handleRequestCode} className="space-y-3 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{labels.title}</div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
            minLength={2}
            className="px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
          />
          <input
            type="email"
            placeholder="your@email.com"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            required
            className="px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
          />
        </div>

        <textarea
          placeholder={labels.placeholder}
          value={guestComment}
          onChange={(e) => setGuestComment(e.target.value.slice(0, maxLength))}
          rows={3}
          required
          maxLength={maxLength}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 resize-none"
        />

        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {guestComment.length}/{maxLength}
          </span>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            We&apos;ll send a verification code to confirm your email.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !guestName.trim() || !guestEmail.trim() || !guestComment.trim()}
            className="flex-1 px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {loading ? "Sending..." : "Send Verification Code"}
          </button>
          <button
            type="button"
            onClick={resetGuestFlow}
            className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg font-medium hover:bg-[var(--color-bg-primary)] transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // Verification state: enter code
  if (guestFlow === "verification") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-3 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">Enter Verification Code</div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          We sent a 6-digit code to <span className="font-medium">{guestEmail}</span>
        </p>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <input
          type="text"
          placeholder="ABC123"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6))}
          required
          maxLength={6}
          autoFocus
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-sm text-[var(--color-text-primary)] text-center tracking-widest font-mono placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || verificationCode.length !== 6}
            className="flex-1 px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {loading ? "Verifying..." : "Verify & Post Comment"}
          </button>
          <button
            type="button"
            onClick={resetGuestFlow}
            className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg font-medium hover:bg-[var(--color-bg-primary)] transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // Success state
  return (
    <div className="p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-emerald-300 font-semibold text-sm">Comment Posted!</p>
          <p className="text-emerald-400/80 text-xs">Thanks for sharing your thoughts.</p>
        </div>
      </div>
      <button
        onClick={resetGuestFlow}
        className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        Post another comment
      </button>
    </div>
  );
}
