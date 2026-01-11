"use client";

/**
 * Event Export Card
 *
 * Button to download events as CSV with optional filters.
 */

import { useState } from "react";

interface FilterOptions {
  status: string;
  event_type: string;
  is_recurring: string;
}

export default function EventExportCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    status: "",
    event_type: "",
    is_recurring: "",
  });

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query string from filters
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.event_type) params.set("event_type", filters.event_type);
      if (filters.is_recurring) params.set("is_recurring", filters.is_recurring);

      const queryString = params.toString();
      const url = `/api/admin/ops/events/export${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || "events-export.csv";

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
        Export Events
      </h2>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        Download events as a CSV file. Edit in Excel/Sheets, then import back.
        Use filters to export a subset of events.
      </p>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            Event Type
          </label>
          <select
            value={filters.event_type}
            onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm"
          >
            <option value="">All types</option>
            <option value="open_mic">Open Mic</option>
            <option value="showcase">Showcase</option>
            <option value="song_circle">Song Circle</option>
            <option value="workshop">Workshop</option>
            <option value="gig">Gig</option>
            <option value="meetup">Meetup</option>
            <option value="kindred_group">Kindred Group</option>
            <option value="jam_session">Jam Session</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            Recurring
          </label>
          <select
            value={filters.is_recurring}
            onChange={(e) => setFilters({ ...filters, is_recurring: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm"
          >
            <option value="">All</option>
            <option value="true">Recurring only</option>
            <option value="false">One-off only</option>
          </select>
        </div>
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
