"use client";

/**
 * VenueManagersList - ABC9
 *
 * Client component for displaying and managing venue managers.
 * Admin-only - allows revoking access.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ManagerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface VenueManager {
  id: string;
  venue_id: string;
  user_id: string;
  role: string;
  grant_method: string;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
  created_by: string | null;
  profile?: ManagerProfile;
  createdByProfile?: ManagerProfile;
}

interface VenueManagersListProps {
  managers: VenueManager[];
  venueId: string;
  venueName: string;
}

export default function VenueManagersList({
  managers,
  venueId,
  venueName,
}: VenueManagersListProps) {
  const router = useRouter();
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [showRevokeModal, setShowRevokeModal] = useState<VenueManager | null>(null);

  const activeManagers = managers.filter((m) => !m.revoked_at);

  const handleRevoke = async () => {
    if (!showRevokeModal) return;

    setIsRevoking(showRevokeModal.id);

    try {
      const response = await fetch(
        `/api/admin/venues/${venueId}/managers/${showRevokeModal.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: revokeReason.trim() || null }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke access");
      }

      setShowRevokeModal(null);
      setRevokeReason("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsRevoking(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (activeManagers.length === 0) {
    return (
      <div className="p-8 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-center">
        <p className="text-[var(--color-text-secondary)]">
          No managers assigned to this venue.
        </p>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
          Managers can be added via claim approval or by sending an invite.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {activeManagers.map((manager) => (
          <div
            key={manager.id}
            className="p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {manager.profile?.full_name ||
                      manager.profile?.email ||
                      "Unknown user"}
                  </p>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      manager.role === "owner"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {manager.role === "owner" ? "Owner" : "Manager"}
                  </span>
                </div>
                {manager.profile?.email && manager.profile?.full_name && (
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    {manager.profile.email}
                  </p>
                )}
                <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                  Granted via {manager.grant_method}
                  {manager.createdByProfile && (
                    <> by {manager.createdByProfile.full_name || "Admin"}</>
                  )}
                  {" on "}
                  {formatDate(manager.created_at)}
                </p>
              </div>
              <button
                onClick={() => setShowRevokeModal(manager)}
                className="px-3 py-1 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Revoke Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Revoke Access
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Are you sure you want to revoke{" "}
              <strong>
                {showRevokeModal.profile?.full_name ||
                  showRevokeModal.profile?.email}
              </strong>
              &apos;s access to <strong>{venueName}</strong>?
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
                placeholder="e.g., No longer works at venue"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRevokeModal(null);
                  setRevokeReason("");
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={isRevoking === showRevokeModal.id}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isRevoking === showRevokeModal.id ? "Revoking..." : "Revoke Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
