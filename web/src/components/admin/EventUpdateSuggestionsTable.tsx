"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventUpdateSuggestion } from "@/types/eventUpdateSuggestion";

interface Event {
  id: string;
  title: string;
  slug?: string | null;
  venue_name?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
}

type Suggestion = EventUpdateSuggestion & { events?: Event | null };

interface Props {
  suggestions: Suggestion[] | null;
}

const RESPONSE_TEMPLATES = {
  approve: "Thank you for your contribution! Your correction has been approved and the listing has been updated.",
  reject: "Thank you for your submission. After review, we weren't able to verify this change. If you have additional information, please resubmit.",
  needs_info: "Thank you for flagging this! Could you provide more details or a source for this information? Reply to this email with any additional context.",
};

export default function EventUpdateSuggestionsTable({ suggestions }: Props) {
  const [actionModal, setActionModal] = useState<{
    suggestion: Suggestion;
    action: "approve" | "reject" | "needs_info";
  } | null>(null);
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!suggestions || suggestions.length === 0) {
    return <p className="text-neutral-400">No suggestions to review.</p>;
  }

  const openModal = (suggestion: Suggestion, action: "approve" | "reject" | "needs_info") => {
    setActionModal({ suggestion, action });
    setResponseText(RESPONSE_TEMPLATES[action]);
  };

  const closeModal = () => {
    setActionModal(null);
    setResponseText("");
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setSending(true);

    const { suggestion, action } = actionModal;
    const statusMap = {
      approve: "approved",
      reject: "rejected", 
      needs_info: "needs_info",
    };

    try {
      const res = await fetch(`/api/admin/event-update-suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusMap[action],
          admin_response: responseText,
        }),
      });

      if (res.ok) {
        // TODO: Send email to submitter if email exists
        // For now just reload
        window.location.reload();
      } else {
        alert("Failed to update suggestion");
      }
    } catch (err) {
      alert("Error updating suggestion");
    } finally {
      setSending(false);
      closeModal();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this suggestion permanently?")) return;
    
    const res = await fetch(`/api/admin/event-update-suggestions/${id}`, {
      method: "DELETE",
    });
    
    if (res.ok) {
      window.location.reload();
    } else {
      alert("Failed to delete");
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-neutral-400 border-b border-white/10">
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Current</th>
              <th className="px-3 py-2">Suggested</th>
              <th className="px-3 py-2">Submitter</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-3">
                  <div>
                    <Link
                      href={`/open-mics/${s.events?.slug || s.event_id}`}
                      target="_blank"
                      className="text-[var(--color-gold)] hover:text-[var(--color-gold-400)] font-medium"
                    >
                      {s.events?.title || "Unknown Event"}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      {s.events?.venue_name} • {s.events?.day_of_week}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {s.batch_id && <span>batch: {s.batch_id} </span>}
                      {s.event_id && <span>event: {s.event_id}</span>}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-2 text-neutral-300">{s.field}</td>
                <td className="px-3 py-2 text-neutral-500">{s.old_value || "—"}</td>
                <td className="px-3 py-2 text-green-400 font-medium">{s.new_value}</td>
                <td className="px-3 py-2">
                  <div>
                    <p className="text-neutral-300">{s.submitter_name || "Anonymous"}</p>
                    {s.submitter_email && (
                      <a 
                        href={`mailto:${s.submitter_email}`}
                        className="text-xs text-[var(--color-gold)] hover:text-[var(--color-gold-400)]"
                      >
                        {s.submitter_email}
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    s.status === "approved" ? "bg-green-900 text-green-300" :
                    s.status === "rejected" ? "bg-red-900 text-red-300" :
                    s.status === "needs_info" ? "bg-yellow-900 text-yellow-300" :
                    "bg-neutral-700 text-neutral-300"
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-400 text-xs">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  {s.status === "pending" && (
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => openModal(s, "approve")}
                        className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-xs"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openModal(s, "reject")}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-xs"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => openModal(s, "needs_info")}
                        className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-white text-xs"
                      >
                        Need Info
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="px-2 py-1 text-red-400 hover:text-red-300 text-xs mt-1"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Response Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-lg max-w-lg w-full p-6 border border-neutral-700">
            <h3 className="text-xl font-semibold text-white mb-2">
              {actionModal.action === "approve" && "Approve Suggestion"}
              {actionModal.action === "reject" && "Reject Suggestion"}
              {actionModal.action === "needs_info" && "Request More Info"}
            </h3>
            
            <div className="mb-4 p-3 bg-neutral-800 rounded text-sm">
              <p className="text-neutral-400">Event: <span className="text-white">{actionModal.suggestion.events?.title}</span></p>
              <p className="text-neutral-400">Field: <span className="text-white">{actionModal.suggestion.field}</span></p>
              <p className="text-neutral-400">Change: <span className="text-red-400 line-through">{actionModal.suggestion.old_value || "empty"}</span> → <span className="text-green-400">{actionModal.suggestion.new_value}</span></p>
              {actionModal.suggestion.notes && (
                <p className="text-neutral-400 mt-2">Notes: <span className="text-white">{actionModal.suggestion.notes}</span></p>
              )}
            </div>

            {actionModal.suggestion.submitter_email && (
              <>
                <label className="block text-sm text-neutral-300 mb-1">
                  Response to {actionModal.suggestion.submitter_email}:
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white mb-4"
                />
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={sending}
                className={`px-4 py-2 rounded text-white font-medium ${
                  actionModal.action === "approve" ? "bg-green-600 hover:bg-green-500" :
                  actionModal.action === "reject" ? "bg-red-600 hover:bg-red-500" :
                  "bg-yellow-600 hover:bg-yellow-500"
                }`}
              >
                {sending ? "Saving..." : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
