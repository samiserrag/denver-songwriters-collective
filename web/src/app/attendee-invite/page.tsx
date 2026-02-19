"use client";

/**
 * PR5: Attendee Invite Accept Page
 *
 * Landing page for accepting attendee invite links to invite-only events.
 *
 * Two flows:
 * 1. Member invite (user_id-based): Reads invite_id from URL, auto-accepts via
 *    POST /api/attendee-invites/accept with { invite_id }.
 * 2. Non-member invite (email token): Reads token from URL, auto-accepts via
 *    POST /api/attendee-invites/accept-token with { token }.
 *
 * Pattern: mirrors /event-invite/page.tsx (co-host invite flow).
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setPendingRedirect } from "@/lib/auth/pendingRedirect";

interface AcceptSuccessResponse {
  success: true;
  already_accepted?: boolean;
  event: { id: string; title?: string; slug?: string | null };
}

function AttendeeInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const inviteId = searchParams.get("invite_id");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AcceptSuccessResponse | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  const handleAccept = async () => {
    if (!token && !inviteId) return;

    setIsLoading(true);
    setError(null);

    try {
      let response: Response;

      if (inviteId) {
        // Member flow: accept by invite_id
        response = await fetch("/api/attendee-invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_id: inviteId }),
        });
      } else {
        // Non-member flow: accept by token
        response = await fetch("/api/attendee-invites/accept-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setRequiresLogin(true);
          setIsLoading(false);
          return;
        }
        if (response.status === 429) {
          setError("Too many attempts. Please try again in a few minutes.");
          setIsLoading(false);
          return;
        }
        setError(data.error || "Failed to accept invite");
        setIsLoading(false);
        return;
      }

      setSuccess(data as AcceptSuccessResponse);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-accept when page loads
  useEffect(() => {
    if ((token || inviteId) && !success && !error && !isLoading) {
      handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, inviteId]);

  // No token or invite_id in URL
  if (!token && !inviteId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
            Invalid Invite Link
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            This invite link is missing required information. Please check the link and try again.
          </p>
          <Link href="/" className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    const eventUrl = success.event.slug
      ? `/events/${success.event.slug}`
      : `/events/${success.event.id}`;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            {success.already_accepted ? "Already Accepted!" : "You're In!"}
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            You now have access to{" "}
            <span className="font-medium text-[var(--color-text-primary)]">
              {success.event.title || "this event"}
            </span>
            .
          </p>
          <Link
            href={eventUrl}
            className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium"
          >
            View Event
          </Link>
        </div>
      </div>
    );
  }

  // Requires login state
  if (requiresLogin) {
    const returnParam = token
      ? `token=${encodeURIComponent(token)}`
      : `invite_id=${encodeURIComponent(inviteId!)}`;
    const returnUrl = `/attendee-invite?${returnParam}`;

    const handleLoginRedirect = () => {
      setPendingRedirect(returnUrl);
      router.push(`/login?redirectTo=${encodeURIComponent(returnUrl)}`);
    };

    const handleSignupRedirect = () => {
      setPendingRedirect(returnUrl);
      router.push(`/signup?redirectTo=${encodeURIComponent(returnUrl)}`);
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            You&apos;ve Been Invited!
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-4">
            Please log in or sign up to accept this invite.{" "}
            <span className="text-[var(--color-text-accent)]">
              We&apos;ll bring you right back here.
            </span>
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={handleLoginRedirect} className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium">
              Log In
            </button>
            <button onClick={handleSignupRedirect} className="inline-block px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded font-medium">
              Sign Up (Free)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Invite Error
          </h1>
          <p className="text-red-400 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium disabled:opacity-50"
            >
              Try Again
            </button>
            <Link href="/" className="inline-block px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded font-medium">
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
          <svg className="w-8 h-8 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

export default function AttendeeInvitePage() {
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
      <AttendeeInviteContent />
    </Suspense>
  );
}
