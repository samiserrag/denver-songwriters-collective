"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function RequestHostButton() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      if (session) {
        const res = await fetch("/api/host-requests");
        const data = await res.json();
        if (data.isHost) {
          setIsHost(true);
        } else if (data.request?.status === "pending") {
          setRequestStatus("pending");
        }
      }
    };
    checkStatus();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/host-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setSuccess(true);
      setRequestStatus("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  if (isLoggedIn === null) return null;

  if (!isLoggedIn) {
    return (
      <button
        onClick={() => router.push("/login?redirectTo=/dashboard")}
        className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] rounded-lg"
      >
        Log in to become a host
      </button>
    );
  }

  if (isHost) {
    return (
      <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
        <p className="text-green-300">&#10003; You&apos;re an approved host!</p>
        <Link
          href="/dashboard/my-events"
          className="text-green-400 hover:text-green-300 text-sm underline"
        >
          Manage your events &rarr;
        </Link>
      </div>
    );
  }

  if (requestStatus === "pending" || success) {
    return (
      <div className="p-4 bg-amber-900/30 border border-amber-700 rounded-lg">
        <p className="text-amber-300">
          &#8987; Your host request is pending review.
        </p>
        <p className="text-amber-400/70 text-sm mt-1">
          We&apos;ll notify you when it&apos;s approved.
        </p>
      </div>
    );
  }

  return (
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] rounded-lg"
        >
          Request to become a host
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 p-4 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-input)] rounded-lg"
        >
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
              Tell us why you&apos;d like to host events (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="I'd like to host song circles, workshops, etc..."
              className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] rounded-lg disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
