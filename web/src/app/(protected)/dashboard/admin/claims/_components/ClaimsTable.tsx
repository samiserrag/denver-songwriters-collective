"use client";

/**
 * ClaimsTable - Phase 4.22.3
 *
 * Admin table for reviewing event claims.
 * Supports approve/reject actions with inline feedback.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface EventClaim {
  id: string;
  event_id: string;
  requester_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  event: {
    id: string;
    slug: string | null;
    title: string;
    venue_name: string | null;
    host_id: string | null;
  } | null;
  requester: {
    id: string;
    slug: string | null;
    full_name: string | null;
    email: string | null;
  } | null;
}

interface Props {
  claims: EventClaim[];
  adminId: string;
  showActions?: boolean;
}

export default function ClaimsTable({
  claims,
  adminId,
  showActions = true,
}: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (claim: EventClaim) => {
    if (!claim.event) return;

    setLoadingId(claim.id);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    // Check if event is still unclaimed
    const { data: currentEvent } = await supabase
      .from("events")
      .select("host_id")
      .eq("id", claim.event_id)
      .single();

    if (currentEvent?.host_id) {
      // Event already claimed - auto-reject
      const { error: rejectError } = await supabase
        .from("event_claims")
        .update({
          status: "rejected",
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: "Event was already claimed by another user.",
        })
        .eq("id", claim.id);

      if (rejectError) {
        setError("Failed to auto-reject claim: " + rejectError.message);
      }
      setLoadingId(null);
      router.refresh();
      return;
    }

    // Transaction: Update claim status
    const { error: claimError } = await supabase
      .from("event_claims")
      .update({
        status: "approved",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claim.id);

    if (claimError) {
      setError("Failed to approve claim: " + claimError.message);
      setLoadingId(null);
      return;
    }

    // Update event host_id
    const { error: eventError } = await supabase
      .from("events")
      .update({ host_id: claim.requester_id })
      .eq("id", claim.event_id)
      .is("host_id", null);

    if (eventError) {
      setError("Failed to set event host: " + eventError.message);
      setLoadingId(null);
      return;
    }

    // Insert into event_hosts for consistency with multi-host system
    const { error: hostError } = await supabase.from("event_hosts").insert({
      event_id: claim.event_id,
      user_id: claim.requester_id,
      role: "host",
      invitation_status: "accepted",
      invited_by: adminId,
    });

    if (hostError && hostError.code !== "23505") {
      // Ignore duplicate key error
      console.error("Failed to insert event_host:", hostError);
    }

    // Notify the claimant that their claim was approved
    const eventTitle = claim.event?.title || "the event";
    await supabase.rpc("create_user_notification", {
      p_user_id: claim.requester_id,
      p_type: "claim_approved",
      p_title: `Your claim for "${eventTitle}" was approved!`,
      p_message: `You're now the host of "${eventTitle}". You can manage it from your dashboard.`,
      p_link: `/dashboard/my-events/${claim.event_id}`
    });

    setLoadingId(null);
    router.refresh();
  };

  const handleReject = async (claim: EventClaim) => {
    setLoadingId(claim.id);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const { error: rejectError } = await supabase
      .from("event_claims")
      .update({
        status: "rejected",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason.trim() || null,
      })
      .eq("id", claim.id);

    if (rejectError) {
      setError("Failed to reject claim: " + rejectError.message);
      setLoadingId(null);
      return;
    }

    // Notify the claimant that their claim was rejected
    const eventTitle = claim.event?.title || "the event";
    const reason = rejectionReason.trim();
    await supabase.rpc("create_user_notification", {
      p_user_id: claim.requester_id,
      p_type: "claim_rejected",
      p_title: `Your claim for "${eventTitle}" was not approved`,
      p_message: reason
        ? `Reason: ${reason}. If you believe this is an error, contact an admin.`
        : `If you believe this is an error, contact an admin.`,
      p_link: `/happenings`
    });

    setLoadingId(null);
    setRejectingId(null);
    setRejectionReason("");
    router.refresh();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-default)]">
              <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                Event
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                Requester
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                Message
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                Date
              </th>
              {showActions && (
                <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                  Actions
                </th>
              )}
              {!showActions && (
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                  Status
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr
                key={claim.id}
                className="border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-tertiary)]/30"
              >
                <td className="py-3 px-4">
                  {claim.event ? (
                    <div>
                      <Link
                        href={`/events/${claim.event.slug || claim.event.id}`}
                        className="text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)] font-medium"
                      >
                        {claim.event.title}
                      </Link>
                      {claim.event.venue_name && (
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {claim.event.venue_name}
                        </p>
                      )}
                      {claim.event.host_id && (
                        <span className="text-xs text-amber-800 dark:text-amber-400">
                          Already has owner
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[var(--color-text-tertiary)] italic">
                      Event deleted
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {claim.requester ? (
                    <div>
                      <Link
                        href={`/songwriters/${claim.requester.slug || claim.requester.id}`}
                        className="text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]"
                      >
                        {claim.requester.full_name || "Unknown"}
                      </Link>
                      {claim.requester.email && (
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {claim.requester.email}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-[var(--color-text-tertiary)] italic">
                      User deleted
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 max-w-xs">
                  {claim.message ? (
                    <p className="text-[var(--color-text-secondary)] truncate">
                      {claim.message}
                    </p>
                  ) : (
                    <span className="text-[var(--color-text-tertiary)] italic">
                      No message
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-[var(--color-text-tertiary)] whitespace-nowrap">
                  {formatDate(claim.created_at)}
                </td>
                {showActions ? (
                  <td className="py-3 px-4 text-right">
                    {rejectingId === claim.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <input
                          type="text"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason (optional)"
                          className="px-2 py-1 text-xs bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] w-32"
                        />
                        <button
                          onClick={() => handleReject(claim)}
                          disabled={loadingId === claim.id}
                          className="px-2 py-1 text-xs bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-800 dark:text-red-400 rounded disabled:opacity-50"
                        >
                          {loadingId === claim.id ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionReason("");
                          }}
                          className="px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleApprove(claim)}
                          disabled={
                            loadingId === claim.id || !claim.event || !!claim.event.host_id
                          }
                          className="px-3 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded disabled:opacity-50"
                        >
                          {loadingId === claim.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => setRejectingId(claim.id)}
                          disabled={loadingId === claim.id}
                          className="px-3 py-1 text-xs bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-800 dark:text-red-400 rounded disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                ) : (
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        claim.status === "approved"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400"
                      }`}
                    >
                      {claim.status === "approved" ? "Approved" : "Rejected"}
                    </span>
                    {claim.status === "rejected" && claim.rejection_reason && (
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        {claim.rejection_reason}
                      </p>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
