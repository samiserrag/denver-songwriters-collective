"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

type FormState = "idle" | "form" | "verification" | "success";

interface GuestTimeslotClaimFormProps {
  eventId: string;
  timeslotId: string;
  slotLabel: string;
  onClaimSuccess: () => void;
  onCancel: () => void;
}

export function GuestTimeslotClaimForm({
  eventId,
  timeslotId,
  slotLabel,
  onClaimSuccess,
  onCancel,
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
      const res = await fetch("/api/guest/timeslot-claim/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          timeslot_id: timeslotId,
          guest_name: name.trim(),
          guest_email: email.trim(),
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
      <div className="p-4 text-center">
        <div className="text-2xl mb-2">🎤</div>
        <p className="text-[var(--color-text-accent)] font-medium">
          You&apos;re on the lineup!
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {slotLabel} is yours.
        </p>
      </div>
    );
  }

  if (formState === "verification") {
    return (
      <form onSubmit={handleVerifyCode} className="p-4 space-y-3">
        <div className="text-center mb-2">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Check your email for a verification code
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg text-center">
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
          className="w-full px-3 py-2 text-center text-xl tracking-widest font-mono bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFormState("form")}
            disabled={loading}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading || code.length < 6}
            className="flex-1"
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequestCode} className="p-4 space-y-3">
      <div className="text-center mb-2">
        <p className="font-medium text-[var(--color-text-primary)]">
          Claim {slotLabel}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          We&apos;ll email you a code to confirm
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg text-center">
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
        className="w-full px-3 py-2 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
      />

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        required
        className="w-full px-3 py-2 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={loading || !name.trim() || !email.trim()}
          className="flex-1"
        >
          {loading ? "Sending..." : "Send Code"}
        </Button>
      </div>

      <p className="text-xs text-[var(--color-text-tertiary)] text-center">
        Have an account?{" "}
        <a href="/login" className="text-[var(--color-text-accent)] hover:underline">
          Sign in
        </a>
      </p>
    </form>
  );
}
