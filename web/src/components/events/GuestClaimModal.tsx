"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { saveGuestClaim } from "@/lib/guest-verification/storage";

interface GuestClaimModalProps {
  eventId: string;
  eventTitle: string;
  slotIndex: number;
  slotTime: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = "form" | "verify" | "success";

interface RequestCodeResponse {
  success: boolean;
  verification_id: string;
  expires_at: string;
  error?: string;
}

interface VerifyCodeResponse {
  success: boolean;
  claim: {
    id: string;
    status: "confirmed" | "waitlist";
    guest_name: string;
    waitlist_position: number | null;
    claimed_at: string;
  };
  action_urls: {
    confirm: string;
    cancel: string;
  };
  error?: string;
  attempts_remaining?: number;
}

export function GuestClaimModal({
  eventId,
  eventTitle,
  slotIndex,
  slotTime,
  isOpen,
  onClose,
  onSuccess,
}: GuestClaimModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");

  // Verification state
  const [verificationId, setVerificationId] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Success state
  const [claimResult, setClaimResult] = useState<VerifyCodeResponse["claim"] | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep("form");
      setError("");
      setGuestName("");
      setEmail("");
      setVerificationId("");
      setCode("");
      setExpiresAt(null);
      setAttemptsRemaining(null);
      setClaimResult(null);
    }
  }, [isOpen]);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    setTimeout(() => firstInputRef.current?.focus(), 0);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleRequestCode = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/guest/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          slot_index: slotIndex,
          guest_name: guestName.trim(),
          guest_email: email.trim().toLowerCase(),
        }),
      });

      const data: RequestCodeResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      setVerificationId(data.verification_id);
      setExpiresAt(new Date(data.expires_at));
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  }, [eventId, slotIndex, guestName, email]);

  const handleVerifyCode = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/guest/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: verificationId,
          code: code.toUpperCase().trim(),
        }),
      });

      const data: VerifyCodeResponse = await res.json();

      if (!res.ok) {
        if (data.attempts_remaining !== undefined) {
          setAttemptsRemaining(data.attempts_remaining);
        }
        throw new Error(data.error || "Invalid code");
      }

      // Save to localStorage for guest UX
      const cancelToken = new URL(data.action_urls.cancel).searchParams.get("token");
      saveGuestClaim(eventId, {
        claim_id: data.claim.id,
        guest_name: data.claim.guest_name,
        event_id: eventId,
        timeslot_id: verificationId, // We don't have timeslot_id here, use verification_id as fallback
        slot_index: slotIndex,
        status: data.claim.status,
        cancel_token: cancelToken || undefined,
        created_at: data.claim.claimed_at,
      });

      setClaimResult(data.claim);
      setStep("success");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }, [verificationId, code, eventId, slotIndex, onSuccess]);

  const handleResendCode = useCallback(async () => {
    setCode("");
    setError("");
    setAttemptsRemaining(null);
    await handleRequestCode();
  }, [handleRequestCode]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isNameValid = guestName.trim().length >= 2;
  const isCodeValid = code.trim().length === 6;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-claim-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors z-10"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {step === "form" && (
          <div className="p-6">
            <h2
              id="guest-claim-modal-title"
              className="text-xl font-semibold text-[var(--color-text-primary)] mb-2"
            >
              Claim Slot as Guest
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm mb-1">
              {eventTitle}
            </p>
            <p className="text-[var(--color-text-tertiary)] text-sm mb-6">
              Slot {slotIndex + 1} &bull; {slotTime}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRequestCode();
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="guest-name"
                  className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                >
                  Your Name
                </label>
                <input
                  ref={firstInputRef}
                  id="guest-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  minLength={2}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-lg",
                    "bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]",
                    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/50 focus:border-[var(--color-accent-primary)]",
                    "transition-colors"
                  )}
                />
              </div>

              <div>
                <label
                  htmlFor="guest-email"
                  className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="guest-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={cn(
                    "w-full px-4 py-2.5 rounded-lg",
                    "bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]",
                    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/50 focus:border-[var(--color-accent-primary)]",
                    "transition-colors"
                  )}
                />
                <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
                  We&apos;ll send a verification code to this email
                </p>
              </div>

              {error && (
                <div
                  className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                  role="alert"
                  aria-live="polite"
                >
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isNameValid || !isEmailValid}
                className={cn(
                  "w-full py-3 px-4 rounded-full font-medium transition-all",
                  "bg-[var(--color-accent-primary)] text-[var(--color-bg-secondary)]",
                  "hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--shadow-glow-gold-sm)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                )}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending Code...
                  </span>
                ) : (
                  "Send Verification Code"
                )}
              </button>
            </form>
          </div>
        )}

        {step === "verify" && (
          <div className="p-6">
            <h2
              id="guest-claim-modal-title"
              className="text-xl font-semibold text-[var(--color-text-primary)] mb-2"
            >
              Enter Verification Code
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm mb-6">
              We sent a 6-digit code to <span className="font-medium">{email}</span>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyCode();
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="verification-code"
                  className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                >
                  Verification Code
                </label>
                <input
                  ref={firstInputRef}
                  id="verification-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="XXXXXX"
                  required
                  maxLength={6}
                  autoComplete="one-time-code"
                  className={cn(
                    "w-full px-4 py-3 rounded-lg text-center text-2xl tracking-[0.3em] font-mono",
                    "bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]",
                    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/50 focus:border-[var(--color-accent-primary)]",
                    "transition-colors"
                  )}
                />
                {expiresAt && (
                  <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
                    Code expires in {Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000))} minutes
                  </p>
                )}
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <p className="mt-1 text-xs text-amber-400">
                    {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </div>

              {error && (
                <div
                  className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                  role="alert"
                  aria-live="polite"
                >
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isCodeValid}
                className={cn(
                  "w-full py-3 px-4 rounded-full font-medium transition-all",
                  "bg-[var(--color-accent-primary)] text-[var(--color-bg-secondary)]",
                  "hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--shadow-glow-gold-sm)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                )}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  "Verify & Claim Slot"
                )}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  &larr; Back
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-[var(--color-text-accent)] hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "success" && claimResult && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2
              id="guest-claim-modal-title"
              className="text-xl font-semibold text-[var(--color-text-primary)] mb-2"
            >
              {claimResult.status === "confirmed" ? "Slot Claimed!" : "Added to Waitlist"}
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-4">
              {claimResult.status === "confirmed" ? (
                <>You&apos;ve successfully claimed slot {slotIndex + 1} as <span className="font-medium">{claimResult.guest_name}</span>.</>
              ) : (
                <>You&apos;re #{claimResult.waitlist_position} on the waitlist. We&apos;ll notify you if a spot opens up.</>
              )}
            </p>
            <p className="text-[var(--color-text-tertiary)] text-sm mb-6">
              Check your email for confirmation details.
            </p>
            <button
              onClick={onClose}
              className={cn(
                "w-full py-3 px-4 rounded-full font-medium transition-all",
                "bg-[var(--color-accent-primary)] text-[var(--color-bg-secondary)]",
                "hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--shadow-glow-gold-sm)]"
              )}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
