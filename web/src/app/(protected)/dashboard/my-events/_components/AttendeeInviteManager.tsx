"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * AttendeeInviteManager — PR3 (Private Events Tract)
 *
 * Manages attendee invites for invite-only events.
 * Only visible to primary host and admin (co-hosts excluded).
 *
 * Features:
 * - Auto-load members with checkbox multi-select (filterable by name)
 * - Invite non-members by email (token scaffolding; full flow in PR5)
 * - View invite statuses (pending/accepted/declined/revoked/expired)
 * - Revoke invites
 * - Enforces 200 invite cap (server-side, with UI feedback)
 */

interface AttendeeInvite {
  id: string;
  event_id: string;
  user_id: string | null;
  email: string | null;
  status: string;
  effective_status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  user: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface AttendeeInviteManagerProps {
  eventId: string;
  eventTitle: string;
  /** Whether the event is currently invite-only (controls copy only) */
  isInviteOnly: boolean;
}

interface MemberCandidate {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export default function AttendeeInviteManager({
  eventId,
  eventTitle,
  isInviteOnly,
}: AttendeeInviteManagerProps) {
  const [invites, setInvites] = useState<AttendeeInvite[]>([]);
  const [total, setTotal] = useState(0);
  const [cap, setCap] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form state
  const [inviteMode, setInviteMode] = useState<"member" | "email">("member");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberCandidates, setMemberCandidates] = useState<MemberCandidate[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/my-events/${eventId}/attendee-invites?include_members=true`
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load invites");
        return;
      }
      const data = await res.json();
      setInvites(data.invites || []);
      setTotal(data.total || 0);
      setCap(data.cap || 200);
      setMemberCandidates(data.member_candidates || []);
    } catch {
      setError("Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleInviteMember = async (userId: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await fetch(`/api/my-events/${eventId}/attendee-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, message: data.error || "Failed to invite member" };
      }

      return { ok: true };
    } catch {
      return { ok: false, message: "Failed to invite member" };
    }
  };

  const invitedMemberIds = useMemo(() => {
    return new Set(
      invites
        .filter(
          (invite) =>
            invite.user_id &&
            (invite.effective_status === "pending" ||
              invite.effective_status === "accepted")
        )
        .map((invite) => invite.user_id as string)
    );
  }, [invites]);

  const filteredMemberCandidates = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) return memberCandidates;
    return memberCandidates.filter((member) =>
      (member.full_name || "").toLowerCase().includes(needle)
    );
  }, [memberCandidates, memberSearch]);

  const selectableMemberIds = useMemo(() => {
    return filteredMemberCandidates
      .filter((member) => !invitedMemberIds.has(member.id))
      .map((member) => member.id);
  }, [filteredMemberCandidates, invitedMemberIds]);

  const allSelectableChecked =
    selectableMemberIds.length > 0 &&
    selectableMemberIds.every((memberId) => selectedMemberIds.includes(memberId));

  useEffect(() => {
    setSelectedMemberIds((prev) =>
      prev.filter(
        (memberId) =>
          memberCandidates.some((candidate) => candidate.id === memberId) &&
          !invitedMemberIds.has(memberId)
      )
    );
  }, [memberCandidates, invitedMemberIds]);

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleToggleAllFiltered = () => {
    if (allSelectableChecked) {
      setSelectedMemberIds((prev) =>
        prev.filter((memberId) => !selectableMemberIds.includes(memberId))
      );
      return;
    }

    setSelectedMemberIds((prev) => [...new Set([...prev, ...selectableMemberIds])]);
  };

  const handleInviteSelectedMembers = async () => {
    if (selectedMemberIds.length === 0) return;

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    let successCount = 0;
    const failedMessages: string[] = [];

    for (const memberId of selectedMemberIds) {
      if (invitedMemberIds.has(memberId)) continue;
      const result = await handleInviteMember(memberId);
      if (result.ok) {
        successCount += 1;
      } else if (result.message) {
        failedMessages.push(result.message);
      }
    }

    if (successCount > 0) {
      setSuccess(
        `Sent ${successCount} invite${successCount === 1 ? "" : "s"}. Members received a dashboard notification and invite email when available.`
      );
    }
    if (failedMessages.length > 0) {
      const uniqueFailures = [...new Set(failedMessages)];
      setError(uniqueFailures[0] || "Some invites failed.");
    }

    setSelectedMemberIds([]);
    await fetchInvites();
    setSubmitting(false);
  };

  const handleInviteEmail = async () => {
    if (!emailInput.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/my-events/${eventId}/attendee-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to invite by email");
        return;
      }

      setSuccess("Email invite created. Notification email will be sent when available (PR5).");
      setEmailInput("");
      await fetchInvites();
    } catch {
      setError("Failed to invite by email");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    setRevokingId(inviteId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/my-events/${eventId}/attendee-invites`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to revoke invite");
        return;
      }

      setSuccess("Invite revoked");
      await fetchInvites();
    } catch {
      setError("Failed to revoke invite");
    } finally {
      setRevokingId(null);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-amber-500/20 text-amber-300",
      accepted: "bg-emerald-500/20 text-emerald-300",
      declined: "bg-red-500/20 text-red-300",
      revoked: "bg-gray-500/20 text-gray-400",
      expired: "bg-gray-500/20 text-gray-400",
    };
    return (
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || colors.pending}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const activeInvites = invites.filter(
    (i) => i.effective_status === "pending" || i.effective_status === "accepted"
  );
  const inactiveInvites = invites.filter(
    (i) =>
      i.effective_status !== "pending" && i.effective_status !== "accepted"
  );

  return (
    <div className="mt-6 p-4 border border-[var(--color-border-default)] rounded-lg bg-[var(--color-bg-secondary)]">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        Attendee Invites
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        {isInviteOnly
          ? "This event is invite-only. Only invited people can see and RSVP to it."
          : "This event is currently public. You can still prepare invite lists here for when you switch it to private."}{" "}
        <span className="text-[var(--color-text-secondary)]">
          ({total}/{cap} invites used)
        </span>
      </p>

      {/* Feedback messages */}
      {error && (
        <div className="mb-3 p-2 text-sm text-red-300 bg-red-500/10 rounded border border-red-500/20">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 p-2 text-sm text-emerald-300 bg-emerald-500/10 rounded border border-emerald-500/20">
          {success}
        </div>
      )}

      {/* Invite form */}
      <div className="mb-4">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setInviteMode("member")}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              inviteMode === "member"
                ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Invite Member
          </button>
          <button
            type="button"
            onClick={() => setInviteMode("email")}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              inviteMode === "email"
                ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Invite by Email
          </button>
        </div>

        {inviteMode === "member" ? (
          <div>
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search for a member by name..."
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none text-sm"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--color-text-secondary)]">
                {filteredMemberCandidates.length} member
                {filteredMemberCandidates.length === 1 ? "" : "s"} shown
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAllFiltered}
                  disabled={selectableMemberIds.length === 0}
                  className="px-2 py-1 text-xs rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
                >
                  {allSelectableChecked ? "Clear filtered" : "Select filtered"}
                </button>
                <button
                  type="button"
                  onClick={handleInviteSelectedMembers}
                  disabled={submitting || selectedMemberIds.length === 0}
                  className="px-3 py-1.5 text-xs rounded bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] disabled:opacity-50"
                >
                  {submitting
                    ? "Sending..."
                    : `Invite Selected (${selectedMemberIds.length})`}
                </button>
              </div>
            </div>

            <div className="mt-2 max-h-60 overflow-y-auto border border-[var(--color-border-default)] rounded-lg bg-[var(--color-bg-tertiary)]">
              {filteredMemberCandidates.length === 0 ? (
                <p className="px-3 py-3 text-sm text-[var(--color-text-secondary)]">
                  No members match that search.
                </p>
              ) : (
                filteredMemberCandidates.map((member) => {
                  const isAlreadyInvited = invitedMemberIds.has(member.id);
                  const checked = selectedMemberIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[var(--color-border-default)] last:border-b-0"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isAlreadyInvited}
                          onChange={() => handleToggleMember(member.id)}
                        />
                        <span className="text-sm text-[var(--color-text-primary)] truncate">
                          {member.full_name || "Unknown member"}
                        </span>
                      </span>
                      {isAlreadyInvited && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          Already invited
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter email address..."
              className="flex-1 px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-border-accent)] focus:outline-none text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleInviteEmail()}
            />
            <button
              type="button"
              onClick={handleInviteEmail}
              disabled={submitting || !emailInput.trim()}
              className="px-4 py-2 text-sm bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Invite"}
            </button>
          </div>
        )}
      </div>

      {/* Active invites */}
      {loading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Loading invites...
        </p>
      ) : activeInvites.length > 0 ? (
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Active Invites ({activeInvites.length})
          </h4>
          {activeInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-2 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-text-primary)] truncate">
                    {invite.user?.full_name || invite.email || "Unknown"}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {invite.user_id ? "Member" : "Email invite"}
                  </p>
                </div>
                {statusBadge(invite.effective_status)}
              </div>
              {invite.effective_status !== "revoked" && (
                <button
                  type="button"
                  onClick={() => handleRevoke(invite.id)}
                  disabled={revokingId === invite.id}
                  className="ml-2 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 shrink-0"
                >
                  {revokingId === invite.id ? "..." : "Revoke"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            No active invites yet. Use the form above to invite people.
          </p>
        )
      )}

      {/* Inactive invites (collapsed) */}
      {inactiveInvites.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            {inactiveInvites.length} inactive invite
            {inactiveInvites.length !== 1 ? "s" : ""} (revoked/expired/declined)
          </summary>
          <div className="mt-2 space-y-1">
            {inactiveInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-2 rounded border border-[var(--color-border-default)] opacity-60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm text-[var(--color-text-secondary)] truncate">
                    {invite.user?.full_name || invite.email || "Unknown"}
                  </p>
                  {statusBadge(invite.effective_status)}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
