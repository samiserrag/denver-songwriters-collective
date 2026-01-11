"use client";

/**
 * Override Export Card
 *
 * Button to download occurrence overrides as CSV with optional filters.
 */

import { useState } from "react";

export default function OverrideExportCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query string from filters
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);

      const queryString = params.toString();
      const url = `/api/admin/ops/overrides/export${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || "overrides-export.csv";

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
        Export Overrides
      </h2>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        Download occurrence overrides as a CSV file. These represent per-date
        modifications to recurring events (cancellations, time changes, etc.).
      </p>

      {/* Filter */}
      <div className="mb-4 max-w-xs">
        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
          Status Filter
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm"
        >
          <option value="">All statuses</option>
          <option value="normal">Normal</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <button
        onClick={handleExport}
        disabled={loading}
        className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded text-[var(--color-text-on-accent)] font-medium disabled:opacity-50"
      >
        {loading ? "Downloading..." : "Download CSV"}
      </button>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
