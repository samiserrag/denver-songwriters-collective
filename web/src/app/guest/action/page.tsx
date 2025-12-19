"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { isGuestVerificationEnabled } from "@/lib/featureFlags";
import { removeGuestClaim, getAllGuestClaims } from "@/lib/guest-verification/storage";

type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
};

type ValidationError = {
  type: "error";
  message: string;
};

type ValidationSuccess = {
  type: "valid";
  token: string;
  action: "confirm" | "cancel";
};

type ValidationResult = ValidationError | ValidationSuccess;

function GuestActionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const action = searchParams.get("action") as "confirm" | "cancel" | null;

  // Validate params synchronously using useMemo (not useEffect)
  const validation = useMemo((): ValidationResult => {
    if (!isGuestVerificationEnabled()) {
      return { type: "error", message: "This feature is not available" };
    }
    if (!token || !action) {
      return { type: "error", message: "Invalid link. Missing token or action." };
    }
    if (!["confirm", "cancel"].includes(action)) {
      return { type: "error", message: "Invalid action type." };
    }
    return { type: "valid", token, action };
  }, [token, action]);

  // If validation failed, start in error state
  const initialStatus = validation.type === "error" ? "error" : "loading";
  const initialResult = validation.type === "error" ? { success: false, error: validation.message } : null;

  const [status, setStatus] = useState<"loading" | "success" | "error">(initialStatus);
  const [result, setResult] = useState<ActionResult | null>(initialResult);

  useEffect(() => {
    // Skip if validation failed
    if (validation.type === "error") {
      return;
    }

    const { token: validToken, action: validAction } = validation;

    const performAction = async () => {
      try {
        const res = await fetch("/api/guest/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: validToken, action: validAction }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setResult({ success: false, error: data.error || "Failed to process action" });

          // If token already used or expired, clean up localStorage
          if (data.error?.includes("already") || data.error?.includes("expired")) {
            // Try to clean up any matching claims from localStorage
            const claims = getAllGuestClaims();
            claims.forEach((claim) => {
              if (claim.cancel_token === validToken) {
                removeGuestClaim(claim.event_id);
              }
            });
          }
          return;
        }

        setStatus("success");
        setResult({
          success: true,
          message: validAction === "confirm" ? "Slot confirmed successfully!" : "Claim cancelled successfully.",
        });

        // Clean up localStorage on cancel
        if (validAction === "cancel") {
          const claims = getAllGuestClaims();
          claims.forEach((claim) => {
            if (claim.cancel_token === validToken) {
              removeGuestClaim(claim.event_id);
            }
          });
        }
      } catch {
        setStatus("error");
        setResult({ success: false, error: "Network error. Please try again." });
      }
    };

    performAction();
  }, [validation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg-primary)]">
      <div className="w-full max-w-md">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-2xl shadow-xl overflow-hidden">
          {status === "loading" && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--color-text-accent)] animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Processing...
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                Please wait while we {action === "confirm" ? "confirm your slot" : "cancel your claim"}.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="p-8 text-center">
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
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                {action === "confirm" ? "Slot Confirmed!" : "Claim Cancelled"}
              </h1>
              <p className="text-[var(--color-text-secondary)] mb-6">
                {result?.message}
              </p>
              <Link
                href="/"
                className={cn(
                  "inline-flex items-center justify-center gap-2",
                  "w-full py-3 px-4 rounded-full font-medium",
                  "bg-[var(--color-accent-primary)] text-[var(--color-bg-secondary)]",
                  "hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--shadow-glow-gold-sm)]",
                  "transition-all"
                )}
              >
                Return to Home
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Something Went Wrong
              </h1>
              <p className="text-[var(--color-text-secondary)] mb-6">
                {result?.error || "An unexpected error occurred."}
              </p>
              <div className="space-y-3">
                <Link
                  href="/"
                  className={cn(
                    "inline-flex items-center justify-center gap-2",
                    "w-full py-3 px-4 rounded-full font-medium",
                    "bg-[var(--color-accent-primary)] text-[var(--color-bg-secondary)]",
                    "hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--shadow-glow-gold-sm)]",
                    "transition-all"
                  )}
                >
                  Return to Home
                </Link>
                <Link
                  href="/open-mics"
                  className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Browse Open Mics
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GuestActionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg-primary)]">
          <div className="w-full max-w-md">
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-2xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--color-text-accent)] animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <p className="text-[var(--color-text-secondary)]">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <GuestActionContent />
    </Suspense>
  );
}
