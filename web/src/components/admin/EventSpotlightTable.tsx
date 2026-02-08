"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type DBEvent = Database["public"]["Tables"]["events"]["Row"] & {
  venues?: { id: string; name: string } | null;
  is_published?: boolean | null;
  has_timeslots?: boolean | null;
  last_verified_at?: string | null;
  host?:
    | { id: string; slug: string | null; full_name: string | null }
    | { id: string; slug: string | null; full_name: string | null }[]
    | null;
};

 interface Props {
   events: DBEvent[];
 }

 export default function EventSpotlightTable({ events }: Props) {
   const router = useRouter();
   const supabase = createSupabaseBrowserClient();
   const [rows, setRows] = useState(events ?? []);
   const [loadingId, setLoadingId] = useState<string | null>(null);
   const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);
   const [deleteConfirm, setDeleteConfirm] = useState("");
   const [deleting, setDeleting] = useState(false);
   const [verifyingId, setVerifyingId] = useState<string | null>(null);

   // CRITICAL: Guard MUST be first line
   if (!events || !Array.isArray(events)) {
     return (
       <div className="text-[var(--color-text-tertiary)] py-4">No events available.</div>
     );
   }

   if (rows.length === 0) {
     return (
       <div className="text-[var(--color-text-tertiary)] py-4">No events found.</div>
     );
   }

  async function updateEvent(id: string, is_spotlight: boolean) {
    setLoadingId(id);

    const { error } = await supabase
      .from("events")
      .update({ is_spotlight })
      .eq("id", id);

    if (error) {
      alert(error.message);
      setLoadingId(null);
      return;
    }

    setRows(prev =>
      prev.map(ev =>
        ev.id === id ? { ...ev, is_spotlight } : ev
      )
    );

    setLoadingId(null);
  }

  async function toggleVerify(id: string, isCurrentlyVerified: boolean) {
    setVerifyingId(id);
    const action = isCurrentlyVerified ? "unverify" : "verify";

    try {
      const response = await fetch("/api/admin/ops/events/bulk-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [id], action }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update verification status");
        setVerifyingId(null);
        return;
      }

      // Update local state
      setRows(prev =>
        prev.map(ev =>
          ev.id === id
            ? {
                ...ev,
                last_verified_at: action === "verify" ? new Date().toISOString() : null,
              }
            : ev
        )
      );
    } catch {
      alert("Failed to update verification status");
    }

    setVerifyingId(null);
  }

  async function handleDelete() {
    if (!deleteModal || deleteConfirm !== "DELETE") return;
    setDeleting(true);

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", deleteModal.id);

    if (error) {
      alert("Failed to delete event: " + error.message);
      setDeleting(false);
      return;
    }

    setRows(prev => prev.filter(ev => ev.id !== deleteModal.id));
    setDeleteModal(null);
    setDeleteConfirm("");
    setDeleting(false);
    router.refresh();
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-white/10 p-4 bg-black/20">
      <table className="min-w-full text-left text-[var(--color-text-primary)]">
        <thead className="border-b border-white/10 text-gold-400">
          <tr>
            <th className="py-2 px-3">Title</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-3">Date</th>
            <th className="py-2 px-3">Venue</th>
            <th className="py-2 px-3">Host</th>
            <th className="py-2 px-3">Type</th>
            <th className="py-2 px-3">Cost</th>
            <th className="py-2 px-3">Verified</th>
            <th className="py-2 px-3">Spotlight</th>
            <th className="py-2 px-3">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((ev) => (
            <tr key={ev.id} className="border-b border-white/5">
              <td className="py-2 px-3">
                <Link
                  href={`/events/${ev.slug || ev.id}`}
                  className="text-[var(--color-text-accent)] hover:underline"
                  target="_blank"
                >
                  {ev.title}
                </Link>
              </td>
              <td className="py-2 px-3">
                <div className="flex items-center gap-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    ev.is_published
                      ? "bg-emerald-900/50 text-emerald-400"
                      : "bg-amber-900/50 text-amber-400"
                  }`}>
                    {ev.is_published ? "Published" : "Draft"}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    ev.status === "active"
                      ? "bg-green-900/50 text-green-400"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]"
                  }`}>
                    {ev.status}
                  </span>
                </div>
              </td>
              <td className="py-2 px-3">{ev.event_date}</td>
              <td className="py-2 px-3">{ev.venues?.name ?? ev.venue_name ?? "—"}</td>

              <td className="py-2 px-3">
                {(() => {
                  const host = Array.isArray(ev.host) ? ev.host[0] : ev.host;
                  if (!ev.host_id) {
                    return <span className="text-xs text-amber-300">No host</span>;
                  }
                  if (!host?.id) {
                    return <span className="text-xs text-[var(--color-text-tertiary)]">Host linked</span>;
                  }
                  return (
                    <Link
                      href={`/members/${host.slug || host.id}`}
                      target="_blank"
                      className="text-[var(--color-text-accent)] hover:underline text-sm"
                    >
                      {host.full_name || "View host"}
                    </Link>
                  );
                })()}
              </td>

              <td className="py-2 px-3">
                {ev.has_timeslots ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-400">
                    Timeslots
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]">
                    RSVP
                  </span>
                )}
              </td>

              <td className="py-2 px-3">
                {ev.is_free ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300">
                    Free
                  </span>
                ) : ev.cost_label ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">
                    {ev.cost_label}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-tertiary)]">Unspecified</span>
                )}
              </td>

              <td className="py-2 px-3">
                <input
                  type="checkbox"
                  checked={!!ev.last_verified_at}
                  onChange={() => toggleVerify(ev.id, !!ev.last_verified_at)}
                  disabled={verifyingId === ev.id}
                  title={ev.last_verified_at ? "Verified - click to unverify" : "Unverified - click to verify"}
                  className="w-4 h-4 cursor-pointer accent-emerald-500"
                />
              </td>

              <td className="py-2 px-3">
                <input
                  type="checkbox"
                  checked={ev.is_spotlight ?? false}
                  onChange={(e) =>
                    updateEvent(ev.id, e.target.checked)
                  }
                  disabled={loadingId === ev.id}
                />
              </td>

              <td className="py-2 px-3">
                {loadingId === ev.id ? (
                  <span className="text-gold-400">Saving…</span>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/dashboard/my-events/${ev.id}`}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[var(--color-text-primary)] text-xs"
                    >
                      Edit
                    </Link>
                    {ev.has_timeslots && (
                      <>
                        <Link
                          href={`/events/${ev.id}/display`}
                          target="_blank"
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-[var(--color-text-primary)] text-xs"
                          title="TV Display for venue screens"
                        >
                          📺 TV
                        </Link>
                        <Link
                          href={`/events/${ev.id}/lineup`}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[var(--color-text-primary)] text-xs"
                          title="Control lineup during event"
                        >
                          🎤 Control
                        </Link>
                      </>
                    )}
                    <button
                      onClick={() => setDeleteModal({ id: ev.id, title: ev.title })}
                      className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-[var(--color-text-primary)] text-xs"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[var(--color-bg-input)] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Delete Event</h3>
            <p className="text-[var(--color-text-secondary)] mb-2">
              Are you sure you want to delete <strong className="text-[var(--color-text-primary)]">{deleteModal.title}</strong>?
            </p>
            <p className="text-red-400 text-sm mb-4">
              This action cannot be reversed.
            </p>
            <p className="text-[var(--color-text-tertiary)] text-sm mb-2">
              Type <strong className="text-[var(--color-text-primary)]">DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 bg-black border border-white/20 rounded text-[var(--color-text-primary)] mb-4 focus:border-red-500 focus:outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteModal(null);
                  setDeleteConfirm("");
                }}
                className="flex-1 px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== "DELETE" || deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-[var(--color-text-primary)]"
              >
                {deleting ? "Deleting..." : "Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
