"use client";

import { useState } from "react";

type FormState = "idle" | "form" | "verification" | "success";

interface GuestTimeslotClaimFormProps {
  eventId: string;
  timeslotId: string;
  slotLabel: string;
  onClaimSuccess: () => void;
  onCancel: () => void;
  /** Phase ABC6: date_key for per-occurrence timeslot claim scoping */
  dateKey?: string;
}

export function GuestTimeslotClaimForm({
  eventId,
  timeslotId,
  slotLabel,
  onClaimSuccess,
  onCancel,
  dateKey,
}: GuestTimeslotClaimFormProps) {
  const [formState, setFormState] = useState<FormState>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Phase ABC6: Include date_key in guest timeslot claim request
      const res = await fetch("/api/guest/timeslot-claim/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          timeslot_id: timeslotId,
          guest_name: name.trim(),
          guest_email: email.trim(),
          date_key: dateKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send verification code");
        setLoading(false);
        return;
      }

      setVerificationId(data.verification_id);
      setFormState("verification");
    } catch {
      setError("Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationId) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/guest/timeslot-claim/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: verificationId,
          code: code.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.attempts_remaining !== undefined) {
          setError(`Invalid code. ${data.attempts_remaining} attempts remaining.`);
        } else {
          setError(data.error || "Verification failed");
        }
        setLoading(false);
        return;
      }

      setFormState("success");
      setTimeout(() => {
        onClaimSuccess();
      }, 1500);
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (formState === "success") {
    return (
      <div className="text-center py-2">
        <div className="text-xl mb-1">🎤</div>
        <p className="text-[var(--color-text-accent)] font-medium text-sm">
          You&apos;re on the lineup!
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {slotLabel} is yours.
        </p>
      </div>
    );
  }

  if (formState === "verification") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-2">
        <p className="text-xs text-[var(--color-text-secondary)] text-center">
          Check your email for a code
        </p>

        {error && (
          <p className="text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded text-center">
            {error}
          </p>
        )}

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
          placeholder="ABC123"
          maxLength={6}
          autoComplete="one-time-code"
          className="w-full px-2 py-1.5 text-center text-base tracking-widest font-mono bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
        />

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setFormState("form")}
            disabled={loading}
            className="flex-1 px-2 py-1.5 text-xs font-medium rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="flex-1 px-2 py-1.5 text-xs font-medium rounded bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {loading ? "..." : "Verify"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestCode} className="space-y-2">
      <div className="text-center">
        <p className="font-medium text-sm text-[var(--color-text-primary)]">
          Claim {slotLabel}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          We&apos;ll email you a code
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-500/10 px-2 py-1 rounded text-center">
          {error}
        </p>
      )}

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        required
        minLength={2}
        className="w-full px-2 py-1.5 text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
      />

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        required
        className="w-full px-2 py-1.5 text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
      />

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-2 py-1.5 text-xs font-medium rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim() || !email.trim()}
          className="flex-1 px-2 py-1.5 text-xs font-medium rounded bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {loading ? "..." : "Send Code"}
        </button>
      </div>

      <p className="text-[10px] text-[var(--color-text-tertiary)] text-center">
        Have an account?{" "}
        <a href="/login" className="text-[var(--color-text-accent)] hover:underline">
          Sign in
        </a>
      </p>
    </form>
  );
}
