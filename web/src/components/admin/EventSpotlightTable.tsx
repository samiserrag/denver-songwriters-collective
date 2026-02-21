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
  const badgeBase = "inline-flex items-center rounded border px-1.5 py-0.5 text-xs leading-none";

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
                status: action === "verify" ? "active" : ev.status,
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
    <div className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3 md:p-4">
      <table className="w-full table-fixed text-left text-[var(--color-text-primary)]">
        <thead className="border-b border-[var(--color-border-default)] text-[var(--color-text-accent)]">
          <tr>
            <th className="w-[24%] px-2 py-2 text-sm font-semibold">Title</th>
            <th className="w-[16%] px-2 py-2 text-sm font-semibold">Status</th>
            <th className="w-[9%] px-2 py-2 text-sm font-semibold">Date</th>
            <th className="w-[14%] px-2 py-2 text-sm font-semibold">Venue</th>
            <th className="w-[11%] px-2 py-2 text-sm font-semibold">Host</th>
            <th className="w-[8%] px-2 py-2 text-sm font-semibold">Type</th>
            <th className="w-[8%] px-2 py-2 text-sm font-semibold">Cost</th>
            <th className="w-[4%] px-2 py-2 text-center text-sm font-semibold">Verified</th>
            <th className="w-[4%] px-2 py-2 text-center text-sm font-semibold">Spotlight</th>
            <th className="w-[12%] px-2 py-2 text-sm font-semibold">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((ev) => (
            <tr key={ev.id} className="border-b border-[var(--color-border-subtle)] align-top">
              <td className="px-2 py-3">
                <Link
                  href={`/events/${ev.slug || ev.id}`}
                  className="block break-words text-[var(--color-text-accent)] hover:underline leading-snug"
                  target="_blank"
                >
                  {ev.title}
                </Link>
              </td>
              <td className="px-2 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`${badgeBase} ${
                    ev.is_published
                      ? "border-[var(--pill-border-success)] bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)]"
                      : "border-[var(--pill-border-warning)] bg-[var(--pill-bg-warning)] text-[var(--pill-fg-warning)]"
                  }`}>
                    {ev.is_published ? "Published" : "Draft"}
                  </span>
                  <span className={`${badgeBase} ${
                    ev.status === "active"
                      ? "border-[var(--pill-border-success)] bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)]"
                      : "border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--pill-fg-on-muted)]"
                  }`}>
                    {ev.status}
                  </span>
                </div>
              </td>
              <td className="px-2 py-3 text-sm break-words">{ev.event_date}</td>
              <td className="px-2 py-3 text-sm break-words">{ev.venues?.name ?? ev.venue_name ?? "—"}</td>

              <td className="px-2 py-3">
                {(() => {
                  const host = Array.isArray(ev.host) ? ev.host[0] : ev.host;
                  if (!ev.host_id) {
                    return <span className="text-xs text-[var(--color-text-tertiary)]">No host</span>;
                  }
                  if (!host?.id) {
                    return <span className="text-xs text-[var(--color-text-tertiary)]">Host linked</span>;
                  }
                  return (
                    <Link
                      href={`/members/${host.slug || host.id}`}
                      target="_blank"
                      className="text-sm text-[var(--color-text-accent)] hover:underline break-words"
                    >
                      {host.full_name || "View host"}
                    </Link>
                  );
                })()}
              </td>

              <td className="px-2 py-3">
                {ev.has_timeslots ? (
                  <span className={`${badgeBase} border-[var(--color-border-accent)] bg-[var(--pill-bg-accent)] text-[var(--pill-fg-on-accent)]`}>
                    Timeslots
                  </span>
                ) : (
                  <span className={`${badgeBase} border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--pill-fg-on-muted)]`}>
                    RSVP
                  </span>
                )}
              </td>

              <td className="px-2 py-3">
                {ev.is_free ? (
                  <span className={`${badgeBase} border-[var(--pill-border-success)] bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)]`}>
                    Free
                  </span>
                ) : ev.cost_label ? (
                  <span className={`${badgeBase} max-w-full whitespace-normal break-words border-[var(--color-border-accent)] bg-[var(--pill-bg-accent)] text-[var(--pill-fg-on-accent)]`}>
                    {ev.cost_label}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-tertiary)]">Unspecified</span>
                )}
              </td>

              <td className="px-2 py-3 text-center">
                <input
                  type="checkbox"
                  checked={!!ev.last_verified_at}
                  onChange={() => toggleVerify(ev.id, !!ev.last_verified_at)}
                  disabled={verifyingId === ev.id}
                  title={ev.last_verified_at ? "Verified - click to unverify" : "Unverified - click to verify"}
                  className="w-4 h-4 cursor-pointer accent-emerald-500"
                />
              </td>

              <td className="px-2 py-3 text-center">
                <input
                  type="checkbox"
                  checked={ev.is_spotlight ?? false}
                  onChange={(e) =>
                    updateEvent(ev.id, e.target.checked)
                  }
                  disabled={loadingId === ev.id}
                />
              </td>

              <td className="px-2 py-3">
                {loadingId === ev.id ? (
                  <span className="text-[var(--color-text-accent)]">Saving…</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/my-events/${ev.id}`}
                      className="rounded px-2 py-1 text-xs text-white bg-blue-600 hover:bg-blue-500"
                    >
                      Edit
                    </Link>
                    {ev.has_timeslots && (
                      <>
                        <Link
                          href={`/events/${ev.id}/display`}
                          target="_blank"
                          className="rounded px-2 py-1 text-xs text-white bg-purple-600 hover:bg-purple-500"
                          title="TV Display for venue screens"
                        >
                          📺 TV
                        </Link>
                        <Link
                          href={`/events/${ev.id}/lineup`}
                          className="rounded px-2 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-500"
                          title="Control lineup during event"
                        >
                          🎤 Control
                        </Link>
                      </>
                    )}
                    <button
                      onClick={() => setDeleteModal({ id: ev.id, title: ev.title })}
                      className="rounded px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-500"
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
          <div className="bg-[var(--color-bg-input)] border border-[var(--color-border-default)] rounded-xl p-6 max-w-md w-full mx-4">
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
              className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] mb-4 focus:border-red-500 focus:outline-none"
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
