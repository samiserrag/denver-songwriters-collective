"use client";

import React, { useState } from "react";
import type { EventUpdateSuggestion } from "@/types/eventUpdateSuggestion";

export default function EventUpdateSuggestionsTable({ suggestions }: { suggestions: EventUpdateSuggestion[] | null }) {
  const [loadingIds, setLoadingIds] = useState<number[]>([]);

  if (!suggestions || suggestions.length === 0) {
    return <div className="p-6 text-center text-slate-400">No suggestions found.</div>;
  }

  async function handleAction(id: number, action: "approve" | "reject") {
    if (loadingIds.includes(id)) return;
    setLoadingIds((s) => [...s, id]);
    try {
      const res = await fetch(`/api/admin/event-update-suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action === "approve" ? "approved" : "rejected", reviewed_by: "admin" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json?.error ?? "Failed to update");
      } else {
        alert("Updated");
        // Minimal: reload the page to refresh data
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    } finally {
      setLoadingIds((s) => s.filter((x) => x !== id));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this suggestion?")) return;
    if (loadingIds.includes(id)) return;
    setLoadingIds((s) => [...s, id]);
    try {
      const res = await fetch(`/api/admin/event-update-suggestions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json?.error ?? "Failed to delete");
      } else {
        alert("Deleted");
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    } finally {
      setLoadingIds((s) => s.filter((x) => x !== id));
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Batch</th>
            <th className="px-3 py-2">Event</th>
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2">Old</th>
            <th className="px-3 py-2">New</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map((s) => (
            <tr key={s.id} className="border-t border-white/5">
              <td className="px-3 py-2">{s.id}</td>
              <td className="px-3 py-2">{s.batch_id}</td>
              <td className="px-3 py-2">{s.event_id ?? "—"}</td>
              <td className="px-3 py-2">{s.field}</td>
              <td className="px-3 py-2">{s.old_value ?? "—"}</td>
              <td className="px-3 py-2">{s.new_value}</td>
              <td className="px-3 py-2">{s.status}</td>
              <td className="px-3 py-2">{new Date(s.created_at).toLocaleString()}</td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button disabled={loadingIds.includes(s.id)} onClick={() => handleAction(s.id, "approve")} className="px-2 py-1 bg-green-600 rounded text-white text-xs">Approve</button>
                  <button disabled={loadingIds.includes(s.id)} onClick={() => handleAction(s.id, "reject")} className="px-2 py-1 bg-yellow-600 rounded text-white text-xs">Reject</button>
                  <button disabled={loadingIds.includes(s.id)} onClick={() => handleDelete(s.id)} className="px-2 py-1 bg-red-600 rounded text-white text-xs">Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
