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

interface NewEventData {
  title?: string;
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_state?: string;
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
  signup_time?: string;
  recurrence_rule?: string;
  category?: string;
  description?: string;
  notes?: string;
}

function parseNewEventData(jsonStr: string): NewEventData | null {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
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

  if (!suggestions || suggestions.length === 0) {
    return <p className="text-[var(--color-text-tertiary)]">No suggestions to review.</p>;
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
    } catch {
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
      <p className="text-xs text-[var(--color-text-tertiary)] mb-2">← Scroll horizontally to see Actions column →</p>
      <div className="overflow-x-auto border border-white/10 rounded-lg">
        <table className="min-w-max text-left text-sm">
          <thead>
            <tr className="text-[var(--color-text-tertiary)] border-b border-white/10">
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Current</th>
              <th className="px-3 py-2">Suggested</th>
              <th className="px-3 py-2">Submitter</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 min-w-[180px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => {
              const isNewEvent = s.field === "_new_event";
              const newEventData = isNewEvent ? parseNewEventData(s.new_value) : null;

              return (
              <tr key={s.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-3">
                  {isNewEvent && newEventData ? (
                    <div>
                      <span className="px-2 py-0.5 rounded text-xs bg-emerald-600 text-white mb-1 inline-block">
                        NEW SUBMISSION
                      </span>
                      <p className="text-[var(--color-text-accent)] font-medium">
                        {newEventData.title || "Untitled Event"}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {newEventData.venue_name} • {newEventData.day_of_week}s @ {newEventData.start_time}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Link
                        href={`/open-mics/${s.events?.slug || s.event_id}`}
                        target="_blank"
                        className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] font-medium"
                      >
                        {s.events?.title || "Unknown Event"}
                      </Link>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {s.events?.venue_name} • {s.events?.day_of_week}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        {s.batch_id && <span>batch: {s.batch_id} </span>}
                        {s.event_id && <span>event: {s.event_id}</span>}
                      </p>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                  {isNewEvent ? "New Open Mic" : s.field}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-tertiary)]">
                  {isNewEvent ? "—" : (s.old_value || "—")}
                </td>
                <td className="px-3 py-2">
                  {isNewEvent && newEventData ? (
                    <div className="text-sm space-y-1 max-w-md">
                      <p><span className="text-[var(--color-text-tertiary)]">Venue:</span> <span className="text-[var(--color-text-primary)]">{newEventData.venue_name}</span></p>
                      <p><span className="text-[var(--color-text-tertiary)]">Address:</span> <span className="text-[var(--color-text-primary)]">{newEventData.venue_address}, {newEventData.venue_city}, {newEventData.venue_state}</span></p>
                      <p><span className="text-[var(--color-text-tertiary)]">When:</span> <span className="text-[var(--color-text-primary)]">{newEventData.day_of_week}s @ {newEventData.start_time}</span></p>
                      {newEventData.signup_time && <p><span className="text-[var(--color-text-tertiary)]">Sign-up:</span> <span className="text-[var(--color-text-primary)]">{newEventData.signup_time}</span></p>}
                      <p><span className="text-[var(--color-text-tertiary)]">Recurrence:</span> <span className="text-[var(--color-text-primary)]">{newEventData.recurrence_rule || "Weekly"}</span></p>
                      {newEventData.description && <p className="text-[var(--color-text-secondary)] text-xs mt-2 italic">{newEventData.description}</p>}
                      {newEventData.notes && <p className="text-[var(--color-text-tertiary)] text-xs">Notes: {newEventData.notes}</p>}
                    </div>
                  ) : (
                    <span className="text-green-400 font-medium">{s.new_value}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div>
                    <p className="text-[var(--color-text-secondary)]">{s.submitter_name || "Anonymous"}</p>
                    {s.submitter_email && (
                      <a 
                        href={`mailto:${s.submitter_email}`}
                        className="text-xs text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)]"
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
                    "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--color-text-tertiary)] text-xs">
                  {new Date(s.created_at).toLocaleDateString("en-US", { timeZone: "America/Denver" })}
                </td>
                <td className="px-3 py-2 min-w-[180px]">
                  {s.status === "pending" ? (
                    <div className="flex gap-1 flex-wrap mb-1">
                      <button
                        onClick={() => openModal(s, "approve")}
                        className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-xs font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openModal(s, "reject")}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-xs font-medium"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => openModal(s, "needs_info")}
                        className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-white text-xs font-medium"
                      >
                        Need Info
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--color-text-tertiary)] italic">Already reviewed</span>
                  )}
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="px-2 py-1 text-red-400 hover:text-red-300 text-xs block"
                  >
                    Delete
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Response Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-input)] rounded-lg max-w-lg w-full p-6 border border-[var(--color-border-input)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              {actionModal.action === "approve" && "Approve Suggestion"}
              {actionModal.action === "reject" && "Reject Suggestion"}
              {actionModal.action === "needs_info" && "Request More Info"}
            </h3>
            
            <div className="mb-4 p-3 bg-[var(--color-bg-secondary)] rounded text-sm">
              {actionModal.suggestion.field === "_new_event" ? (
                (() => {
                  const eventData = parseNewEventData(actionModal.suggestion.new_value);
                  return eventData ? (
                    <div className="space-y-1">
                      <p className="text-emerald-400 font-medium">New Open Mic Submission</p>
                      <p className="text-[var(--color-text-tertiary)]">Title: <span className="text-[var(--color-text-primary)]">{eventData.title}</span></p>
                      <p className="text-[var(--color-text-tertiary)]">Venue: <span className="text-[var(--color-text-primary)]">{eventData.venue_name}</span></p>
                      <p className="text-[var(--color-text-tertiary)]">Address: <span className="text-[var(--color-text-primary)]">{eventData.venue_address}, {eventData.venue_city}, {eventData.venue_state}</span></p>
                      <p className="text-[var(--color-text-tertiary)]">When: <span className="text-[var(--color-text-primary)]">{eventData.day_of_week}s @ {eventData.start_time}</span></p>
                      <p className="text-[var(--color-text-tertiary)]">Recurrence: <span className="text-[var(--color-text-primary)]">{eventData.recurrence_rule || "Weekly"}</span></p>
                      {eventData.description && <p className="text-[var(--color-text-tertiary)] mt-2">Description: <span className="text-[var(--color-text-secondary)]">{eventData.description}</span></p>}
                    </div>
                  ) : (
                    <p className="text-red-400">Could not parse event data</p>
                  );
                })()
              ) : (
                <>
                  <p className="text-[var(--color-text-tertiary)]">Event: <span className="text-[var(--color-text-primary)]">{actionModal.suggestion.events?.title}</span></p>
                  <p className="text-[var(--color-text-tertiary)]">Field: <span className="text-[var(--color-text-primary)]">{actionModal.suggestion.field}</span></p>
                  <p className="text-[var(--color-text-tertiary)]">Change: <span className="text-red-400 line-through">{actionModal.suggestion.old_value || "empty"}</span> → <span className="text-green-400">{actionModal.suggestion.new_value}</span></p>
                </>
              )}
              {actionModal.suggestion.notes && (
                <p className="text-[var(--color-text-tertiary)] mt-2">Notes: <span className="text-[var(--color-text-primary)]">{actionModal.suggestion.notes}</span></p>
              )}
            </div>

            {actionModal.suggestion.submitter_email && (
              <>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  Response to {actionModal.suggestion.submitter_email}:
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] mb-4"
                />
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={sending}
                className={`px-4 py-2 rounded text-[var(--color-text-primary)] font-medium ${
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
