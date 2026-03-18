"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { setPendingRedirect } from "@/lib/auth/pendingRedirect";

interface OrganizationInviteSuccessResponse {
  success: true;
  organization: { id: string; name?: string; slug?: string | null };
  roleGranted: "owner" | "manager";
  message: string;
}

function OrganizationInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<OrganizationInviteSuccessResponse | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  const handleAccept = async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/organization-invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setRequiresLogin(true);
          setIsLoading(false);
          return;
        }
        setError(data.error || "Failed to accept invite");
        setIsLoading(false);
        return;
      }

      setSuccess(data as OrganizationInviteSuccessResponse);
    } catch (acceptError) {
      console.error("Accept organization invite error:", acceptError);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token && !success && !error && !isLoading) {
      handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
            Invalid Invite Link
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            This invite link is missing the required token. Please check the link and try again.
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

  if (success) {
    const roleLabel = success.roleGranted === "owner" ? "owner" : "manager";
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
            You are now an {roleLabel} of{" "}
            <span className="font-medium text-[var(--color-text-primary)]">
              {success.organization.name || "this organization"}
            </span>
            .
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/friends-of-the-collective"
              className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium"
            >
              View Directory
            </Link>
            <Link
              href="/dashboard/my-organizations"
              className="inline-block px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded font-medium"
            >
              Go to My Organizations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (requiresLogin) {
    const returnUrl = `/organization-invite?token=${encodeURIComponent(token)}`;

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
            <svg
              className="w-8 h-8 text-[var(--color-accent-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            You&apos;ve Been Invited
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-4">
            Log in or sign up (free) to accept this organization invite. We&apos;ll bring you right
            back here.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleLoginRedirect}
              className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium"
            >
              Log In
            </button>
            <button
              onClick={handleSignupRedirect}
              className="inline-block px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded font-medium"
            >
              Sign Up (Free)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const hasAccessAlready = error.includes("already have access");
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
            {hasAccessAlready ? "Already a Manager" : "Invite Error"}
          </h1>
          <p className="text-red-400 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            {!hasAccessAlready && (
              <button
                onClick={handleAccept}
                disabled={isLoading}
                className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium disabled:opacity-50"
              >
                Try Again
              </button>
            )}
            <Link
              href={hasAccessAlready ? "/dashboard/my-organizations" : "/"}
              className="inline-block px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded font-medium"
            >
              {hasAccessAlready ? "Go to My Organizations" : "Go Home"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
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

export default function OrganizationInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-[var(--color-text-tertiary)]">Loading...</div>
        </div>
      }
    >
      <OrganizationInviteContent />
    </Suspense>
  );
}
