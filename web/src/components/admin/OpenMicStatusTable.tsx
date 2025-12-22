"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// Status badge colors
const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-600 text-white",
  needs_verification: "bg-amber-600 text-white",
  unverified: "bg-yellow-700 text-white",
  inactive: "bg-gray-600 text-white",
  cancelled: "bg-red-700 text-white",
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "needs_verification", label: "Needs Verification" },
  { value: "unverified", label: "Unverified" },
  { value: "inactive", label: "Inactive" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type OpenMicStatus = typeof STATUS_OPTIONS[number]["value"];

interface OpenMicEvent {
  id: string;
  title: string;
  slug: string | null;
  status: string | null;
  day_of_week: string | null;
  start_time: string | null;
  signup_time: string | null;
  last_verified_at: string | null;
  notes: string | null;
  venues: {
    name: string | null;
    city: string | null;
  } | null;
}

interface Props {
  events: OpenMicEvent[];
}

type FilterTab = "all" | "active" | "needs_review" | "inactive";

export default function OpenMicStatusTable({ events: initialEvents }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [activeTab, setActiveTab] = useState<FilterTab>("needs_review");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, OpenMicStatus>>({});

  // Filter events based on tab and search
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Tab filtering
    if (activeTab === "active") {
      filtered = filtered.filter((e) => e.status === "active");
    } else if (activeTab === "needs_review") {
      filtered = filtered.filter((e) =>
        e.status === "needs_verification" || e.status === "unverified"
      );
    } else if (activeTab === "inactive") {
      filtered = filtered.filter((e) =>
        e.status === "inactive" || e.status === "cancelled"
      );
    }

    // Search filtering
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.venues?.name?.toLowerCase().includes(q) ||
          e.venues?.city?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [events, activeTab, search]);

  // Count by status for tab badges
  const counts = useMemo(() => ({
    all: events.length,
    active: events.filter((e) => e.status === "active").length,
    needs_review: events.filter(
      (e) => e.status === "needs_verification" || e.status === "unverified"
    ).length,
    inactive: events.filter(
      (e) => e.status === "inactive" || e.status === "cancelled"
    ).length,
  }), [events]);

  const handleStatusChange = (eventId: string, newStatus: OpenMicStatus) => {
    setPendingChanges((prev) => ({ ...prev, [eventId]: newStatus }));
  };

  const handleSave = async (eventId: string) => {
    const newStatus = pendingChanges[eventId];
    if (!newStatus) return;

    setUpdating(eventId);

    try {
      const res = await fetch(`/api/admin/open-mics/${eventId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const { data } = await res.json();
        // Update local state
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, status: data.status, last_verified_at: data.last_verified_at, notes: data.notes }
              : e
          )
        );
        // Clear pending change
        setPendingChanges((prev) => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      } else {
        const errData = await res.json();
        alert(`Failed to update: ${errData.error || "Unknown error"}`);
      }
    } catch {
      alert("Error updating status");
    } finally {
      setUpdating(null);
    }
  };

  const handleQuickAction = async (eventId: string, status: OpenMicStatus) => {
    setUpdating(eventId);

    try {
      const res = await fetch(`/api/admin/open-mics/${eventId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, status: data.status, last_verified_at: data.last_verified_at, notes: data.notes }
              : e
          )
        );
      } else {
        const errData = await res.json();
        alert(`Failed to update: ${errData.error || "Unknown error"}`);
      }
    } catch {
      alert("Error updating status");
    } finally {
      setUpdating(null);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "—";
    // time is in HH:MM:SS format, convert to 12-hour
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div>
      {/* Search Box */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by venue or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)]"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        {([
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "needs_review", label: "Needs Review" },
          { key: "inactive", label: "Inactive/Cancelled" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            }`}
          >
            {label}
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-black/20">
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Status Legend */}
      <div className="mb-4 p-3 bg-[var(--color-bg-secondary)] rounded text-xs text-[var(--color-text-tertiary)]">
        <span className="font-medium text-[var(--color-text-secondary)]">Status Legend:</span>{" "}
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Active = visible on public page
        </span>
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-2 h-2 rounded-full bg-amber-600"></span> Needs Verification = imported, needs review
        </span>
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-2 h-2 rounded-full bg-yellow-700"></span> Unverified = community submitted
        </span>
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="w-2 h-2 rounded-full bg-gray-600"></span> Inactive = temporarily hidden
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-700"></span> Cancelled = permanently closed
        </span>
      </div>

      {/* Table */}
      {filteredEvents.length === 0 ? (
        <p className="text-[var(--color-text-tertiary)] py-8 text-center">
          No open mics match the current filter.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[var(--color-text-tertiary)] border-b border-white/10">
                <th className="px-3 py-2">Venue</th>
                <th className="px-3 py-2">Day</th>
                <th className="px-3 py-2">Start</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last Verified</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => {
                const currentStatus = pendingChanges[event.id] || event.status || "unverified";
                const hasPendingChange = event.id in pendingChanges;
                const isUpdating = updating === event.id;

                return (
                  <tr
                    key={event.id}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/open-mics/${event.slug || event.id}`}
                        target="_blank"
                        className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] font-medium"
                      >
                        {event.venues?.name || event.title}
                      </Link>
                      {event.venues?.city && (
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {event.venues.city}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {event.day_of_week || "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {formatTime(event.start_time)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={currentStatus}
                        onChange={(e) =>
                          handleStatusChange(event.id, e.target.value as OpenMicStatus)
                        }
                        disabled={isUpdating}
                        className={`px-2 py-1 rounded text-xs font-medium ${STATUS_STYLES[currentStatus] || STATUS_STYLES.unverified} ${
                          hasPendingChange ? "ring-2 ring-yellow-400" : ""
                        }`}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-tertiary)] text-xs">
                      {formatDate(event.last_verified_at)}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-tertiary)] text-xs max-w-xs truncate">
                      {event.notes ? (
                        <span title={event.notes}>
                          {event.notes.slice(0, 50)}
                          {event.notes.length > 50 ? "..." : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap items-center">
                        {hasPendingChange && (
                          <button
                            onClick={() => handleSave(event.id)}
                            disabled={isUpdating}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs font-medium"
                          >
                            {isUpdating ? "Saving..." : "Save"}
                          </button>
                        )}
                        {!hasPendingChange && event.status !== "active" && (
                          <button
                            onClick={() => handleQuickAction(event.id, "active")}
                            disabled={isUpdating}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-xs"
                          >
                            {isUpdating ? "..." : "Mark Active"}
                          </button>
                        )}
                        {!hasPendingChange && event.status === "active" && (
                          <button
                            onClick={() => handleQuickAction(event.id, "needs_verification")}
                            disabled={isUpdating}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 rounded text-white text-xs"
                          >
                            {isUpdating ? "..." : "Needs Review"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
