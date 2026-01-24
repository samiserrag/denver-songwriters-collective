"use client";

import { useState, useEffect, Suspense } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "expired">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check for error params (from Supabase redirect on expired/invalid links)
  const errorParam = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  useEffect(() => {
    async function initializeSession() {
      // Check if we have an error from Supabase (expired/invalid link)
      if (errorParam || errorCode) {
        setStatus("expired");
        setErrorMessage(
          errorDescription?.replace(/\+/g, " ") ||
          "This password reset link has expired or is invalid."
        );
        setInitializing(false);
        return;
      }

      // Check if there's a code in the URL hash (Supabase PKCE flow)
      // Supabase sometimes puts the tokens in the hash fragment
      if (typeof window !== "undefined") {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (accessToken && type === "recovery") {
          // Set the session from hash params
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          });

          if (error) {
            setStatus("expired");
            setErrorMessage("This password reset link has expired or is invalid.");
            setInitializing(false);
            return;
          }

          // Get user email for the form
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            setUserEmail(user.email);
          }

          setSessionReady(true);
          setInitializing(false);
          // Clean up the URL
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      }

      // Check for existing session (user might already be authenticated via callback)
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Get user email for the form
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }
        setSessionReady(true);
        setInitializing(false);
        return;
      }

      // No session and no tokens - this is an invalid state
      setStatus("expired");
      setErrorMessage(
        "No active session found. Please request a new password reset link."
      );
      setInitializing(false);
    }

    initializeSession();
  }, [supabase, errorParam, errorCode, errorDescription]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setStatus("loading");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("success");
      // Sign out after password change to force re-login with new password
      await supabase.auth.signOut();
      setTimeout(() => router.push("/login?reset=success"), 2000);
    }
  }

  // Show loading state while initializing
  if (initializing) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <p className="text-[var(--color-text-secondary)]">Verifying reset link...</p>
      </div>
    );
  }

  // Show expired/error state
  if (status === "expired") {
    return (
      <div className="max-w-md mx-auto py-12">
        <h1 className="text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
          Reset Link Expired
        </h1>
        <div className="bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{errorMessage}</p>
        </div>
        <p className="text-[var(--color-text-secondary)] mb-4">
          Password reset links expire after 1 hour for security. Please request a new one.
        </p>
        <Link
          href="/auth/reset-request"
          className="inline-block px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] rounded transition-colors"
        >
          Request new reset link
        </Link>
        <div className="mt-4">
          <Link
            href="/login"
            className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  // Show success state
  if (status === "success") {
    return (
      <div className="max-w-md mx-auto py-12">
        <h1 className="text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
          Password Updated!
        </h1>
        <div className="bg-green-100 dark:bg-green-500/10 border border-green-300 dark:border-green-500/30 rounded-lg p-4 mb-4">
          <p className="text-green-800 dark:text-green-400">
            Your password has been successfully updated.
          </p>
        </div>
        <p className="text-[var(--color-text-secondary)]">
          Redirecting you to login...
        </p>
      </div>
    );
  }

  // Show password form
  return (
    <div className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
        Set your new password
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Choose a strong password with at least 8 characters.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
        {/* Email field (read-only) - helps password managers recognize this as a password change */}
        {userEmail && (
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Account
            </label>
            <input
              type="email"
              value={userEmail}
              readOnly
              autoComplete="username"
              className="w-full border border-[var(--color-border-input)] px-3 py-2 rounded bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] cursor-not-allowed"
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full border border-[var(--color-border-input)] px-3 py-2 rounded bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
          />
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            Confirm password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full border border-[var(--color-border-input)] px-3 py-2 rounded bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
          />
        </div>

        {errorMessage && (
          <div className="bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-lg p-3">
            <p className="text-red-800 dark:text-red-400 text-sm">{errorMessage}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading" || !sessionReady}
          className="w-full px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-accent-hover)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "Updating..." : "Update password"}
        </button>
      </form>

      <div className="mt-6">
        <Link
          href="/login"
          className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto py-12 text-center">
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
