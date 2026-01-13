"use client";

/**
 * VenueInviteSection - ABC11a/b
 *
 * Displays active invites and provides:
 * - Create new invite button + modal
 * - Revoke invite button for each pending invite
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface VenueInvite {
  id: string;
  email_restriction: string | null;
  created_at: string;
  expires_at: string;
  created_by: string | null;
}

interface ProfileInfo {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface VenueInviteSectionProps {
  venueId: string;
  venueName: string;
  invites: VenueInvite[];
  profiles: Map<string, ProfileInfo>;
}

export default function VenueInviteSection({
  venueId,
  venueName,
  invites,
  profiles,
}: VenueInviteSectionProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState<VenueInvite | null>(null);

  // Create invite state
  const [emailRestriction, setEmailRestriction] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{
    inviteUrl: string;
    expiresAt: string;
    emailRestriction: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke invite state
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCreate = async () => {
    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch(`/api/admin/venues/${venueId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailRestriction.trim() || null,
          expiresInDays,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || "Failed to create invite");
        return;
      }

      setCreatedInvite({
        inviteUrl: data.inviteUrl,
        expiresAt: data.expiresAt,
        emailRestriction: data.emailRestriction,
      });
    } catch (err) {
      setCreateError("An unexpected error occurred");
      console.error("Create invite error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!createdInvite) return;
    try {
      await navigator.clipboard.writeText(createdInvite.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleCopyEmail = async () => {
    if (!createdInvite) return;
    const emailTemplate = getEmailTemplate(createdInvite.inviteUrl);
    try {
      await navigator.clipboard.writeText(emailTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const getEmailTemplate = (inviteUrl: string) => {
    return `Hi,

You've been invited to manage "${venueName}" on Denver Songwriters Collective!

Click the link below to accept the invitation and gain access to edit venue details:

${inviteUrl}

This link expires in ${expiresInDays} days.

If you have any questions, please reply to this email.

Best,
Denver Songwriters Collective Team`;
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setEmailRestriction("");
    setExpiresInDays(7);
    setCreateError(null);
    setCreatedInvite(null);
    setCopied(false);
    // Refresh page to show new invite
    if (createdInvite) {
      router.refresh();
    }
  };

  const handleRevoke = async () => {
    if (!showRevokeModal) return;

    setIsRevoking(true);
    setRevokeError(null);

    try {
      const response = await fetch(
        `/api/admin/venues/${venueId}/invite/${showRevokeModal.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: revokeReason.trim() || null }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setRevokeError(data.error || "Failed to revoke invite");
        return;
      }

      setShowRevokeModal(null);
      setRevokeReason("");
      router.refresh();
    } catch (err) {
      setRevokeError("An unexpected error occurred");
      console.error("Revoke invite error:", err);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Venue Invites
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1 text-sm font-medium rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] transition-colors"
        >
          + Create Invite
        </button>
      </div>

      {invites.length === 0 ? (
        <div className="p-6 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-center">
          <p className="text-[var(--color-text-secondary)]">
            No active invites for this venue.
          </p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Create an invite to share a link with someone who should manage this venue.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => {
            const creatorProfile = invite.created_by
              ? profiles.get(invite.created_by)
              : undefined;
            const isExpired = new Date(invite.expires_at) < new Date();

            return (
              <div
                key={invite.id}
                className={`p-4 rounded-lg border ${
                  isExpired
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-[var(--color-text-primary)]">
                      {invite.email_restriction || "Anyone with link"}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      Created by {creatorProfile?.full_name || "Admin"} on{" "}
                      {formatDate(invite.created_at)}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isExpired
                          ? "text-red-400"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {isExpired
                        ? "Expired"
                        : `Expires ${formatDate(invite.expires_at)}`}
                    </p>
                  </div>
                  {!isExpired && (
                    <button
                      onClick={() => setShowRevokeModal(invite)}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Invite Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg">
            {!createdInvite ? (
              <>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                  Create Venue Invite
                </h3>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="email-restriction"
                      className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
                    >
                      Email Restriction (optional)
                    </label>
                    <input
                      type="email"
                      id="email-restriction"
                      value={emailRestriction}
                      onChange={(e) => setEmailRestriction(e.target.value)}
                      placeholder="Leave blank for anyone with link"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      If set, only this email address can accept the invite.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="expires-in"
                      className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
                    >
                      Expires In
                    </label>
                    <select
                      id="expires-in"
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days (default)</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>
                </div>

                {createError && (
                  <div className="mt-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={handleCloseCreateModal}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] disabled:opacity-50"
                  >
                    {isCreating ? "Creating..." : "Create Invite"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-emerald-400"
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
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Invite Created!
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Share this link with the intended recipient.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
                  <p className="text-sm text-amber-400 font-medium">
                    Important: This link will only be shown once!
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      Invite Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={createdInvite.inviteUrl}
                        readOnly
                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm font-mono"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)]"
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                      Email Template
                    </label>
                    <textarea
                      value={getEmailTemplate(createdInvite.inviteUrl)}
                      readOnly
                      rows={10}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm font-mono resize-none"
                    />
                    <button
                      onClick={handleCopyEmail}
                      className="mt-2 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]"
                    >
                      Copy Email Template
                    </button>
                  </div>

                  <div className="text-sm text-[var(--color-text-tertiary)]">
                    <p>
                      Expires: {formatDate(createdInvite.expiresAt)}
                    </p>
                    {createdInvite.emailRestriction && (
                      <p>
                        Restricted to: {createdInvite.emailRestriction}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleCloseCreateModal}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)]"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revoke Invite Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md p-6 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-lg">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Revoke Invite
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Revoking this invite will make the link unusable. The recipient will not be able to accept it.
            </p>

            <div className="mb-4">
              <label
                htmlFor="revoke-reason"
                className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
              >
                Reason (optional)
              </label>
              <input
                type="text"
                id="revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g., Sent to wrong person"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            {revokeError && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {revokeError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRevokeModal(null);
                  setRevokeReason("");
                  setRevokeError(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={isRevoking}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isRevoking ? "Revoking..." : "Revoke Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
