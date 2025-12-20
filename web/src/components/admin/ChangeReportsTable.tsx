"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChangeReport } from "@/app/(protected)/dashboard/admin/verifications/page";

interface Props {
  reports: ChangeReport[];
}

// Field name labels for display
const FIELD_LABELS: Record<string, string> = {
  title: "Event Name",
  venue_name: "Venue Name",
  venue_address: "Venue Address",
  day_of_week: "Day of Week",
  start_time: "Start Time",
  end_time: "End Time",
  signup_time: "Signup Time",
  description: "Description",
  status: "Status",
  other: "Other",
};

export default function ChangeReportsTable({ reports }: Props) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [modalReport, setModalReport] = useState<ChangeReport | null>(null);
  const [modalAction, setModalAction] = useState<"approve" | "reject" | null>(null);

  const filteredReports = filter === "all"
    ? reports
    : reports.filter(r => r.status === filter);

  const openModal = (report: ChangeReport, action: "approve" | "reject") => {
    setModalReport(report);
    setModalAction(action);
    setAdminNotes("");
  };

  const closeModal = () => {
    setModalReport(null);
    setModalAction(null);
    setAdminNotes("");
  };

  const handleAction = async () => {
    if (!modalReport || !modalAction) return;

    setProcessingId(modalReport.id);

    try {
      const res = await fetch(`/api/admin/change-reports/${modalReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modalAction,
          admin_notes: adminNotes || undefined,
        }),
      });

      if (res.ok) {
        // Reload to reflect changes
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to process report");
      }
    } catch (err) {
      console.error("Error processing report:", err);
      alert("Error processing report");
    } finally {
      setProcessingId(null);
      closeModal();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report permanently?")) return;

    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/change-reports/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        window.location.reload();
      } else {
        alert("Failed to delete");
      }
    } catch {
      alert("Error deleting report");
    } finally {
      setProcessingId(null);
    }
  };

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-secondary)]">
        <p>No change reports to review.</p>
        <p className="text-sm mt-2">Reports submitted via the &quot;Report a change&quot; form will appear here.</p>
      </div>
    );
  }

  return (
    <>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-[var(--color-accent-primary)] text-[var(--color-background)]"
                : "bg-white/5 text-[var(--color-text-secondary)] hover:bg-white/10"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <span className="ml-2 opacity-70">
                ({reports.filter(r => r.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredReports.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">No {filter} reports.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[var(--color-text-secondary)] border-b border-white/10">
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Proposed Value</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Reporter</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-3">
                    <div>
                      <Link
                        href={`/open-mics/${r.events?.slug || r.event_id}`}
                        target="_blank"
                        className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] font-medium"
                      >
                        {r.events?.title || "Unknown Event"}
                      </Link>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {r.events?.venue_name} {r.events?.day_of_week && `• ${r.events.day_of_week}`}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {FIELD_LABELS[r.field_name] || r.field_name}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-emerald-400 font-medium">
                      {r.proposed_value.length > 50
                        ? r.proposed_value.slice(0, 50) + "..."
                        : r.proposed_value}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-tertiary)] text-xs max-w-[150px]">
                    {r.notes ? (
                      r.notes.length > 60 ? r.notes.slice(0, 60) + "..." : r.notes
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.reporter_email ? (
                      <a
                        href={`mailto:${r.reporter_email}`}
                        className="text-xs text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)]"
                      >
                        {r.reporter_email}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-text-tertiary)]">Anonymous</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      r.status === "approved" ? "bg-emerald-900/50 text-emerald-300" :
                      r.status === "rejected" ? "bg-red-900/50 text-red-300" :
                      "bg-amber-900/50 text-amber-300"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-tertiary)] text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "pending" ? (
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => openModal(r, "approve")}
                          disabled={processingId === r.id}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[var(--color-text-primary)] text-xs disabled:opacity-50"
                        >
                          {processingId === r.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => openModal(r, "reject")}
                          disabled={processingId === r.id}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-[var(--color-text-primary)] text-xs disabled:opacity-50"
                        >
                          {processingId === r.id ? "..." : "Reject"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={processingId === r.id}
                        className="px-2 py-1 text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      {modalReport && modalAction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg max-w-lg w-full p-6 border border-[var(--color-border-default)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
              {modalAction === "approve" ? "Approve Change Report" : "Reject Change Report"}
            </h3>

            <div className="mb-4 p-4 bg-[var(--color-background)] rounded-lg text-sm space-y-2">
              <p className="text-[var(--color-text-secondary)]">
                Event: <span className="text-[var(--color-text-primary)]">{modalReport.events?.title}</span>
              </p>
              <p className="text-[var(--color-text-secondary)]">
                Field: <span className="text-[var(--color-text-primary)]">{FIELD_LABELS[modalReport.field_name] || modalReport.field_name}</span>
              </p>
              <p className="text-[var(--color-text-secondary)]">
                Proposed: <span className="text-emerald-400 font-medium">{modalReport.proposed_value}</span>
              </p>
              {modalReport.notes && (
                <p className="text-[var(--color-text-secondary)]">
                  Reporter notes: <span className="text-[var(--color-text-primary)]">{modalReport.notes}</span>
                </p>
              )}
            </div>

            {modalAction === "approve" && (
              <div className="mb-4 p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                <p className="text-sm text-emerald-300">
                  Approving will update the event&apos;s <strong>{FIELD_LABELS[modalReport.field_name] || modalReport.field_name}</strong> field
                  and set the event as verified.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                Admin Notes (optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes about this decision..."
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border-default)] rounded text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={processingId === modalReport.id}
                className={`px-4 py-2 rounded text-[var(--color-text-primary)] font-medium disabled:opacity-50 ${
                  modalAction === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {processingId === modalReport.id ? "Processing..." : `Confirm ${modalAction === "approve" ? "Approval" : "Rejection"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
