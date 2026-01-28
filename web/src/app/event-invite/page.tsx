"use client";

/**
 * Event Invite Accept Page - Phase 4.94
 *
 * Landing page for accepting event invite links.
 * Mirrors /venue-invite behavior:
 * - Reads token from URL
 * - Auto-accepts on mount
 * - Redirects to login if not authenticated (preserving token)
 * - Shows success/error states with appropriate CTAs
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface AcceptSuccessResponse {
  success: true;
  event: { id: string; title?: string; slug?: string | null };
  roleGranted: "host" | "cohost";
  message: string;
}

function EventInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AcceptSuccessResponse | null>(null);

  const handleAccept = async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/event-invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Not logged in - redirect to login with return URL
          router.push(
            `/login?redirect=/event-invite?token=${encodeURIComponent(token)}`
          );
          return;
        }
        setError(data.error || "Failed to accept invite");
        setIsLoading(false);
        return;
      }

      setSuccess(data as AcceptSuccessResponse);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Accept invite error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-accept when page loads with token
  useEffect(() => {
    if (token && !success && !error && !isLoading) {
      handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
            Invalid Invite Link
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            This invite link is missing the required token. Please check the link
            and try again.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    const roleLabel = success.roleGranted === "host" ? "host" : "co-host";
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Welcome!
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            You are now a {roleLabel} of{" "}
            <span className="font-medium text-[var(--color-text-primary)]">
              {success.event.title || "this event"}
            </span>
            !
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/events/${success.event.slug || success.event.id}`}
              className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium"
            >
              View Event
            </Link>
            <Link
              href="/dashboard/my-events"
              className="inline-block px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded font-medium"
            >
              Go to My Happenings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    // Determine if this is an "already has access" scenario (show different CTAs)
    const isAlreadyAccess = error.includes("already have access");
    const isHostAlreadyAssigned = error.includes("already has a primary host");

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
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
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            {isAlreadyAccess ? "Already a Host" : "Invite Error"}
          </h1>
          <p className="text-red-400 mb-6">
            {error}
            {isHostAlreadyAssigned && (
              <span className="block mt-2 text-[var(--color-text-secondary)]">
                Contact them to be added as a co-host instead.
              </span>
            )}
          </p>
          <div className="flex flex-col gap-3">
            {isAlreadyAccess ? (
              <>
                <Link
                  href="/dashboard/my-events"
                  className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium"
                >
                  Go to My Happenings
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={handleAccept}
                  disabled={isLoading}
                  className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium disabled:opacity-50"
                >
                  Try Again
                </button>
              </>
            )}
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded font-medium"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center animate-pulse">
          <svg
            className="w-8 h-8 text-[var(--color-text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
          Accepting Invite...
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Please wait while we process your invite.
        </p>
      </div>
    </div>
  );
}

export default function EventInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-[var(--color-text-tertiary)]">
            Loading...
          </div>
        </div>
      }
    >
      <EventInviteContent />
    </Suspense>
  );
}
