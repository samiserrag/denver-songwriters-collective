"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

interface CoHostManagerProps {
  eventId: string;
  hosts: Host[];
}

export default function CoHostManager({ eventId, hosts }: CoHostManagerProps) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const acceptedHosts = hosts.filter(h => h.invitation_status === "accepted");
  const pendingInvites = hosts.filter(h => h.invitation_status === "pending");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_name: searchQuery })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      setSearchQuery("");
      setShowInvite(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this co-host?")) return;

    try {
      const res = await fetch(`/api/my-events/${eventId}/cohosts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to remove co-host:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current hosts */}
      <ul className="space-y-2">
        {acceptedHosts.map((host) => (
          <li key={host.id} className="flex items-center justify-between p-2 bg-[var(--color-indigo-950)]/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-900/50 text-teal-400 rounded-full flex items-center justify-center text-sm">
                {host.user?.avatar_url ? (
                  <img src={host.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  host.user?.full_name?.[0]?.toUpperCase() || "?"
                )}
              </div>
              <div>
                <p className="text-[var(--color-warm-white)] text-sm">{host.user?.full_name || "Unknown"}</p>
                <p className="text-xs text-[var(--color-warm-gray)]">{host.role}</p>
              </div>
            </div>
            {host.role === "cohost" && (
              <button
                onClick={() => handleRemove(host.user_id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div>
          <h4 className="text-sm text-[var(--color-warm-gray)] mb-2">Pending Invitations</h4>
          <ul className="space-y-2">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between p-2 bg-amber-900/20 border border-amber-900/50 rounded-lg">
                <span className="text-amber-300 text-sm">{invite.user?.full_name || "Unknown"}</span>
                <span className="text-xs text-amber-400/70">Pending</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite form */}
      {showInvite ? (
        <form onSubmit={handleInvite} className="space-y-3">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name..."
            className="w-full px-3 py-2 bg-[var(--color-indigo-950)]/50 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Invite"}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowInvite(true)}
          className="w-full px-3 py-2 border border-dashed border-white/20 hover:border-white/40 text-[var(--color-warm-gray)] hover:text-[var(--color-warm-white)] text-sm rounded-lg transition-colors"
        >
          + Invite Co-host
        </button>
      )}
    </div>
  );
}
