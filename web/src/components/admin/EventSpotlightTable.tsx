"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type DBEvent = Database["public"]["Tables"]["events"]["Row"] & {
  venues?: { id: string; name: string } | null;
  is_published?: boolean | null;
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

   // CRITICAL: Guard MUST be first line
   if (!events || !Array.isArray(events)) {
     return (
       <div className="text-neutral-400 py-4">No events available.</div>
     );
   }

   if (rows.length === 0) {
     return (
       <div className="text-neutral-400 py-4">No events found.</div>
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
      <table className="min-w-full text-left text-white">
        <thead className="border-b border-white/10 text-gold-400">
          <tr>
            <th className="py-2 px-3">Title</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-3">Date</th>
            <th className="py-2 px-3">Venue</th>
            <th className="py-2 px-3">Spotlight</th>
            <th className="py-2 px-3">Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((ev) => (
            <tr key={ev.id} className="border-b border-white/5">
              <td className="py-2 px-3">{ev.title}</td>
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
                      : "bg-neutral-800 text-neutral-400"
                  }`}>
                    {ev.status}
                  </span>
                </div>
              </td>
              <td className="py-2 px-3">{ev.event_date}</td>
              <td className="py-2 px-3">{ev.venues?.name ?? ev.venue_name ?? "—"}</td>

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
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/admin/events/${ev.id}/edit`}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setDeleteModal({ id: ev.id, title: ev.title })}
                      className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-xs"
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
          <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">Delete Event</h3>
            <p className="text-neutral-300 mb-2">
              Are you sure you want to delete <strong className="text-white">{deleteModal.title}</strong>?
            </p>
            <p className="text-red-400 text-sm mb-4">
              This action cannot be reversed.
            </p>
            <p className="text-neutral-400 text-sm mb-2">
              Type <strong className="text-white">DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white mb-4 focus:border-red-500 focus:outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteModal(null);
                  setDeleteConfirm("");
                }}
                className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== "DELETE" || deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
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
