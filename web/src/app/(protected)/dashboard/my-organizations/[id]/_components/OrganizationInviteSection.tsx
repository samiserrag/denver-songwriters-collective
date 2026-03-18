"use client";

import { useCallback, useEffect, useState } from "react";

interface OrganizationInvite {
  id: string;
  role_to_grant: "owner" | "manager";
  email_restriction: string | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
}

interface CreatedInvite {
  inviteUrl: string;
  expiresAt: string;
  roleToGrant: "owner" | "manager";
  emailRestriction: string | null;
  emailSent: boolean;
}

interface OrganizationInviteSectionProps {
  organizationId: string;
  organizationName: string;
  canInviteOwner: boolean;
}

export default function OrganizationInviteSection({
  organizationId,
  organizationName,
  canInviteOwner,
}: OrganizationInviteSectionProps) {
  const [roleToGrant, setRoleToGrant] = useState<"owner" | "manager">("manager");
  const [emailRestriction, setEmailRestriction] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      const response = await fetch(`/api/my-organizations/${organizationId}/invite`);
      if (!response.ok) return;
      const data = await response.json();
      setInvites(data.invites || []);
    } catch (error) {
      console.error("Failed to fetch organization invites:", error);
    } finally {
      setIsLoadingInvites(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  useEffect(() => {
    if (!canInviteOwner && roleToGrant === "owner") {
      setRoleToGrant("manager");
    }
  }, [canInviteOwner, roleToGrant]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setCreatedInvite(null);

    try {
      const response = await fetch(`/api/my-organizations/${organizationId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_to_grant: roleToGrant,
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
        roleToGrant: data.roleToGrant,
        emailRestriction: data.emailRestriction,
        emailSent: !!data.emailSent,
      });
      setEmailRestriction("");
      fetchInvites();
    } catch (error) {
      console.error("Create organization invite error:", error);
      setCreateError("An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      const response = await fetch(`/api/my-organizations/${organizationId}/invite/${inviteId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        setCreateError(data.error || "Failed to revoke invite");
        return;
      }
      fetchInvites();
    } catch (error) {
      console.error("Revoke organization invite error:", error);
    } finally {
      setRevokingId(null);
    }
  };

  const copyText = async (value: string, kind: "link" | "template") => {
    try {
      await navigator.clipboard.writeText(value);
      if (kind === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedTemplate(true);
        setTimeout(() => setCopiedTemplate(false), 2000);
      }
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const roleLabel = roleToGrant === "owner" ? "owner" : "manager";

  const getEmailTemplate = (invite: CreatedInvite) => {
    const expiryDate = new Date(invite.expiresAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const inviteRole = invite.roleToGrant === "owner" ? "owner" : "manager";

    return `You've been invited to help manage "${organizationName}" on The Colorado Songwriters Collective.

Accept your invite:
${invite.inviteUrl}

This invite grants ${inviteRole} access and expires on ${expiryDate}.`;
  };

  const statusChip = (status: OrganizationInvite["status"]) => {
    const styles: Record<OrganizationInvite["status"], string> = {
      pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400",
      accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400",
      expired: "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
      revoked: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400",
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>
        {status[0].toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <section className="p-6 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Invite Teammates
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Share invite links so trusted teammates can help manage this organization profile.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Role to Grant
            </label>
            <select
              value={roleToGrant}
              onChange={(event) =>
                setRoleToGrant(event.target.value as "owner" | "manager")
              }
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            >
              <option value="manager">Manager</option>
              {canInviteOwner && <option value="owner">Owner</option>}
            </select>
            {!canInviteOwner && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Only owners/admins can grant owner access.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Email Restriction (optional)
            </label>
            <input
              type="email"
              value={emailRestriction}
              onChange={(event) => setEmailRestriction(event.target.value)}
              placeholder="alice@example.com"
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              If provided, only this email can accept. We will email the invite automatically.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Expires In
            </label>
            <select
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
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
          {isCreating ? "Creating..." : `Create ${roleLabel} Invite`}
        </button>

        {createError && (
          <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
        )}
      </form>

      {createdInvite && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg space-y-3">
          <div className="font-medium text-amber-800 dark:text-amber-300">
            This invite link is shown only once.
          </div>

          <div className="text-sm text-[var(--color-text-secondary)]">
            {createdInvite.emailRestriction
              ? createdInvite.emailSent
                ? `Invite email sent to ${createdInvite.emailRestriction}.`
                : `Couldn't send email automatically to ${createdInvite.emailRestriction}; copy the link below.`
              : "No email restriction set. Share this link directly with the teammate."}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Invite URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={createdInvite.inviteUrl}
                className="flex-1 px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded text-sm text-[var(--color-text-primary)] font-mono"
              />
              <button
                type="button"
                onClick={() => copyText(createdInvite.inviteUrl, "link")}
                className="px-3 py-2 bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-sm"
              >
                {copiedLink ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Manual Email Text
            </label>
            <div className="relative">
              <textarea
                readOnly
                rows={5}
                value={getEmailTemplate(createdInvite)}
                className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded text-sm text-[var(--color-text-primary)]"
              />
              <button
                type="button"
                onClick={() => copyText(getEmailTemplate(createdInvite), "template")}
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded"
              >
                {copiedTemplate ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCreatedInvite(null)}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Dismiss
          </button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Existing Invites
        </h3>
        {isLoadingInvites ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading invites...</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No invites created yet.
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 p-3 bg-[var(--color-bg-primary)] rounded border border-[var(--color-border-default)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {statusChip(invite.status)}
                  <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-secondary)]">
                    {invite.role_to_grant === "owner" ? "Owner" : "Manager"}
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
                    disabled={revokingId === invite.id}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    {revokingId === invite.id ? "Revoking..." : "Revoke"}
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
