"use client";

/**
 * AdminHostManager
 *
 * Admin-only component for managing hosts on any event.
 * Admins can remove any host (primary or co-host) from any event.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Host {
  id: string;
  user_id: string;
  role: string;
  invitation_status: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface AdminHostManagerProps {
  eventId: string;
  eventTitle: string;
  hosts: Host[];
}

export function AdminHostManager({ eventId, eventTitle, hosts }: AdminHostManagerProps) {
  const router = useRouter();
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptedHosts = hosts.filter(h => h.invitation_status === "accepted");
  const pendingInvites = hosts.filter(h => h.invitation_status === "pending");

  const handleRemove = async (userId: string, hostName: string, role: string) => {
    const roleLabel = role === "host" ? "primary host" : "co-host";
    if (!confirm(`Remove ${hostName} as ${roleLabel} from "${eventTitle}"?`)) return;

    setRemovingUserId(userId);
    setError(null);

    try {
      const res = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to remove host");
        return;
      }

      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Remove host error:", err);
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleCancelInvite = async (userId: string, hostName: string) => {
    if (!confirm(`Cancel invitation for ${hostName}?`)) return;

    setRemovingUserId(userId);
    setError(null);

    try {
      const res = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to cancel invitation");
        return;
      }

      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Cancel invite error:", err);
    } finally {
      setRemovingUserId(null);
    }
  };

  if (acceptedHosts.length === 0 && pendingInvites.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No hosts assigned to this event.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-800 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Current hosts */}
      {acceptedHosts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Current Hosts</h4>
          <ul className="space-y-2">
            {acceptedHosts.map((host) => (
              <li key={host.id} className="flex items-center justify-between p-2 bg-[var(--color-bg-tertiary)] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] rounded-full flex items-center justify-center text-sm overflow-hidden">
                    {host.user?.avatar_url ? (
                      <Image
                        src={host.user.avatar_url}
                        alt=""
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      host.user?.full_name?.[0]?.toUpperCase() || "?"
                    )}
                  </div>
                  <div>
                    <p className="text-[var(--color-text-primary)] text-sm">
                      {host.user?.full_name || "Unknown"}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {host.role === "host" ? "Primary Host" : "Co-host"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(host.user_id, host.user?.full_name || "this host", host.role)}
                  disabled={removingUserId === host.user_id}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                >
                  {removingUserId === host.user_id ? "..." : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Pending Invitations</h4>
          <ul className="space-y-2">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between p-2 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-primary)] text-sm">
                    {invite.user?.full_name || "Unknown"}
                  </span>
                  <span className="text-xs text-amber-700 dark:text-amber-400">Pending</span>
                </div>
                <button
                  onClick={() => handleCancelInvite(invite.user_id, invite.user?.full_name || "this user")}
                  disabled={removingUserId === invite.user_id}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                >
                  {removingUserId === invite.user_id ? "..." : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
