"use client";

/**
 * VenueClaimsTable - ABC8
 *
 * Admin table for reviewing venue claims.
 * Supports approve/reject actions with inline feedback.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface VenueClaim {
  id: string;
  venue_id: string;
  requester_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  venue: {
    id: string;
    slug: string | null;
    name: string;
    city: string | null;
    state: string | null;
  } | null;
  requester: {
    id: string;
    slug: string | null;
    full_name: string | null;
    email: string | null;
  } | null;
}

interface Props {
  claims: VenueClaim[];
  adminId: string;
  showActions?: boolean;
}

export function VenueClaimsTable({
  claims,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future audit logging
  adminId,
  showActions = true,
}: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (claim: VenueClaim) => {
    if (!claim.venue) return;

    setLoadingId(claim.id);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/venue-claims/${claim.id}/approve`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to approve claim");
        setLoadingId(null);
        return;
      }

      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Approve error:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (claimId: string) => {
    setLoadingId(claimId);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/venue-claims/${claimId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectionReason.trim() || null }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reject claim");
        setLoadingId(null);
        return;
      }

      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Reject error:", err);
    } finally {
      setLoadingId(null);
      setRejectingId(null);
      setRejectionReason("");
    }
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
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-default)]">
              <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">
                Venue
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
                  {claim.venue ? (
                    <div>
                      <Link
                        href={`/venues/${claim.venue.slug || claim.venue.id}`}
                        className="text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)] font-medium"
                      >
                        {claim.venue.name}
                      </Link>
                      {claim.venue.city && claim.venue.state && (
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {claim.venue.city}, {claim.venue.state}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-[var(--color-text-tertiary)] italic">
                      Venue deleted
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
                          onClick={() => handleReject(claim.id)}
                          disabled={loadingId === claim.id}
                          className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded disabled:opacity-50"
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
                          disabled={loadingId === claim.id || !claim.venue}
                          className="px-3 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded disabled:opacity-50"
                        >
                          {loadingId === claim.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => setRejectingId(claim.id)}
                          disabled={loadingId === claim.id}
                          className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded disabled:opacity-50"
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
                          : claim.status === "cancelled"
                          ? "bg-gray-500/20 text-gray-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {claim.status === "approved"
                        ? "Approved"
                        : claim.status === "cancelled"
                        ? "Cancelled"
                        : "Rejected"}
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
