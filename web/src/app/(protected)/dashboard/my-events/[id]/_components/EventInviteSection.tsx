"use client";

/**
 * EventInviteSection - Phase 4.94
 *
 * Dashboard component for creating and managing event invites.
 * Visible only to admins and primary hosts.
 */

import { useState, useEffect, useCallback } from "react";

interface Invite {
  id: string;
  role_to_grant: "host" | "cohost";
  email_restriction: string | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
}

interface EventInviteSectionProps {
  eventId: string;
  eventTitle: string;
}

export default function EventInviteSection({
  eventId,
  eventTitle,
}: EventInviteSectionProps) {
  // Form state
  const [roleToGrant, setRoleToGrant] = useState<"host" | "cohost">("cohost");
  const [emailRestriction, setEmailRestriction] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Invites list
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Fetch invites
  const fetchInvites = useCallback(async () => {
    try {
      const response = await fetch(`/api/my-events/${eventId}/invite`);
      if (response.ok) {
        const data = await response.json();
        setInvites(data.invites || []);
      }
    } catch (error) {
      console.error("Failed to fetch invites:", error);
    } finally {
      setIsLoadingInvites(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  // Create invite
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setNewInviteUrl(null);

    try {
      const response = await fetch(`/api/my-events/${eventId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_to_grant: roleToGrant,
          email_restriction: emailRestriction.trim() || null,
          expires_in_days: expiresInDays,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || "Failed to create invite");
        return;
      }

      setNewInviteUrl(data.inviteUrl);
      setEmailRestriction("");
      fetchInvites();
    } catch {
      setCreateError("An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  // Revoke invite
  const handleRevoke = async (inviteId: string) => {
    setRevoking(inviteId);
    try {
      const response = await fetch(
        `/api/my-events/${eventId}/invite/${inviteId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        fetchInvites();
      }
    } catch (error) {
      console.error("Failed to revoke invite:", error);
    } finally {
      setRevoking(null);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, type: "url" | "template") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "url") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedTemplate(true);
        setTimeout(() => setCopiedTemplate(false), 2000);
      }
    } catch {
      console.error("Failed to copy to clipboard");
    }
  };

  // Generate email template
  const getEmailTemplate = (url: string, expiresAt: string) => {
    const expiryDate = new Date(expiresAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const hostPageUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/host`
        : "https://denversongwriterscollective.org/host";

    return `You've been invited to help host "${eventTitle}" on Denver Songwriters Collective!

Click this link to accept:
${url}

This invite expires on ${expiryDate}.

New to hosting? Learn what to expect: ${hostPageUrl}`;
  };

  // Status chip styling
  const getStatusChip = (status: Invite["status"]) => {
    const styles: Record<typeof status, string> = {
      pending:
        "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400",
      accepted:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400",
      expired:
        "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
      revoked: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
    };

    const labels: Record<typeof status, string> = {
      pending: "Pending",
      accepted: "Accepted",
      expired: "Expired",
      revoked: "Revoked",
    };

    return (
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  return (
    <section className="card-spotlight p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Invite Links
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Create invite links to share with potential hosts or co-hosts
        </p>
      </div>

      {/* Create Invite Form */}
      <form onSubmit={handleCreate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Role to Grant
            </label>
            <select
              value={roleToGrant}
              onChange={(e) =>
                setRoleToGrant(e.target.value as "host" | "cohost")
              }
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            >
              <option value="cohost">Co-host</option>
              <option value="host">Primary Host</option>
            </select>
            {roleToGrant === "host" && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Only works if event has no primary host yet
              </p>
            )}
          </div>

          {/* Email Restriction */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Email Restriction (optional)
            </label>
            <input
              type="email"
              value={emailRestriction}
              onChange={(e) => setEmailRestriction(e.target.value)}
              placeholder="alice@example.com"
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)]"
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Expires In
            </label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isCreating}
          className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded font-medium disabled:opacity-50"
        >
          {isCreating ? "Creating..." : "Create Invite"}
        </button>

        {createError && (
          <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
        )}
      </form>

      {/* New Invite URL Display (one-time) */}
      {newInviteUrl && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400"
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
            <span className="font-medium text-amber-800 dark:text-amber-300">
              This link will only be shown once!
            </span>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Invite URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={newInviteUrl}
                className="flex-1 px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded text-sm text-[var(--color-text-primary)] font-mono"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(newInviteUrl, "url")}
                className="px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-sm"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Email Template */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Email Template
            </label>
            <div className="relative">
              <textarea
                readOnly
                value={getEmailTemplate(
                  newInviteUrl,
                  new Date(
                    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
                  ).toISOString()
                )}
                rows={5}
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded text-sm text-[var(--color-text-primary)]"
              />
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    getEmailTemplate(
                      newInviteUrl,
                      new Date(
                        Date.now() + expiresInDays * 24 * 60 * 60 * 1000
                      ).toISOString()
                    ),
                    "template"
                  )
                }
                className="absolute top-2 right-2 px-2 py-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-xs"
              >
                {copiedTemplate ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNewInviteUrl(null)}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Invites List */}
      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Existing Invites
        </h3>

        {isLoadingInvites ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No invites created yet
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border-default)]"
              >
                <div className="flex items-center gap-3">
                  {getStatusChip(invite.status)}
                  <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-secondary)]">
                    {invite.role_to_grant === "host" ? "Host" : "Co-host"}
                  </span>
                  {invite.email_restriction && (
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {invite.email_restriction}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    Expires{" "}
                    {new Date(invite.expires_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {invite.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(invite.id)}
                    disabled={revoking === invite.id}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    {revoking === invite.id ? "Revoking..." : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
