"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface HostRequest {
  id: string;
  user_id: string;
  message: string | null;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function HostRequestsTable({ requests }: { requests: HostRequest[] }) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);

  const handleAction = async (
    id: string,
    action: "approve" | "reject",
    reason?: string
  ) => {
    setProcessing(id);

    try {
      const res = await fetch(`/api/admin/host-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejection_reason: reason }),
      });

      if (res.ok) {
        router.refresh();
      }
    } finally {
      setProcessing(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Denver",
    });
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl text-[var(--color-text-primary)] mb-4">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-[var(--color-text-tertiary)]">No pending requests</p>
        ) : (
          <div className="space-y-4">
            {pending.map((request) => (
              <div
                key={request.id}
                className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[var(--color-text-primary)] font-medium">
                      {request.user?.full_name || "Unknown User"}
                    </p>
                    <p className="text-[var(--color-text-tertiary)] text-sm">
                      Requested {formatDate(request.created_at)}
                    </p>
                    {request.message && (
                      <p className="text-[var(--color-text-secondary)] mt-2 text-sm italic">
                        &ldquo;{request.message}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(request.id, "approve")}
                      disabled={processing === request.id}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-[var(--color-text-primary)] text-sm rounded disabled:opacity-50"
                    >
                      {processing === request.id ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt("Rejection reason (optional):");
                        handleAction(request.id, "reject", reason || undefined);
                      }}
                      disabled={processing === request.id}
                      className="px-3 py-1 bg-red-600 hover:bg-red-500 text-[var(--color-text-primary)] text-sm rounded disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl text-[var(--color-text-primary)] mb-4">History ({processed.length})</h2>
        {processed.length === 0 ? (
          <p className="text-[var(--color-text-tertiary)]">No processed requests yet</p>
        ) : (
          <div className="space-y-2">
            {processed.map((request) => (
              <div
                key={request.id}
                className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg flex items-center justify-between"
              >
                <div>
                  <span className="text-[var(--color-text-secondary)]">
                    {request.user?.full_name || "Unknown"}
                  </span>
                  <span className="text-[var(--color-text-tertiary)] text-sm ml-2">
                    {formatDate(request.created_at)}
                  </span>
                </div>
                <span
                  className={`text-sm px-2 py-1 rounded ${
                    request.status === "approved"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  }`}
                >
                  {request.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
